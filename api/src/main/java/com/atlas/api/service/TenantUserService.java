package com.atlas.api.service;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class TenantUserService {
    private final NamedParameterJdbcTemplate jdbc;
    private final AuditService auditService;

    public TenantUserService(NamedParameterJdbcTemplate jdbc, AuditService auditService) {
        this.jdbc = jdbc;
        this.auditService = auditService;
    }

    public record TenantUserDto(
        String id,
        String tenantId,
        String userIdentityId,
        String name,
        String email,
        String role,
        String status,
        Instant lastLoginAt,
        Instant createdAt
    ) {}

    public record TenantInviteDto(
        String id,
        String tenantId,
        String email,
        String role,
        String invitedBy,
        Instant invitedAt,
        String status, // PENDING, ACCEPTED, EXPIRED, REVOKED
        Instant expiresAt,
        Instant acceptedAt,
        String acceptedBy
    ) {}

    public List<TenantUserDto> getUsersByTenant(String tenantId) {
        String sql = """
            SELECT 
                tu.id,
                tu.tenant_id,
                tu.user_identity_id,
                ui.display_name AS name,
                ui.email,
                tu.role,
                tu.status,
                ui.last_login_at,
                tu.created_at
            FROM tenant_users tu
            JOIN user_identity ui ON tu.user_identity_id = ui.id
            WHERE tu.tenant_id = :tenantId AND tu.status != 'REMOVED'
            ORDER BY tu.created_at DESC
            """;
        
        return jdbc.query(sql, Map.of("tenantId", tenantId), (rs, rowNum) -> {
            return new TenantUserDto(
                rs.getObject("id", UUID.class).toString(),
                rs.getString("tenant_id"),
                rs.getObject("user_identity_id", UUID.class).toString(),
                rs.getString("name"),
                rs.getString("email"),
                rs.getString("role"),
                rs.getString("status"),
                rs.getTimestamp("last_login_at") != null 
                    ? rs.getTimestamp("last_login_at").toInstant() 
                    : null,
                rs.getTimestamp("created_at").toInstant()
            );
        });
    }
    
    /**
     * Count active admins in a tenant (for anti-lockout checks)
     */
    public int countActiveAdmins(String tenantId) {
        String sql = """
            SELECT COUNT(*) 
            FROM tenant_users 
            WHERE tenant_id = :tenantId 
              AND role IN ('TENANT_ADMIN', 'ADMIN')
              AND status = 'ACTIVE'
            """;
        
        Integer count = jdbc.queryForObject(sql, Map.of("tenantId", tenantId), Integer.class);
        return count != null ? count : 0;
    }
    
    /**
     * Check if user is already an active member of the tenant
     */
    public boolean isActiveMember(String tenantId, String email) {
        String sql = """
            SELECT COUNT(*) 
            FROM tenant_users tu
            JOIN user_identity ui ON tu.user_identity_id = ui.id
            WHERE tu.tenant_id = :tenantId 
              AND LOWER(TRIM(ui.email)) = LOWER(TRIM(:email))
              AND tu.status = 'ACTIVE'
            """;
        
        Integer count = jdbc.queryForObject(sql, Map.of("tenantId", tenantId, "email", email), Integer.class);
        return count != null && count > 0;
    }

    public List<TenantInviteDto> getInvitesByTenant(String tenantId) {
        String sql = """
            SELECT 
                id,
                tenant_id,
                email,
                role,
                invited_by,
                invited_at,
                status,
                expires_at,
                accepted_at,
                accepted_by_user_identity_id
            FROM tenant_invites
            WHERE tenant_id = :tenantId
            ORDER BY invited_at DESC
            """;
        
        return jdbc.query(sql, Map.of("tenantId", tenantId), (rs, rowNum) -> {
            String invitedBy = rs.getObject("invited_by", UUID.class) != null
                ? rs.getObject("invited_by", UUID.class).toString()
                : null;
            
            String acceptedBy = rs.getObject("accepted_by_user_identity_id", UUID.class) != null
                ? rs.getObject("accepted_by_user_identity_id", UUID.class).toString()
                : null;
            
            // Auto-expire invites that are past expires_at
            Instant expiresAt = rs.getTimestamp("expires_at") != null
                ? rs.getTimestamp("expires_at").toInstant()
                : null;
            String status = rs.getString("status");
            if ("PENDING".equals(status) && expiresAt != null && expiresAt.isBefore(Instant.now())) {
                // Update status to EXPIRED
                jdbc.update(
                    "UPDATE tenant_invites SET status = 'EXPIRED' WHERE id = :id",
                    Map.of("id", rs.getObject("id", UUID.class))
                );
                status = "EXPIRED";
            }
            
            return new TenantInviteDto(
                rs.getObject("id", UUID.class).toString(),
                rs.getString("tenant_id"),
                rs.getString("email"),
                rs.getString("role"),
                invitedBy,
                rs.getTimestamp("invited_at").toInstant(),
                status,
                expiresAt,
                rs.getTimestamp("accepted_at") != null ? rs.getTimestamp("accepted_at").toInstant() : null,
                acceptedBy
            );
        });
    }

    @Transactional
    public TenantInviteDto createInvite(String tenantId, String email, String role, String invitedByUserId) {
        // Normalize email
        String normalizedEmail = email.toLowerCase().trim();
        
        // Check if user is already an active member
        if (isActiveMember(tenantId, normalizedEmail)) {
            throw new IllegalStateException("User with email " + email + " is already an active member of this tenant");
        }
        
        // Check if there's already a pending invite for this email
        String existingInviteSql = """
            SELECT id FROM tenant_invites 
            WHERE tenant_id = :tenantId 
              AND LOWER(TRIM(email)) = :email 
              AND status = 'PENDING'
            """;
        var existingInvites = jdbc.query(existingInviteSql, 
            Map.of("tenantId", tenantId, "email", normalizedEmail),
            (rs, rowNum) -> rs.getObject("id", UUID.class).toString()
        );
        
        if (!existingInvites.isEmpty()) {
            throw new IllegalStateException("A pending invitation already exists for " + email);
        }
        
        UUID inviteId = UUID.randomUUID();
        UUID invitedBy = invitedByUserId != null ? UUID.fromString(invitedByUserId) : null;
        Instant expiresAt = Instant.now().plusSeconds(30L * 24 * 60 * 60); // 30 days
        
        String sql = """
            INSERT INTO tenant_invites (id, tenant_id, email, role, invited_by, status, expires_at)
            VALUES (:id, :tenantId, :email, :role, :invitedBy, 'PENDING', :expiresAt)
            RETURNING id, tenant_id, email, role, invited_by, invited_at, status, expires_at, accepted_at, accepted_by_user_identity_id
            """;
        
        var result = jdbc.query(sql, Map.of(
            "id", inviteId,
            "tenantId", tenantId,
            "email", normalizedEmail,
            "role", role,
            "invitedBy", invitedBy,
            "expiresAt", java.sql.Timestamp.from(expiresAt)
        ), (rs, rowNum) -> {
            String invBy = rs.getObject("invited_by", UUID.class) != null
                ? rs.getObject("invited_by", UUID.class).toString()
                : null;
            
            String acceptedBy = rs.getObject("accepted_by_user_identity_id", UUID.class) != null
                ? rs.getObject("accepted_by_user_identity_id", UUID.class).toString()
                : null;
            
            return new TenantInviteDto(
                rs.getObject("id", UUID.class).toString(),
                rs.getString("tenant_id"),
                rs.getString("email"),
                rs.getString("role"),
                invBy,
                rs.getTimestamp("invited_at").toInstant(),
                rs.getString("status"),
                rs.getTimestamp("expires_at") != null ? rs.getTimestamp("expires_at").toInstant() : null,
                rs.getTimestamp("accepted_at") != null ? rs.getTimestamp("accepted_at").toInstant() : null,
                acceptedBy
            );
        });
        
        // Log audit event
        auditService.logEvent(
            tenantId,
            invitedByUserId,
            "TENANT_MEMBERSHIP",
            "USER_INVITED",
            "INVITE",
            inviteId.toString(),
            Map.of("email", email, "role", role),
            "User invited to tenant"
        );
        
        return result.get(0);
    }

    @Transactional
    public void updateUserRole(String tenantId, String userId, String role, String actorUserId, String actorSource) {
        // Get old role for audit
        String oldRole = jdbc.query(
            "SELECT role FROM tenant_users WHERE id = :userId AND tenant_id = :tenantId",
            Map.of("userId", UUID.fromString(userId), "tenantId", tenantId),
            (rs, rowNum) -> rs.getString("role")
        ).stream().findFirst().orElse(null);
        
        String sql = """
            UPDATE tenant_users
            SET role = :role, updated_at = now()
            WHERE id = :userId AND tenant_id = :tenantId
            """;
        
        int updated = jdbc.update(sql, Map.of(
            "userId", UUID.fromString(userId),
            "tenantId", tenantId,
            "role", role
        ));
        
        if (updated == 0) {
            throw new IllegalArgumentException("User not found or not in tenant");
        }
        
        // Log audit event
        auditService.logEvent(
            tenantId,
            actorUserId,
            actorSource,
            "USER_ROLE_CHANGED",
            "USER",
            userId,
            Map.of("oldRole", oldRole != null ? oldRole : "", "newRole", role),
            "User role changed"
        );
    }

    @Transactional
    public void updateUserStatus(String tenantId, String userId, String status, String actorUserId, String actorSource) {
        // Anti-lockout: Prevent disabling the last active admin
        if ("DISABLED".equals(status)) {
            // Get the user's role before updating
            String userRole = jdbc.query(
                "SELECT role FROM tenant_users WHERE id = :userId AND tenant_id = :tenantId",
                Map.of("userId", UUID.fromString(userId), "tenantId", tenantId),
                (rs, rowNum) -> rs.getString("role")
            ).stream().findFirst().orElse(null);
            
            // Check if this is an admin
            if (userRole != null && ("TENANT_ADMIN".equals(userRole) || "ADMIN".equals(userRole))) {
                int adminCount = countActiveAdmins(tenantId);
                if (adminCount <= 1) {
                    throw new IllegalStateException("Cannot disable the last active admin in the tenant");
                }
            }
        }
        
        String sql = """
            UPDATE tenant_users
            SET status = :status, updated_at = now()
            WHERE id = :userId AND tenant_id = :tenantId
            """;
        
        int updated = jdbc.update(sql, Map.of(
            "userId", UUID.fromString(userId),
            "tenantId", tenantId,
            "status", status
        ));
        
        if (updated == 0) {
            throw new IllegalArgumentException("User not found or not in tenant");
        }
        
        // Log audit event
        String actionType = "ACTIVE".equals(status) ? "USER_ENABLED" : "USER_DISABLED";
        auditService.logEvent(
            tenantId,
            actorUserId,
            actorSource,
            actionType,
            "USER",
            userId,
            Map.of("status", status),
            "User status changed"
        );
    }

    @Transactional
    public void removeUser(String tenantId, String userId, String actorUserId, String actorSource) {
        // Get user info for audit before removal
        Map<String, Object> userInfo = jdbc.query(
            "SELECT email, role FROM tenant_users tu JOIN user_identity ui ON tu.user_identity_id = ui.id WHERE tu.id = :userId AND tu.tenant_id = :tenantId",
            Map.of("userId", UUID.fromString(userId), "tenantId", tenantId),
            (rs, rowNum) -> {
                Map<String, Object> info = new HashMap<>();
                info.put("email", rs.getString("email"));
                info.put("role", rs.getString("role"));
                return info;
            }
        ).stream().findFirst().orElse(new HashMap<>());
        
        // Anti-lockout: Prevent removing the last active admin
        String userRole = (String) userInfo.get("role");
        if (userRole != null && ("TENANT_ADMIN".equals(userRole) || "ADMIN".equals(userRole))) {
            int adminCount = countActiveAdmins(tenantId);
            if (adminCount <= 1) {
                throw new IllegalStateException("Cannot remove the last active admin in the tenant");
            }
        }
        
        // Soft delete: Set status to REMOVED instead of hard delete
        String sql = """
            UPDATE tenant_users
            SET status = 'REMOVED', updated_at = now()
            WHERE id = :userId AND tenant_id = :tenantId
            """;
        
        int updated = jdbc.update(sql, Map.of(
            "userId", UUID.fromString(userId),
            "tenantId", tenantId
        ));
        
        if (updated == 0) {
            throw new IllegalArgumentException("User not found or not in tenant");
        }
        
        // Log audit event
        auditService.logEvent(
            tenantId,
            actorUserId,
            actorSource,
            "USER_REMOVED",
            "USER",
            userId,
            userInfo,
            "User removed from tenant (soft delete)"
        );
    }
    
    /**
     * Legacy method name for backwards compatibility
     */
    @Deprecated
    public void deleteUser(String tenantId, String userId, String actorUserId, String actorSource) {
        removeUser(tenantId, userId, actorUserId, actorSource);
    }

    @Transactional
    public void revokeInvite(String tenantId, String inviteId, String actorUserId, String actorSource) {
        // Update status to REVOKED instead of deleting
        String sql = """
            UPDATE tenant_invites
            SET status = 'REVOKED'
            WHERE id = :inviteId AND tenant_id = :tenantId AND status = 'PENDING'
            """;
        
        int updated = jdbc.update(sql, Map.of(
            "inviteId", UUID.fromString(inviteId),
            "tenantId", tenantId
        ));
        
        if (updated == 0) {
            throw new IllegalArgumentException("Invite not found or already processed");
        }
        
        // Log audit event
        auditService.logEvent(
            tenantId,
            actorUserId,
            actorSource,
            "INVITE_REVOKED",
            "INVITE",
            inviteId,
            Map.of(),
            "Invite revoked"
        );
    }
    
    @Transactional
    public void extendInvite(String tenantId, String inviteId, int days) {
        Instant newExpiresAt = Instant.now().plusSeconds(days * 24L * 60 * 60);
        
        String sql = """
            UPDATE tenant_invites
            SET expires_at = :expiresAt, status = 'PENDING'
            WHERE id = :inviteId AND tenant_id = :tenantId AND status IN ('PENDING', 'EXPIRED')
            """;
        
        int updated = jdbc.update(sql, Map.of(
            "inviteId", UUID.fromString(inviteId),
            "tenantId", tenantId,
            "expiresAt", java.sql.Timestamp.from(newExpiresAt)
        ));
        
        if (updated == 0) {
            throw new IllegalArgumentException("Invite not found or cannot be extended");
        }
    }
    
    /**
     * Accept an invite - called when a user logs in and matches a pending invite
     */
    @Transactional
    public void acceptInvite(String tenantId, String inviteId, String userIdentityId) {
        // Get invite details
        var invite = jdbc.query(
            """
            SELECT email, role FROM tenant_invites 
            WHERE id = :inviteId AND tenant_id = :tenantId AND status = 'PENDING'
            """,
            Map.of("inviteId", UUID.fromString(inviteId), "tenantId", tenantId),
            (rs, rowNum) -> {
                Map<String, Object> info = new HashMap<>();
                info.put("email", rs.getString("email"));
                info.put("role", rs.getString("role"));
                return info;
            }
        ).stream().findFirst();
        
        if (invite.isEmpty()) {
            throw new IllegalArgumentException("Invite not found or already processed");
        }
        
        // Check if invite is expired
        var expiresAt = jdbc.query(
            "SELECT expires_at FROM tenant_invites WHERE id = :inviteId",
            Map.of("inviteId", UUID.fromString(inviteId)),
            (rs, rowNum) -> rs.getTimestamp("expires_at") != null 
                ? rs.getTimestamp("expires_at").toInstant() 
                : null
        ).stream().findFirst().orElse(null);
        
        if (expiresAt != null && expiresAt.isBefore(Instant.now())) {
            // Mark as expired
            jdbc.update(
                "UPDATE tenant_invites SET status = 'EXPIRED' WHERE id = :inviteId",
                Map.of("inviteId", UUID.fromString(inviteId))
            );
            throw new IllegalArgumentException("Invite has expired");
        }
        
        // Create tenant_users entry
        String role = (String) invite.get().get("role");
        jdbc.update(
            """
            INSERT INTO tenant_users (id, tenant_id, user_identity_id, role, status)
            VALUES (:id, :tenantId, :userIdentityId, :role, 'ACTIVE')
            ON CONFLICT (tenant_id, user_identity_id) DO UPDATE
            SET role = EXCLUDED.role, status = 'ACTIVE', updated_at = now()
            """,
            Map.of(
                "id", UUID.randomUUID(),
                "tenantId", tenantId,
                "userIdentityId", UUID.fromString(userIdentityId),
                "role", role
            )
        );
        
        // Mark invite as accepted
        jdbc.update(
            """
            UPDATE tenant_invites
            SET status = 'ACCEPTED', accepted_at = now(), accepted_by_user_identity_id = :userIdentityId
            WHERE id = :inviteId
            """,
            Map.of(
                "inviteId", UUID.fromString(inviteId),
                "userIdentityId", UUID.fromString(userIdentityId)
            )
        );
        
        // Log audit event
        auditService.logEvent(
            tenantId,
            userIdentityId,
            "TENANT_MEMBERSHIP",
            "INVITE_ACCEPTED",
            "INVITE",
            inviteId,
            Map.of("role", role),
            "Invite accepted"
        );
    }
}

