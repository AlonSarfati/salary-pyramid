package com.atlas.api.exception;

import java.util.HashMap;
import java.util.Map;

/**
 * Structured error response for consistent API error format
 */
public class StructuredError {
    private final String code;
    private final String message;
    private final String tenantId;
    private final String capability;
    private final Map<String, Object> details;

    public StructuredError(String code, String message) {
        this(code, message, null, null, null);
    }

    public StructuredError(String code, String message, String tenantId) {
        this(code, message, tenantId, null, null);
    }

    public StructuredError(String code, String message, String tenantId, String capability) {
        this(code, message, tenantId, capability, null);
    }

    public StructuredError(String code, String message, String tenantId, String capability, Map<String, Object> details) {
        this.code = code;
        this.message = message;
        this.tenantId = tenantId;
        this.capability = capability;
        this.details = details != null ? details : new HashMap<>();
    }

    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("code", code);
        map.put("message", message);
        if (tenantId != null) {
            map.put("tenantId", tenantId);
        }
        if (capability != null) {
            map.put("capability", capability);
        }
        if (!details.isEmpty()) {
            map.put("details", details);
        }
        return map;
    }

    // Factory methods for common errors
    public static StructuredError forbidden(String message) {
        return new StructuredError("FORBIDDEN", message);
    }

    public static StructuredError forbidden(String message, String capability) {
        return new StructuredError("FORBIDDEN", message, null, capability);
    }

    public static StructuredError conflict(String message) {
        return new StructuredError("CONFLICT", message);
    }

    public static StructuredError conflict(String message, Map<String, Object> details) {
        return new StructuredError("CONFLICT", message, null, null, details);
    }

    public static StructuredError notFound(String message) {
        return new StructuredError("NOT_FOUND", message);
    }

    public static StructuredError badRequest(String message) {
        return new StructuredError("BAD_REQUEST", message);
    }

    public static StructuredError lastAdminRequired(String tenantId) {
        return new StructuredError("LAST_ADMIN_REQUIRED", 
            "Cannot remove or disable the last active admin in the tenant", 
            tenantId);
    }

    public static StructuredError alreadyMember(String email) {
        Map<String, Object> details = new HashMap<>();
        details.put("email", email);
        return new StructuredError("ALREADY_MEMBER", 
            "User with email " + email + " is already an active member of this tenant",
            null, null, details);
    }

    public static StructuredError ssoRequired(String tenantId) {
        return new StructuredError("SSO_REQUIRED", 
            "SSO authentication is required for this tenant", 
            tenantId);
    }
}

