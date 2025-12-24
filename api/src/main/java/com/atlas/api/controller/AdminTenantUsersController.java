package com.atlas.api.controller;

import com.atlas.api.auth.TenantContextResolver;
import com.atlas.api.auth.UserContext;
import com.atlas.api.exception.StructuredError;
import com.atlas.api.service.AuditService;
import com.atlas.api.service.AuthContextService;
import com.atlas.api.service.CapabilitiesService;
import com.atlas.api.service.TenantUserService;
import com.atlas.api.service.UserIdentityService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/admin")
public class AdminTenantUsersController {
    private final TenantUserService tenantUserService;
    private final UserContext userContext;
    private final UserIdentityService userIdentityService;
    private final AuthContextService authContextService;
    private final CapabilitiesService capabilitiesService;
    private final AuditService auditService;
    private final TenantContextResolver tenantContextResolver;
    private final NamedParameterJdbcTemplate jdbc;

    public AdminTenantUsersController(
        TenantUserService tenantUserService,
        UserContext userContext,
        UserIdentityService userIdentityService,
        AuthContextService authContextService,
        CapabilitiesService capabilitiesService,
        AuditService auditService,
        TenantContextResolver tenantContextResolver,
        NamedParameterJdbcTemplate jdbc
    ) {
        this.tenantUserService = tenantUserService;
        this.userContext = userContext;
        this.userIdentityService = userIdentityService;
        this.authContextService = authContextService;
        this.capabilitiesService = capabilitiesService;
        this.auditService = auditService;
        this.tenantContextResolver = tenantContextResolver;
        this.jdbc = jdbc;
    }
    
    /**
     * Ensure UserContext is populated from JWT if not already populated
     */
    private void ensureUserContextPopulated() {
        if (userContext.isAuthenticated()) {
            return;
        }
        
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
                // Check if user has tenant membership or only system allowlist
                String tenantRole = getTenantRole(userContext.getAllowedTenantIds().isEmpty() 
                    ? "default" 
                    : userContext.getAllowedTenantIds().get(0));
                if (tenantRole != null && !tenantRole.equals(userContext.getRole())) {
                    actorSource = "TENANT_MEMBERSHIP";
                } else {
                    actorSource = "SYSTEM_ALLOWLIST";
                }
            }
        }
        
        return Map.of(
            "userIdentityId", userIdentityId != null ? userIdentityId : "",
            "actorSource", actorSource != null ? actorSource : "SYSTEM_ALLOWLIST"
        );
    }
    
    /**
     * Get user's role for a specific tenant.
     * First checks tenant_users table, then falls back to allowlist role.
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
            var results = tenantUserService.getUsersByTenant(tenantId);
            var tenantUser = results.stream()
                .filter(u -> u.userIdentityId().equals(userIdentity.get().id().toString()))
                .findFirst();
            
            if (tenantUser.isPresent()) {
                return tenantUser.get().role();
            }
        }
        
        return userContext.getRole();
    }
    
    /**
     * Get effective role and role source for a user in a tenant
     */
    private Map<String, Object> getEffectiveRoleInfo(String tenantId) {
        ensureUserContextPopulated();
        
        String systemRole = userContext.getRole();
        String tenantRole = getTenantRole(tenantId);
        
        // Normalize roles for backwards compatibility
        String normalizedSystemRole = normalizeSystemRole(systemRole);
        String normalizedTenantRole = normalizeTenantRole(tenantRole);
        
        // Determine effective role and source
        String effectiveRole;
        String roleSource;
        boolean canAccessAllTenants = false;
        
        // If system role is SYSTEM_ADMIN, that takes precedence
        if ("SYSTEM_ADMIN".equals(normalizedSystemRole) || "ADMIN".equals(systemRole)) {
            effectiveRole = normalizedSystemRole;
            roleSource = "SYSTEM_ALLOWLIST";
            canAccessAllTenants = true;
        } else if (tenantRole != null && !tenantRole.equals(systemRole)) {
            // Tenant-specific role exists
            effectiveRole = normalizedTenantRole;
            roleSource = "TENANT_MEMBERSHIP";
        } else {
            // Fall back to system role
            effectiveRole = normalizedSystemRole;
            roleSource = "SYSTEM_ALLOWLIST";
        }
        
        return Map.of(
            "effectiveRole", effectiveRole,
            "roleSource", roleSource,
            "canAccessAllTenants", canAccessAllTenants
        );
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
        
        // Check if user is SYSTEM_ADMIN (either new or old role name)
        String normalizedSystemRole = normalizeSystemRole(systemRole);
        boolean canAccessAllTenants = "SYSTEM_ADMIN".equals(normalizedSystemRole) 
            || "SYSTEM_ADMIN".equals(systemRole)
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
            correlationId = UUID.randomUUID().toString();
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
    
    private String normalizeTenantRole(String role) {
        if (role == null) return null;
        return switch (role) {
            case "ADMIN" -> "TENANT_ADMIN";
            case "EDITOR" -> "TENANT_EDITOR";
            case "VIEWER" -> "TENANT_VIEWER";
            default -> role;
        };
    }

    /**
     * Get all users for a tenant
     */
    @GetMapping("/{tenantId}/users")
    public ResponseEntity<?> getUsers(
        @PathVariable String tenantId,
        HttpServletRequest request
    ) {
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
                StructuredError.forbidden(e.getMessage(), CapabilitiesService.TENANT_USERS_MANAGE).toMap()
            );
        }
        
        if (!hasCapability(CapabilitiesService.TENANT_USERS_MANAGE, tenantId)) {
            return ResponseEntity.status(403).body(
                StructuredError.forbidden(
                    "You do not have permission to manage users for this tenant",
                    CapabilitiesService.TENANT_USERS_MANAGE
                ).toMap()
            );
        }

        try {
            var users = tenantUserService.getUsersByTenant(tenantId);
            var roleInfo = getEffectiveRoleInfo(tenantId);
            
            // Get role info for each user
            var userList = users.stream().map(u -> {
                // Determine role source for each user
                String userRoleSource = "TENANT_MEMBERSHIP"; // Users in tenant_users are always TENANT_MEMBERSHIP
                
                Map<String, Object> userMap = new HashMap<>();
                userMap.put("id", u.id());
                userMap.put("name", u.name() != null ? u.name() : "");
                userMap.put("email", u.email() != null ? u.email() : "");
                userMap.put("role", normalizeTenantRole(u.role()));
                userMap.put("effectiveRole", normalizeTenantRole(u.role()));
                userMap.put("roleSource", userRoleSource);
                userMap.put("status", u.status());
                userMap.put("lastLoginAt", u.lastLoginAt() != null ? u.lastLoginAt().toString() : null);
                userMap.put("createdAt", u.createdAt().toString());
                return userMap;
            }).toList();
            
            Map<String, Object> response = new HashMap<>();
            response.put("users", userList);
            response.put("actingAs", roleInfo);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "error", "INTERNAL_ERROR",
                "message", e.getMessage()
            ));
        }
    }

    /**
     * Get all invites for a tenant
     */
    @GetMapping("/{tenantId}/invites")
    public ResponseEntity<?> getInvites(@PathVariable String tenantId) {
        if (!hasCapability(CapabilitiesService.TENANT_USERS_MANAGE, tenantId)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "FORBIDDEN",
                "message", "You do not have permission to manage users for this tenant"
            ));
        }

        try {
            var invites = tenantUserService.getInvitesByTenant(tenantId);
            var roleInfo = getEffectiveRoleInfo(tenantId);
            
            var inviteList = invites.stream().map(i -> {
                // Calculate days until expiry
                Long expiresInDays = null;
                if (i.expiresAt() != null && "PENDING".equals(i.status())) {
                    expiresInDays = ChronoUnit.DAYS.between(Instant.now(), i.expiresAt());
                    if (expiresInDays < 0) {
                        expiresInDays = 0L;
                    }
                }
                
                Map<String, Object> inviteMap = new HashMap<>();
                inviteMap.put("id", i.id());
                inviteMap.put("email", i.email());
                inviteMap.put("role", normalizeTenantRole(i.role()));
                inviteMap.put("status", i.status());
                inviteMap.put("invitedAt", i.invitedAt().toString());
                inviteMap.put("invitedBy", i.invitedBy() != null ? i.invitedBy() : "");
                inviteMap.put("expiresAt", i.expiresAt() != null ? i.expiresAt().toString() : null);
                inviteMap.put("expiresInDays", expiresInDays);
                inviteMap.put("acceptedAt", i.acceptedAt() != null ? i.acceptedAt().toString() : null);
                inviteMap.put("acceptedBy", i.acceptedBy() != null ? i.acceptedBy() : "");
                return inviteMap;
            }).toList();
            
            Map<String, Object> response = new HashMap<>();
            response.put("invites", inviteList);
            response.put("actingAs", roleInfo);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "error", "INTERNAL_ERROR",
                "message", e.getMessage()
            ));
        }
    }

    /**
     * Create an invitation
     */
    @PostMapping("/{tenantId}/invites")
    public ResponseEntity<?> createInvite(
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
                StructuredError.forbidden(e.getMessage(), CapabilitiesService.TENANT_USERS_MANAGE).toMap()
            );
        }
        
        if (!hasCapability(CapabilitiesService.TENANT_USERS_MANAGE, tenantId)) {
            return ResponseEntity.status(403).body(
                StructuredError.forbidden(
                    "You do not have permission to manage users for this tenant",
                    CapabilitiesService.TENANT_USERS_MANAGE
                ).toMap()
            );
        }

        String email = (String) request.get("email");
        String role = (String) request.get("role");
        
        try {
            
            if (email == null || email.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(
                    StructuredError.badRequest("Email is required").toMap()
                );
            }
            
            // Accept both old and new role names
            String normalizedRole = normalizeTenantRole(role);
            if (normalizedRole == null || !List.of("TENANT_ADMIN", "TENANT_EDITOR", "TENANT_VIEWER", "ADMIN", "EDITOR", "VIEWER").contains(role)) {
                return ResponseEntity.badRequest().body(
                    StructuredError.badRequest("Valid role is required").toMap()
                );
            }

            var actorInfo = getActorInfo();
            var invite = tenantUserService.createInvite(
                tenantId, 
                email, 
                normalizedRole != null ? normalizedRole : role, 
                actorInfo.get("userIdentityId")
            );
            
            // Log audit with correlation ID
            String correlationId = getCorrelationId(httpRequest);
            auditService.logEvent(
                tenantId,
                actorInfo.get("userIdentityId"),
                actorInfo.get("actorSource"),
                "USER_INVITED",
                "INVITE",
                invite.id(),
                Map.of("email", email, "role", normalizedRole != null ? normalizedRole : role),
                "User invited to tenant",
                correlationId
            );
            
            Map<String, Object> inviteMap = new HashMap<>();
            inviteMap.put("id", invite.id());
            inviteMap.put("email", invite.email());
            inviteMap.put("role", normalizeTenantRole(invite.role()));
            inviteMap.put("status", invite.status());
            inviteMap.put("invitedAt", invite.invitedAt().toString());
            inviteMap.put("invitedBy", invite.invitedBy() != null ? invite.invitedBy() : "");
            inviteMap.put("expiresAt", invite.expiresAt() != null ? invite.expiresAt().toString() : null);
            
            return ResponseEntity.ok(inviteMap);
        } catch (IllegalStateException e) {
            // Handle already-member or duplicate invite
            if (e.getMessage().contains("already an active member")) {
                String emailForError = email != null ? email : "unknown";
                return ResponseEntity.status(409).body(
                    StructuredError.alreadyMember(emailForError).toMap()
                );
            }
            if (e.getMessage().contains("already exists")) {
                return ResponseEntity.status(409).body(
                    StructuredError.conflict(e.getMessage()).toMap()
                );
            }
            return ResponseEntity.status(409).body(
                StructuredError.conflict(e.getMessage()).toMap()
            );
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(
                StructuredError.badRequest(e.getMessage()).toMap()
            );
        } catch (Exception e) {
            return ResponseEntity.status(500).body(
                StructuredError.badRequest(e.getMessage()).toMap()
            );
        }
    }

    /**
     * Update user role
     */
    @PostMapping("/{tenantId}/users/{userId}/role")
    public ResponseEntity<?> updateUserRole(
        @PathVariable String tenantId,
        @PathVariable String userId,
        @RequestBody Map<String, Object> request
    ) {
        if (!hasCapability(CapabilitiesService.TENANT_USERS_MANAGE, tenantId)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "FORBIDDEN",
                "message", "You do not have permission to manage users for this tenant"
            ));
        }

        try {
            String role = (String) request.get("role");
            String normalizedRole = normalizeTenantRole(role);
            if (normalizedRole == null || !List.of("TENANT_ADMIN", "TENANT_EDITOR", "TENANT_VIEWER", "ADMIN", "EDITOR", "VIEWER").contains(role)) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "BAD_REQUEST",
                    "message", "Valid role is required"
                ));
            }

            var actorInfo = getActorInfo();
            tenantUserService.updateUserRole(
                tenantId, 
                userId, 
                normalizedRole != null ? normalizedRole : role,
                actorInfo.get("userIdentityId"),
                actorInfo.get("actorSource")
            );
            return ResponseEntity.ok(Map.of("status", "success"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of(
                "error", "NOT_FOUND",
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "error", "INTERNAL_ERROR",
                "message", e.getMessage()
            ));
        }
    }

    /**
     * Update user status
     */
    @PostMapping("/{tenantId}/users/{userId}/status")
    public ResponseEntity<?> updateUserStatus(
        @PathVariable String tenantId,
        @PathVariable String userId,
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
                StructuredError.forbidden(e.getMessage(), CapabilitiesService.TENANT_USERS_MANAGE).toMap()
            );
        }
        
        if (!hasCapability(CapabilitiesService.TENANT_USERS_MANAGE, tenantId)) {
            return ResponseEntity.status(403).body(
                StructuredError.forbidden(
                    "You do not have permission to manage users for this tenant",
                    CapabilitiesService.TENANT_USERS_MANAGE
                ).toMap()
            );
        }

        try {
            String status = (String) request.get("status");
            if (status == null || !List.of("ACTIVE", "DISABLED").contains(status)) {
                return ResponseEntity.badRequest().body(
                    StructuredError.badRequest("Status must be ACTIVE or DISABLED").toMap()
                );
            }

            var actorInfo = getActorInfo();
            String correlationId = getCorrelationId(httpRequest);
            
            tenantUserService.updateUserStatus(
                tenantId, 
                userId, 
                status,
                actorInfo.get("userIdentityId"),
                actorInfo.get("actorSource")
            );
            
            // Log audit with correlation ID
            auditService.logEvent(
                tenantId,
                actorInfo.get("userIdentityId"),
                actorInfo.get("actorSource"),
                "ACTIVE".equals(status) ? "USER_ENABLED" : "USER_DISABLED",
                "USER",
                userId,
                Map.of("status", status),
                "User status changed",
                correlationId
            );
            
            return ResponseEntity.ok(Map.of("status", "success"));
        } catch (IllegalStateException e) {
            // Anti-lockout error
            if (e.getMessage().contains("last active admin")) {
                return ResponseEntity.status(409).body(
                    StructuredError.lastAdminRequired(tenantId).toMap()
                );
            }
            return ResponseEntity.status(409).body(
                StructuredError.conflict(e.getMessage()).toMap()
            );
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

    /**
     * Delete a user from tenant
     */
    @DeleteMapping("/{tenantId}/users/{userId}")
    public ResponseEntity<?> removeUser(
        @PathVariable String tenantId,
        @PathVariable String userId,
        HttpServletRequest request
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
                StructuredError.forbidden(e.getMessage(), CapabilitiesService.TENANT_USERS_MANAGE).toMap()
            );
        }
        
        if (!hasCapability(CapabilitiesService.TENANT_USERS_MANAGE, tenantId)) {
            return ResponseEntity.status(403).body(
                StructuredError.forbidden(
                    "You do not have permission to manage users for this tenant",
                    CapabilitiesService.TENANT_USERS_MANAGE
                ).toMap()
            );
        }

        try {
            var actorInfo = getActorInfo();
            String correlationId = getCorrelationId(request);
            
            tenantUserService.removeUser(
                tenantId, 
                userId,
                actorInfo.get("userIdentityId"),
                actorInfo.get("actorSource")
            );
            
            // Log audit with correlation ID
            auditService.logEvent(
                tenantId,
                actorInfo.get("userIdentityId"),
                actorInfo.get("actorSource"),
                "USER_REMOVED",
                "USER",
                userId,
                Map.of(),
                "User removed from tenant",
                correlationId
            );
            
            return ResponseEntity.ok(Map.of("status", "success"));
        } catch (IllegalStateException e) {
            // Anti-lockout error
            if (e.getMessage().contains("last active admin")) {
                return ResponseEntity.status(409).body(
                    StructuredError.lastAdminRequired(tenantId).toMap()
                );
            }
            return ResponseEntity.status(409).body(
                StructuredError.conflict(e.getMessage()).toMap()
            );
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

    /**
     * Revoke an invitation
     */
    @DeleteMapping("/{tenantId}/invites/{inviteId}")
    public ResponseEntity<?> revokeInvite(
        @PathVariable String tenantId,
        @PathVariable String inviteId
    ) {
        if (!hasCapability(CapabilitiesService.TENANT_USERS_MANAGE, tenantId)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "FORBIDDEN",
                "message", "You do not have permission to manage users for this tenant"
            ));
        }

        try {
            var actorInfo = getActorInfo();
            tenantUserService.revokeInvite(
                tenantId, 
                inviteId,
                actorInfo.get("userIdentityId"),
                actorInfo.get("actorSource")
            );
            return ResponseEntity.ok(Map.of("status", "success"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of(
                "error", "NOT_FOUND",
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "error", "INTERNAL_ERROR",
                "message", e.getMessage()
            ));
        }
    }
    
    /**
     * Extend an invitation
     */
    @PostMapping("/{tenantId}/invites/{inviteId}/extend")
    public ResponseEntity<?> extendInvite(
        @PathVariable String tenantId,
        @PathVariable String inviteId,
        @RequestBody Map<String, Object> request
    ) {
        if (!hasCapability(CapabilitiesService.TENANT_USERS_MANAGE, tenantId)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "FORBIDDEN",
                "message", "You do not have permission to manage users for this tenant"
            ));
        }

        try {
            Integer days = request.get("days") instanceof Number 
                ? ((Number) request.get("days")).intValue() 
                : 30;
            
            if (days < 1 || days > 365) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "BAD_REQUEST",
                    "message", "Days must be between 1 and 365"
                ));
            }
            
            tenantUserService.extendInvite(tenantId, inviteId, days);
            return ResponseEntity.ok(Map.of("status", "success"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of(
                "error", "NOT_FOUND",
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "error", "INTERNAL_ERROR",
                "message", e.getMessage()
            ));
        }
    }
    
    /**
     * Get audit log for tenant
     */
    @GetMapping("/{tenantId}/audit")
    public ResponseEntity<?> getAuditLog(
        @PathVariable String tenantId,
        @RequestParam(defaultValue = "50") int limit
    ) {
        if (!hasCapability(CapabilitiesService.TENANT_USERS_MANAGE, tenantId)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "FORBIDDEN",
                "message", "You do not have permission to view audit log for this tenant"
            ));
        }

        try {
            var auditEntries = auditService.getAuditLog(tenantId, Math.min(limit, 100));
            var roleInfo = getEffectiveRoleInfo(tenantId);
            
            var auditList = auditEntries.stream().map(e -> {
                Map<String, Object> entryMap = new HashMap<>();
                entryMap.put("id", e.id());
                entryMap.put("createdAt", e.createdAt().toString());
                entryMap.put("actorUserIdentityId", e.actorUserIdentityId());
                entryMap.put("actorSource", e.actorSource());
                entryMap.put("actionType", e.actionType());
                entryMap.put("targetType", e.targetType());
                entryMap.put("targetId", e.targetId());
                entryMap.put("diffJson", e.diffJson());
                entryMap.put("notes", e.notes());
                return entryMap;
            }).toList();
            
            Map<String, Object> response = new HashMap<>();
            response.put("auditLog", auditList);
            response.put("actingAs", roleInfo);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "error", "INTERNAL_ERROR",
                "message", e.getMessage()
            ));
        }
    }
}
