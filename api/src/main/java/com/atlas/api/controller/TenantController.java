package com.atlas.api.controller;

import com.atlas.api.service.TenantService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/tenants")
public class TenantController {
    private final TenantService tenantService;

    public TenantController(TenantService tenantService) {
        this.tenantService = tenantService;
    }

    /**
     * List all tenants
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listTenants() {
        List<TenantService.TenantDto> tenants = tenantService.listTenants();
        List<Map<String, Object>> response = tenants.stream()
            .map(TenantService.TenantDto::toMap)
            .toList();
        return ResponseEntity.ok(response);
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

