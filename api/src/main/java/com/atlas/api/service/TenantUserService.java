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

    public TenantUserService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
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
        Instant invitedAt
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
            WHERE tu.tenant_id = :tenantId
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

    public List<TenantInviteDto> getInvitesByTenant(String tenantId) {
        String sql = """
            SELECT 
                id,
                tenant_id,
                email,
                role,
                invited_by,
                invited_at
            FROM tenant_invites
            WHERE tenant_id = :tenantId
            ORDER BY invited_at DESC
            """;
        
        return jdbc.query(sql, Map.of("tenantId", tenantId), (rs, rowNum) -> {
            String invitedBy = rs.getObject("invited_by", UUID.class) != null
                ? rs.getObject("invited_by", UUID.class).toString()
                : null;
            
            return new TenantInviteDto(
                rs.getObject("id", UUID.class).toString(),
                rs.getString("tenant_id"),
                rs.getString("email"),
                rs.getString("role"),
                invitedBy,
                rs.getTimestamp("invited_at").toInstant()
            );
        });
    }

    @Transactional
    public TenantInviteDto createInvite(String tenantId, String email, String role, String invitedByUserId) {
        UUID inviteId = UUID.randomUUID();
        UUID invitedBy = invitedByUserId != null ? UUID.fromString(invitedByUserId) : null;
        
        String sql = """
            INSERT INTO tenant_invites (id, tenant_id, email, role, invited_by)
            VALUES (:id, :tenantId, :email, :role, :invitedBy)
            RETURNING id, tenant_id, email, role, invited_by, invited_at
            """;
        
        var result = jdbc.query(sql, Map.of(
            "id", inviteId,
            "tenantId", tenantId,
            "email", email.toLowerCase().trim(),
            "role", role,
            "invitedBy", invitedBy
        ), (rs, rowNum) -> {
            String invBy = rs.getObject("invited_by", UUID.class) != null
                ? rs.getObject("invited_by", UUID.class).toString()
                : null;
            
            return new TenantInviteDto(
                rs.getObject("id", UUID.class).toString(),
                rs.getString("tenant_id"),
                rs.getString("email"),
                rs.getString("role"),
                invBy,
                rs.getTimestamp("invited_at").toInstant()
            );
        });
        
        return result.get(0);
    }

    @Transactional
    public void updateUserRole(String tenantId, String userId, String role) {
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
    }

    @Transactional
    public void updateUserStatus(String tenantId, String userId, String status) {
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
    }

    @Transactional
    public void deleteUser(String tenantId, String userId) {
        String sql = """
            DELETE FROM tenant_users
            WHERE id = :userId AND tenant_id = :tenantId
            """;
        
        int deleted = jdbc.update(sql, Map.of(
            "userId", UUID.fromString(userId),
            "tenantId", tenantId
        ));
        
        if (deleted == 0) {
            throw new IllegalArgumentException("User not found or not in tenant");
        }
    }

    @Transactional
    public void deleteInvite(String tenantId, String inviteId) {
        String sql = """
            DELETE FROM tenant_invites
            WHERE id = :inviteId AND tenant_id = :tenantId
            """;
        
        int deleted = jdbc.update(sql, Map.of(
            "inviteId", UUID.fromString(inviteId),
            "tenantId", tenantId
        ));
        
        if (deleted == 0) {
            throw new IllegalArgumentException("Invite not found");
        }
    }
}

