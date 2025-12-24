package com.atlas.api.service;

import org.springframework.stereotype.Service;

import java.util.Set;

/**
 * Service for mapping roles to capabilities.
 * Capabilities are fine-grained permissions that replace direct role checks.
 */
@Service
public class CapabilitiesService {
    
    // Capability constants
    public static final String SYSTEM_TENANTS_MANAGE = "system.tenants.manage";
    public static final String TENANT_USERS_MANAGE = "tenant.users.manage";
    public static final String TENANT_SETTINGS_EDIT = "tenant.settings.edit";
    public static final String TENANT_EXPORTS_MANAGE = "tenant.exports.manage";
    public static final String TENANT_DANGER_DELETE = "tenant.danger.delete";
    
    /**
     * Capability scope: GLOBAL or TENANT
     */
    public enum CapabilityScope {
        GLOBAL,  // System-wide, not tenant-scoped
        TENANT   // Tenant-scoped, requires tenantId
    }
    
    /**
     * Get the scope of a capability
     */
    public CapabilityScope getScope(String capability) {
        if (SYSTEM_TENANTS_MANAGE.equals(capability)) {
            return CapabilityScope.GLOBAL;
        }
        // All other capabilities are tenant-scoped
        return CapabilityScope.TENANT;
    }
    
    /**
     * Validate capability check parameters
     * Throws IllegalArgumentException if validation fails
     */
    public void validateCapabilityCheck(String capability, String tenantId) {
        CapabilityScope scope = getScope(capability);
        
        if (scope == CapabilityScope.TENANT && (tenantId == null || tenantId.trim().isEmpty())) {
            throw new IllegalArgumentException(
                "Capability '" + capability + "' is tenant-scoped and requires a tenantId"
            );
        }
        
        if (scope == CapabilityScope.GLOBAL && tenantId != null && !tenantId.trim().isEmpty()) {
            // Global capabilities don't need tenantId, but it's not an error to provide one
            // (it might be used for logging/audit)
        }
    }
    
    /**
     * Get capabilities for a system-level role (from access_allowlist)
     */
    public Set<String> getCapabilitiesForSystemRole(String systemRole) {
        if (systemRole == null) {
            return Set.of();
        }
        
        // Normalize old role names for backwards compatibility
        String normalized = normalizeSystemRole(systemRole);
        
        // Check both normalized and original (for backwards compatibility)
        if ("SYSTEM_ADMIN".equals(normalized) || "ADMIN".equals(systemRole)) {
            return Set.of(
                SYSTEM_TENANTS_MANAGE,
                TENANT_USERS_MANAGE,
                TENANT_SETTINGS_EDIT,
                TENANT_EXPORTS_MANAGE,
                TENANT_DANGER_DELETE
            );
        }
        
        if ("SYSTEM_ANALYST".equals(normalized) || "ANALYST".equals(systemRole) ||
            "SYSTEM_VIEWER".equals(normalized) || "VIEWER".equals(systemRole)) {
            return Set.of(); // No admin capabilities
        }
        
        return Set.of();
    }
    
    /**
     * Get capabilities for a tenant-level role (from tenant_users)
     */
    public Set<String> getCapabilitiesForTenantRole(String tenantRole) {
        if (tenantRole == null) {
            return Set.of();
        }
        
        // Normalize old role names for backwards compatibility
        String normalized = normalizeTenantRole(tenantRole);
        
        // Check both normalized and original (for backwards compatibility)
        if ("TENANT_ADMIN".equals(normalized) || "ADMIN".equals(tenantRole)) {
            return Set.of(
                TENANT_USERS_MANAGE,
                TENANT_SETTINGS_EDIT,
                TENANT_EXPORTS_MANAGE
            );
        }
        
        if ("TENANT_EDITOR".equals(normalized) || "EDITOR".equals(tenantRole) ||
            "TENANT_VIEWER".equals(normalized) || "VIEWER".equals(tenantRole)) {
            return Set.of(); // No admin capabilities
        }
        
        return Set.of();
    }
    
    /**
     * Check if a user has a specific capability.
     * 
     * @param systemRole System-level role (from allowlist), can be null
     * @param tenantRole Tenant-level role (from tenant_users), can be null
     * @param capability The capability to check
     * @param tenantId The tenant ID (for tenant-scoped capabilities)
     * @param canAccessAllTenants Whether user can access all tenants (SYSTEM_ADMIN)
     * @param allowedTenantIds List of tenant IDs user can access
     * @return true if user has the capability
     */
    public boolean hasCapability(
        String systemRole,
        String tenantRole,
        String capability,
        String tenantId,
        boolean canAccessAllTenants,
        java.util.List<String> allowedTenantIds
    ) {
        // Get capabilities from both roles
        Set<String> systemCapabilities = getCapabilitiesForSystemRole(systemRole);
        Set<String> tenantCapabilities = getCapabilitiesForTenantRole(tenantRole);
        
        // Combine capabilities
        Set<String> allCapabilities = new java.util.HashSet<>(systemCapabilities);
        allCapabilities.addAll(tenantCapabilities);
        
        // Debug logging (can be removed later)
        System.out.println("CapabilitiesService.hasCapability: systemRole=" + systemRole + 
            ", tenantRole=" + tenantRole + 
            ", capability=" + capability + 
            ", canAccessAllTenants=" + canAccessAllTenants +
            ", systemCapabilities=" + systemCapabilities +
            ", tenantCapabilities=" + tenantCapabilities +
            ", allCapabilities=" + allCapabilities);
        
        // Check if capability exists
        if (!allCapabilities.contains(capability)) {
            System.out.println("CapabilitiesService.hasCapability: capability not found in allCapabilities");
            return false;
        }
        
        // For system-level capabilities, check if user can access all tenants
        if (SYSTEM_TENANTS_MANAGE.equals(capability) || TENANT_DANGER_DELETE.equals(capability)) {
            System.out.println("CapabilitiesService.hasCapability: system-level capability, canAccessAllTenants=" + canAccessAllTenants);
            return canAccessAllTenants;
        }
        
        // For tenant-scoped capabilities, check tenant access
        if (capability.startsWith("tenant.")) {
            if (canAccessAllTenants) {
                System.out.println("CapabilitiesService.hasCapability: tenant capability, SYSTEM_ADMIN can access");
                return true; // SYSTEM_ADMIN can access any tenant
            }
            boolean hasAccess = allowedTenantIds != null && allowedTenantIds.contains(tenantId);
            System.out.println("CapabilitiesService.hasCapability: tenant capability, hasAccess=" + hasAccess);
            return hasAccess;
        }
        
        return true;
    }
    
    /**
     * Normalize system role name (backwards compatibility)
     */
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
     * Normalize tenant role name (backwards compatibility)
     */
    private String normalizeTenantRole(String role) {
        if (role == null) return null;
        return switch (role) {
            case "ADMIN" -> "TENANT_ADMIN";
            case "EDITOR" -> "TENANT_EDITOR";
            case "VIEWER" -> "TENANT_VIEWER";
            default -> role;
        };
    }
}

