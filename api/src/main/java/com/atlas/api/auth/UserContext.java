package com.atlas.api.auth;

import java.util.List;

/**
 * Request-scoped user context containing authorization information.
 * Populated by AccessGateFilter after successful authentication and allowlist check.
 */
public class UserContext {
    private String issuer;
    private String subject;
    private String email;
    private String displayName;
    private String role;
    private String mode;
    private List<String> allowedTenantIds;
    private String primaryTenantId;

    public String getIssuer() {
        return issuer;
    }

    public void setIssuer(String issuer) {
        this.issuer = issuer;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public List<String> getAllowedTenantIds() {
        return allowedTenantIds;
    }

    public void setAllowedTenantIds(List<String> allowedTenantIds) {
        this.allowedTenantIds = allowedTenantIds;
    }

    public String getPrimaryTenantId() {
        return primaryTenantId;
    }

    public void setPrimaryTenantId(String primaryTenantId) {
        this.primaryTenantId = primaryTenantId;
    }

    public boolean isAuthenticated() {
        return issuer != null && subject != null;
    }

    public boolean hasRole(String role) {
        return this.role != null && this.role.equals(role);
    }

    public boolean canAccessTenant(String tenantId) {
        if (allowedTenantIds == null || allowedTenantIds.isEmpty()) {
            return false;
        }
        return allowedTenantIds.contains(tenantId);
    }
}

