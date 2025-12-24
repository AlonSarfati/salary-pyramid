package com.atlas.api.controller;

import com.atlas.api.auth.TenantContextResolver;
import com.atlas.api.auth.UserContext;
import com.atlas.api.exception.StructuredError;
import com.atlas.api.service.AuthContextService;
import com.atlas.api.service.CapabilitiesService;
import com.atlas.api.service.TenantSettingsService;
import com.atlas.api.service.UserIdentityService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin")
public class AdminTenantSettingsController {
    private final TenantSettingsService settingsService;
    private final UserContext userContext;
    private final AuthContextService authContextService;
    private final CapabilitiesService capabilitiesService;
    private final UserIdentityService userIdentityService;
    private final TenantContextResolver tenantContextResolver;

    public AdminTenantSettingsController(
        TenantSettingsService settingsService,
        UserContext userContext,
        AuthContextService authContextService,
        CapabilitiesService capabilitiesService,
        UserIdentityService userIdentityService,
        TenantContextResolver tenantContextResolver
    ) {
        this.settingsService = settingsService;
        this.userContext = userContext;
        this.authContextService = authContextService;
        this.capabilitiesService = capabilitiesService;
        this.userIdentityService = userIdentityService;
        this.tenantContextResolver = tenantContextResolver;
    }
    
    /**
     * Ensure UserContext is populated from JWT if not already populated
     */
    private void ensureUserContextPopulated() {
        if (userContext.isAuthenticated()) {
            return; // Already populated
        }
        
        // Try to extract from SecurityContextHolder
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            var identity = authContextService.extractIdentity(jwtAuth.getToken());
            var matchResult = authContextService.matchAllowlist(identity);
            
            if (matchResult.matched() && matchResult.entry().isPresent()) {
                var entry = matchResult.entry().get();
                if ("ACTIVE".equals(entry.status())) {
                    userContext.setIssuer(identity.issuer());
                    userContext.setSubject(identity.subject());
                    userContext.setEmail(identity.email());
                    userContext.setDisplayName(identity.displayName());
                    userContext.setRole(entry.role());
                    userContext.setMode(entry.mode());
                    userContext.setAllowedTenantIds(entry.tenantIds() != null ? entry.tenantIds() : List.of());
                }
            }
        }
    }

    /**
     * Get current user's actor info (userIdentityId and source)
     */
    private Map<String, String> getActorInfo() {
        ensureUserContextPopulated();
        
        String userIdentityId = null;
        String actorSource = null;
        
        if (userContext.getIssuer() != null && userContext.getSubject() != null) {
            var userIdentity = userIdentityService.findByIssuerAndSubject(
                userContext.getIssuer(), 
                userContext.getSubject()
            );
            if (userIdentity.isPresent()) {
                userIdentityId = userIdentity.get().id().toString();
                actorSource = "TENANT_MEMBERSHIP"; // Settings are always tenant-scoped
            }
        }
        
        return Map.of(
            "userIdentityId", userIdentityId != null ? userIdentityId : "",
            "actorSource", actorSource != null ? actorSource : "SYSTEM_ALLOWLIST"
        );
    }
    
    /**
     * Get user's role for a specific tenant.
     */
    private String getTenantRole(String tenantId) {
        if (userContext.getIssuer() == null || userContext.getSubject() == null) {
            return userContext.getRole();
        }
        
        var userIdentity = userIdentityService.findByIssuerAndSubject(
            userContext.getIssuer(), 
            userContext.getSubject()
        );
        
        if (userIdentity.isPresent()) {
            // Check tenant_users table - would need to inject TenantUserService or query directly
            // For now, fall back to allowlist role
        }
        
        return userContext.getRole();
    }
    
    /**
     * Check if user has capability for tenant
     */
    private boolean hasCapability(String capability, String tenantId) {
        ensureUserContextPopulated();
        
        if (!userContext.isAuthenticated()) {
            return false;
        }
        
        // Validate capability scope
        try {
            capabilitiesService.validateCapabilityCheck(capability, tenantId);
        } catch (IllegalArgumentException e) {
            return false;
        }
        
        // Resolve and validate tenant context (includes SSO check)
        try {
            tenantContextResolver.resolveTenant(tenantId);
        } catch (SecurityException e) {
            return false;
        }
        
        String systemRole = userContext.getRole();
        String tenantRole = getTenantRole(tenantId);
        boolean canAccessAllTenants = "SYSTEM_ADMIN".equals(normalizeSystemRole(systemRole)) 
            || "ADMIN".equals(systemRole);
        
        return capabilitiesService.hasCapability(
            systemRole,
            tenantRole,
            capability,
            tenantId,
            canAccessAllTenants,
            userContext.getAllowedTenantIds()
        );
    }
    
    /**
     * Get correlation ID from request header or generate one
     */
    private String getCorrelationId(HttpServletRequest request) {
        String correlationId = request.getHeader("X-Correlation-ID");
        if (correlationId == null || correlationId.trim().isEmpty()) {
            correlationId = java.util.UUID.randomUUID().toString();
        }
        return correlationId;
    }
    
    private String normalizeSystemRole(String role) {
        if (role == null) return null;
        return switch (role) {
            case "ADMIN" -> "SYSTEM_ADMIN";
            case "ANALYST" -> "SYSTEM_ANALYST";
            case "VIEWER" -> "SYSTEM_VIEWER";
            default -> role;
        };
    }
    
    /**
     * Check if user can change requireSso (only SYSTEM_ADMIN)
     */
    private boolean canChangeSso(String tenantId) {
        return hasCapability(CapabilitiesService.TENANT_DANGER_DELETE, tenantId);
    }

    /**
     * Get tenant settings
     */
    @GetMapping("/{tenantId}/settings")
    public ResponseEntity<?> getSettings(@PathVariable String tenantId) {
        // Resolve and validate tenant (includes SSO check)
        try {
            tenantContextResolver.resolveTenant(tenantId);
        } catch (SecurityException e) {
            if (e.getMessage().contains("SSO")) {
                return ResponseEntity.status(403).body(
                    StructuredError.ssoRequired(tenantId).toMap()
                );
            }
            return ResponseEntity.status(403).body(
                StructuredError.forbidden(e.getMessage(), CapabilitiesService.TENANT_SETTINGS_EDIT).toMap()
            );
        }
        
        if (!hasCapability(CapabilitiesService.TENANT_SETTINGS_EDIT, tenantId)) {
            return ResponseEntity.status(403).body(
                StructuredError.forbidden(
                    "You do not have permission to view settings for this tenant",
                    CapabilitiesService.TENANT_SETTINGS_EDIT
                ).toMap()
            );
        }

        try {
            var settings = settingsService.getSettings(tenantId);
            if (settings.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of(
                    "error", "NOT_FOUND",
                    "message", "Tenant settings not found"
                ));
            }

            var s = settings.get();
            Map<String, Object> response = new java.util.HashMap<>();
            response.put("tenantId", s.tenantId());
            response.put("name", s.name());
            response.put("timezone", s.timezone());
            response.put("currency", s.currency());
            response.put("locale", s.locale());
            response.put("rounding", s.rounding());
            response.put("retentionDays", s.retentionDays());
            response.put("exports", Map.of(
                "csv", s.exportCsv(),
                "xlsx", s.exportXlsx(),
                "pdf", s.exportPdf()
            ));
            response.put("sessionTimeoutMinutes", s.sessionTimeoutMinutes());
            response.put("allowedEmailDomains", s.allowedEmailDomains() != null ? s.allowedEmailDomains() : List.of());
            response.put("requireSso", s.requireSso());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(
                StructuredError.badRequest(e.getMessage()).toMap()
            );
        }
    }

    /**
     * Update tenant settings
     */
    @PutMapping("/{tenantId}/settings")
    public ResponseEntity<?> updateSettings(
        @PathVariable String tenantId,
        @RequestBody Map<String, Object> request,
        HttpServletRequest httpRequest
    ) {
        // Resolve and validate tenant
        try {
            tenantContextResolver.resolveTenant(tenantId);
        } catch (SecurityException e) {
            if (e.getMessage().contains("SSO")) {
                return ResponseEntity.status(403).body(
                    StructuredError.ssoRequired(tenantId).toMap()
                );
            }
            return ResponseEntity.status(403).body(
                StructuredError.forbidden(e.getMessage(), CapabilitiesService.TENANT_SETTINGS_EDIT).toMap()
            );
        }
        
        if (!hasCapability(CapabilitiesService.TENANT_SETTINGS_EDIT, tenantId)) {
            return ResponseEntity.status(403).body(
                StructuredError.forbidden(
                    "You do not have permission to edit settings for this tenant",
                    CapabilitiesService.TENANT_SETTINGS_EDIT
                ).toMap()
            );
        }

        try {
            // Check if requireSso is being changed - only SYSTEM_ADMIN can change this
            if (request.containsKey("requireSso") && !canChangeSso(tenantId)) {
                return ResponseEntity.status(403).body(
                    StructuredError.forbidden(
                        "Only system admins can change SSO settings",
                        CapabilitiesService.TENANT_DANGER_DELETE
                    ).toMap()
                );
            }

            // Build update map
            Map<String, Object> updates = new java.util.HashMap<>();
            
            if (request.containsKey("name")) {
                updates.put("name", request.get("name"));
            }
            if (request.containsKey("timezone")) {
                updates.put("timezone", request.get("timezone"));
            }
            if (request.containsKey("currency")) {
                updates.put("currency", request.get("currency"));
            }
            if (request.containsKey("locale")) {
                updates.put("locale", request.get("locale"));
            }
            if (request.containsKey("rounding")) {
                updates.put("rounding", request.get("rounding"));
            }
            if (request.containsKey("retentionDays")) {
                updates.put("retentionDays", request.get("retentionDays"));
            }
            if (request.containsKey("sessionTimeoutMinutes")) {
                updates.put("sessionTimeoutMinutes", request.get("sessionTimeoutMinutes"));
            }
            if (request.containsKey("allowedEmailDomains")) {
                updates.put("allowedEmailDomains", request.get("allowedEmailDomains"));
            }
            if (request.containsKey("requireSso") && canChangeSso(tenantId)) {
                updates.put("requireSso", request.get("requireSso"));
            }

            // Handle exports object
            if (request.containsKey("exports")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> exports = (Map<String, Object>) request.get("exports");
                if (exports != null) {
                    if (exports.containsKey("csv")) {
                        updates.put("exportCsv", exports.get("csv"));
                    }
                    if (exports.containsKey("xlsx")) {
                        updates.put("exportXlsx", exports.get("xlsx"));
                    }
                    if (exports.containsKey("pdf")) {
                        updates.put("exportPdf", exports.get("pdf"));
                    }
                }
            }

            var actorInfo = getActorInfo();
            String correlationId = getCorrelationId(httpRequest);
            
            var updated = settingsService.updateSettings(
                tenantId, 
                updates,
                actorInfo.get("userIdentityId"),
                actorInfo.get("actorSource")
            );
            
            // Note: Audit logging is done in TenantSettingsService.updateSettings
            
            Map<String, Object> response = new java.util.HashMap<>();
            response.put("tenantId", updated.tenantId());
            response.put("name", updated.name());
            response.put("timezone", updated.timezone());
            response.put("currency", updated.currency());
            response.put("locale", updated.locale());
            response.put("rounding", updated.rounding());
            response.put("retentionDays", updated.retentionDays());
            response.put("exports", Map.of(
                "csv", updated.exportCsv(),
                "xlsx", updated.exportXlsx(),
                "pdf", updated.exportPdf()
            ));
            response.put("sessionTimeoutMinutes", updated.sessionTimeoutMinutes());
            response.put("allowedEmailDomains", updated.allowedEmailDomains() != null ? updated.allowedEmailDomains() : List.of());
            response.put("requireSso", updated.requireSso());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(
                StructuredError.notFound(e.getMessage()).toMap()
            );
        } catch (Exception e) {
            return ResponseEntity.status(500).body(
                StructuredError.badRequest(e.getMessage()).toMap()
            );
        }
    }
}

