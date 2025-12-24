package com.atlas.api.controller;

import com.atlas.api.auth.TenantContextResolver;
import com.atlas.api.auth.UserContext;
import com.atlas.api.service.TenantService;
import com.atlas.api.service.TenantUserService;
import com.atlas.api.service.UserIdentityService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/tenants")
public class TenantController {
    private final TenantService tenantService;
    private final UserContext userContext;
    private final TenantUserService tenantUserService;
    private final UserIdentityService userIdentityService;

    public TenantController(
        TenantService tenantService,
        UserContext userContext,
        TenantUserService tenantUserService,
        UserIdentityService userIdentityService
    ) {
        this.tenantService = tenantService;
        this.userContext = userContext;
        this.tenantUserService = tenantUserService;
        this.userIdentityService = userIdentityService;
    }

    /**
     * List accessible tenants with metadata (effectiveRole, roleSource, canAccessAllTenants)
     * For SYSTEM_ADMIN: returns all tenants
     * For others: returns only allowedTenantIds + tenant_users memberships
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listTenants() {
        if (!userContext.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        String systemRole = userContext.getRole();
        boolean canAccessAllTenants = "SYSTEM_ADMIN".equals(systemRole) || "ADMIN".equals(systemRole);

        List<TenantService.TenantDto> allTenants = tenantService.listTenants();
        
        // Filter tenants based on access
        List<TenantService.TenantDto> accessibleTenants;
        if (canAccessAllTenants) {
            accessibleTenants = allTenants;
        } else {
            List<String> allowedTenantIds = userContext.getAllowedTenantIds();
            accessibleTenants = allTenants.stream()
                .filter(t -> allowedTenantIds != null && allowedTenantIds.contains(t.tenantId()))
                .collect(Collectors.toList());
        }

        // Get user's identity for tenant role lookup
        final String userIdentityId;
        if (userContext.getIssuer() != null && userContext.getSubject() != null) {
            var userIdentity = userIdentityService.findByIssuerAndSubject(
                userContext.getIssuer(),
                userContext.getSubject()
            );
            userIdentityId = userIdentity.map(ui -> ui.id().toString()).orElse(null);
        } else {
            userIdentityId = null;
        }

        // Build response with metadata
        List<Map<String, Object>> response = accessibleTenants.stream().map(tenant -> {
            Map<String, Object> tenantMap = new HashMap<>();
            tenantMap.put("tenantId", tenant.tenantId());
            tenantMap.put("tenantName", tenant.name());
            tenantMap.put("status", tenant.status());
            tenantMap.put("currency", tenant.currency());
            tenantMap.put("createdAt", tenant.createdAt().toString());
            tenantMap.put("updatedAt", tenant.updatedAt().toString());

            // Determine effective role and source for this tenant
            String effectiveRole = systemRole;
            String roleSource = "SYSTEM_ALLOWLIST";
            
            if (userIdentityId != null) {
                var tenantUsers = tenantUserService.getUsersByTenant(tenant.tenantId());
                var tenantUser = tenantUsers.stream()
                    .filter(u -> u.userIdentityId().equals(userIdentityId))
                    .findFirst();
                
                if (tenantUser.isPresent()) {
                    effectiveRole = tenantUser.get().role();
                    roleSource = "TENANT_MEMBERSHIP";
                }
            }

            // Normalize role names
            String normalizedRole = normalizeRole(effectiveRole, canAccessAllTenants);
            
            tenantMap.put("effectiveRole", normalizedRole);
            tenantMap.put("roleSource", roleSource);
            tenantMap.put("canAccessAllTenants", canAccessAllTenants);

            return tenantMap;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }
    
    private String normalizeRole(String role, boolean canAccessAllTenants) {
        if (role == null) return null;
        return switch (role) {
            case "ADMIN" -> canAccessAllTenants ? "SYSTEM_ADMIN" : "TENANT_ADMIN";
            case "EDITOR" -> "TENANT_EDITOR";
            case "VIEWER" -> canAccessAllTenants ? "SYSTEM_VIEWER" : "TENANT_VIEWER";
            default -> role;
        };
    }

    /**
     * Get a specific tenant
     */
    @GetMapping("/{tenantId}")
    public ResponseEntity<Map<String, Object>> getTenant(@PathVariable String tenantId) {
        return tenantService.getTenant(tenantId)
            .map(tenant -> ResponseEntity.ok(tenant.toMap()))
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Create a new tenant
     */
    @PostMapping
    public ResponseEntity<?> createTenant(@RequestBody Map<String, Object> body) {
        try {
            String tenantId = (String) body.get("tenantId");
            String name = (String) body.get("name");
            String status = (String) body.getOrDefault("status", "ACTIVE");
            String currency = (String) body.getOrDefault("currency", "USD");
            
            TenantService.TenantDto tenant = tenantService.createTenant(tenantId, name, status, currency);
            return ResponseEntity.ok(tenant.toMap());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to create tenant: " + e.getMessage()));
        }
    }

    /**
     * Update a tenant
     */
    @PutMapping("/{tenantId}")
    public ResponseEntity<?> updateTenant(
            @PathVariable String tenantId,
            @RequestBody Map<String, Object> body) {
        try {
            String name = (String) body.get("name");
            String status = (String) body.get("status");
            String currency = (String) body.get("currency");
            
            return tenantService.updateTenant(tenantId, name, status, currency)
                .map(tenant -> ResponseEntity.ok(tenant.toMap()))
                .orElse(ResponseEntity.notFound().build());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to update tenant: " + e.getMessage()));
        }
    }

    /**
     * Delete a tenant (soft delete by setting status to INACTIVE)
     */
    @DeleteMapping("/{tenantId}")
    public ResponseEntity<Map<String, String>> deleteTenant(@PathVariable String tenantId) {
        boolean deleted = tenantService.deactivateTenant(tenantId);
        
        if (!deleted) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(Map.of("status", "deactivated", "tenantId", tenantId));
    }
}

