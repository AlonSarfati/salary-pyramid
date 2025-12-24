package com.atlas.api.controller;

import com.atlas.api.auth.UserContext;
import com.atlas.api.service.AuthContextService;
import com.atlas.api.service.TenantUserService;
import com.atlas.api.service.UserIdentityService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

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

    public AdminTenantUsersController(
        TenantUserService tenantUserService,
        UserContext userContext,
        UserIdentityService userIdentityService,
        AuthContextService authContextService
    ) {
        this.tenantUserService = tenantUserService;
        this.userContext = userContext;
        this.userIdentityService = userIdentityService;
        this.authContextService = authContextService;
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
     * Check if current user has admin permissions for the tenant
     */
    private boolean canManageUsers(String tenantId) {
        // Ensure UserContext is populated from JWT if not already
        ensureUserContextPopulated();
        
        if (!userContext.isAuthenticated()) {
            System.out.println("AdminTenantUsersController.canManageUsers: NOT AUTHENTICATED");
            return false;
        }
        
        // Get allowlist role (this is what matters for system admins)
        String allowlistRole = userContext.getRole();
        System.out.println("AdminTenantUsersController.canManageUsers: tenantId=" + tenantId + 
            ", allowlistRole=" + allowlistRole + 
            ", email=" + userContext.getEmail() + 
            ", allowedTenantIds=" + userContext.getAllowedTenantIds());
        
        // For ADMIN users from allowlist, grant access to all tenants
        // ADMIN is the strongest role - they can manage any tenant
        if ("ADMIN".equals(allowlistRole)) {
            System.out.println("AdminTenantUsersController.canManageUsers: System ADMIN - granting access");
            return true;
        }
        
        // For other roles, check tenant-specific role
        String role = getTenantRole(tenantId);
        boolean isAdmin = "ADMIN".equals(role);
        
        if (!isAdmin) {
            System.out.println("AdminTenantUsersController.canManageUsers: Not ADMIN (role=" + role + ")");
            return false;
        }
        
        // For tenant-specific admins, check if they have access to this tenant
        if (!userContext.canAccessTenant(tenantId)) {
            System.out.println("AdminTenantUsersController.canManageUsers: Cannot access tenant " + tenantId);
            return false;
        }
        
        System.out.println("AdminTenantUsersController.canManageUsers: Access granted");
        return true;
    }
    
    /**
     * Get user's role for a specific tenant.
     * First checks tenant_users table, then falls back to allowlist role.
     */
    private String getTenantRole(String tenantId) {
        if (userContext.getIssuer() == null || userContext.getSubject() == null) {
            return userContext.getRole(); // Fall back to allowlist role
        }
        
        // Try to find user in tenant_users
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
        
        // Fall back to allowlist role (ADMIN, ANALYST, VIEWER)
        // For admin endpoints, we accept ADMIN from allowlist
        return userContext.getRole();
    }

    /**
     * Get all users for a tenant
     */
    @GetMapping("/{tenantId}/users")
    public ResponseEntity<?> getUsers(@PathVariable String tenantId) {
        if (!canManageUsers(tenantId)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "FORBIDDEN",
                "message", "You do not have permission to manage users for this tenant"
            ));
        }

        try {
            var users = tenantUserService.getUsersByTenant(tenantId);
            return ResponseEntity.ok(users.stream().map(u -> Map.of(
                "id", u.id(),
                "name", u.name() != null ? u.name() : "",
                "email", u.email() != null ? u.email() : "",
                "role", u.role(),
                "status", u.status(),
                "lastLoginAt", u.lastLoginAt() != null ? u.lastLoginAt().toString() : null,
                "createdAt", u.createdAt().toString()
            )).toList());
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "error", "INTERNAL_ERROR",
                "message", e.getMessage()
            ));
        }
    }

    /**
     * Get all pending invites for a tenant
     */
    @GetMapping("/{tenantId}/invites")
    public ResponseEntity<?> getInvites(@PathVariable String tenantId) {
        if (!canManageUsers(tenantId)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "FORBIDDEN",
                "message", "You do not have permission to manage users for this tenant"
            ));
        }

        try {
            var invites = tenantUserService.getInvitesByTenant(tenantId);
            return ResponseEntity.ok(invites.stream().map(i -> Map.of(
                "id", i.id(),
                "email", i.email(),
                "role", i.role(),
                "invitedAt", i.invitedAt().toString(),
                "invitedBy", i.invitedBy() != null ? i.invitedBy() : ""
            )).toList());
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
        @RequestBody Map<String, Object> request
    ) {
        if (!canManageUsers(tenantId)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "FORBIDDEN",
                "message", "You do not have permission to manage users for this tenant"
            ));
        }

        try {
            String email = (String) request.get("email");
            String role = (String) request.get("role");
            
            if (email == null || email.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "BAD_REQUEST",
                    "message", "Email is required"
                ));
            }
            
            if (role == null || !List.of("ADMIN", "EDITOR", "VIEWER").contains(role)) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "BAD_REQUEST",
                    "message", "Valid role is required"
                ));
            }

            // Get current user's identity ID
            String invitedByUserId = null;
            if (userContext.getIssuer() != null && userContext.getSubject() != null) {
                var userIdentity = userIdentityService.findByIssuerAndSubject(
                    userContext.getIssuer(), 
                    userContext.getSubject()
                );
                if (userIdentity.isPresent()) {
                    invitedByUserId = userIdentity.get().id().toString();
                }
            }
            
            var invite = tenantUserService.createInvite(tenantId, email, role, invitedByUserId);
            
            return ResponseEntity.ok(Map.of(
                "id", invite.id(),
                "email", invite.email(),
                "role", invite.role(),
                "invitedAt", invite.invitedAt().toString(),
                "invitedBy", invite.invitedBy() != null ? invite.invitedBy() : ""
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "BAD_REQUEST",
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
     * Update user role
     */
    @PostMapping("/{tenantId}/users/{userId}/role")
    public ResponseEntity<?> updateUserRole(
        @PathVariable String tenantId,
        @PathVariable String userId,
        @RequestBody Map<String, Object> request
    ) {
        if (!canManageUsers(tenantId)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "FORBIDDEN",
                "message", "You do not have permission to manage users for this tenant"
            ));
        }

        try {
            String role = (String) request.get("role");
            if (role == null || !List.of("ADMIN", "EDITOR", "VIEWER").contains(role)) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "BAD_REQUEST",
                    "message", "Valid role is required"
                ));
            }

            tenantUserService.updateUserRole(tenantId, userId, role);
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
        @RequestBody Map<String, Object> request
    ) {
        if (!canManageUsers(tenantId)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "FORBIDDEN",
                "message", "You do not have permission to manage users for this tenant"
            ));
        }

        try {
            String status = (String) request.get("status");
            if (status == null || !List.of("ACTIVE", "DISABLED").contains(status)) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "BAD_REQUEST",
                    "message", "Status must be ACTIVE or DISABLED"
                ));
            }

            tenantUserService.updateUserStatus(tenantId, userId, status);
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
     * Delete a user from tenant
     */
    @DeleteMapping("/{tenantId}/users/{userId}")
    public ResponseEntity<?> deleteUser(
        @PathVariable String tenantId,
        @PathVariable String userId
    ) {
        if (!canManageUsers(tenantId)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "FORBIDDEN",
                "message", "You do not have permission to manage users for this tenant"
            ));
        }

        try {
            tenantUserService.deleteUser(tenantId, userId);
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
     * Delete an invitation
     */
    @DeleteMapping("/{tenantId}/invites/{inviteId}")
    public ResponseEntity<?> deleteInvite(
        @PathVariable String tenantId,
        @PathVariable String inviteId
    ) {
        if (!canManageUsers(tenantId)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "FORBIDDEN",
                "message", "You do not have permission to manage users for this tenant"
            ));
        }

        try {
            tenantUserService.deleteInvite(tenantId, inviteId);
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
}

