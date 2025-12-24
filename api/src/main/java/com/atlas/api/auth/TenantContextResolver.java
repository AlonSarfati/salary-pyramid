package com.atlas.api.auth;

import com.atlas.api.service.TenantSettingsService;
import org.springframework.context.annotation.Scope;
import org.springframework.context.annotation.ScopedProxyMode;
import org.springframework.stereotype.Component;
import org.springframework.web.context.WebApplicationContext;

/**
 * Resolves and validates tenant context from request path parameters.
 * Ensures tenantId is only taken from path and validated against user's access.
 */
@Component
@Scope(value = WebApplicationContext.SCOPE_REQUEST, proxyMode = ScopedProxyMode.TARGET_CLASS)
public class TenantContextResolver {
    private final UserContext userContext;
    private final TenantSettingsService tenantSettingsService;
    private String resolvedTenantId;
    private Boolean ssoRequired;

    public TenantContextResolver(UserContext userContext, TenantSettingsService tenantSettingsService) {
        this.userContext = userContext;
        this.tenantSettingsService = tenantSettingsService;
    }

    /**
     * Resolve tenant from path parameter and validate access
     * 
     * @param tenantIdFromPath The tenantId from the URL path
     * @return The validated tenantId
     * @throws SecurityException if user cannot access this tenant
     */
    public String resolveTenant(String tenantIdFromPath) {
        if (tenantIdFromPath == null || tenantIdFromPath.trim().isEmpty()) {
            throw new IllegalArgumentException("tenantId is required");
        }

        String tenantId = tenantIdFromPath.trim();

        // Validate user has access to this tenant
        if (!userContext.isAuthenticated()) {
            throw new SecurityException("Authentication required");
        }

        // SYSTEM_ADMIN can access all tenants
        String systemRole = userContext.getRole();
        boolean canAccessAllTenants = "SYSTEM_ADMIN".equals(systemRole) || "ADMIN".equals(systemRole);

        if (!canAccessAllTenants) {
            if (!userContext.canAccessTenant(tenantId)) {
                throw new SecurityException("Access denied to tenant: " + tenantId);
            }
        }

        // Check SSO requirement
        checkSsoRequirement(tenantId);

        this.resolvedTenantId = tenantId;
        return tenantId;
    }

    /**
     * Check if SSO is required for this tenant
     */
    private void checkSsoRequirement(String tenantId) {
        if (this.ssoRequired != null) {
            return; // Already checked
        }

        var settings = tenantSettingsService.getSettings(tenantId);
        if (settings.isPresent()) {
            this.ssoRequired = settings.get().requireSso();
            
            if (this.ssoRequired) {
                // Verify user authenticated via OIDC (not local auth)
                // For now, if we have a JWT with issuer, we consider it SSO
                // In future, you might check issuer against allowed_issuers
                if (userContext.getIssuer() == null || userContext.getIssuer().trim().isEmpty()) {
                    throw new SecurityException("SSO authentication required for this tenant");
                }
            }
        } else {
            this.ssoRequired = false;
        }
    }

    /**
     * Get the resolved tenant ID (cached after first resolution)
     */
    public String getResolvedTenantId() {
        return resolvedTenantId;
    }

    /**
     * Check if SSO is required for the resolved tenant
     */
    public boolean isSsoRequired() {
        return ssoRequired != null && ssoRequired;
    }
}

