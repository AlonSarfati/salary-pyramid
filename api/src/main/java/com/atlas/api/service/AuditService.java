package com.atlas.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Service for recording audit log events for tenant administrative actions.
 */
@Service
public class AuditService {
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public AuditService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.objectMapper = new ObjectMapper();
    }

    public record AuditLogEntry(
        String id,
        String tenantId,
        Instant createdAt,
        String actorUserIdentityId,
        String actorSource,
        String actionType,
        String targetType,
        String targetId,
        Map<String, Object> diffJson,
        String notes
    ) {}

    /**
     * Log an audit event
     */
    @Transactional
    public void logEvent(
        String tenantId,
        String actorUserIdentityId,
        String actorSource, // "SYSTEM_ALLOWLIST" or "TENANT_MEMBERSHIP"
        String actionType,
        String targetType, // "USER", "INVITE", "SETTINGS"
        String targetId,
        Map<String, Object> diffJson,
        String notes
    ) {
        logEvent(tenantId, actorUserIdentityId, actorSource, actionType, targetType, targetId, diffJson, notes, null);
    }
    
    /**
     * Log an audit event with correlation ID
     */
    @Transactional
    public void logEvent(
        String tenantId,
        String actorUserIdentityId,
        String actorSource,
        String actionType,
        String targetType,
        String targetId,
        Map<String, Object> diffJson,
        String notes,
        String correlationId
    ) {
        String sql = """
            INSERT INTO tenant_audit_log (
                id, tenant_id, actor_user_identity_id, actor_source,
                action_type, target_type, target_id, diff_json, notes, correlation_id
            )
            VALUES (
                :id, :tenantId, :actorUserIdentityId, :actorSource,
                :actionType, :targetType, :targetId, :diffJson::jsonb, :notes, :correlationId
            )
            """;
        
        UUID actorId = actorUserIdentityId != null ? UUID.fromString(actorUserIdentityId) : null;
        String diffJsonStr = null;
        try {
            if (diffJson != null && !diffJson.isEmpty()) {
                diffJsonStr = objectMapper.writeValueAsString(diffJson);
            }
        } catch (Exception e) {
            // If JSON serialization fails, store as empty object
            diffJsonStr = "{}";
        }
        
        jdbc.update(sql, Map.of(
            "id", UUID.randomUUID(),
            "tenantId", tenantId,
            "actorUserIdentityId", actorId,
            "actorSource", actorSource,
            "actionType", actionType,
            "targetType", targetType,
            "targetId", targetId != null ? targetId : "",
            "diffJson", diffJsonStr != null ? diffJsonStr : "{}",
            "notes", notes != null ? notes : "",
            "correlationId", correlationId != null ? correlationId : ""
        ));
    }

    /**
     * Get audit log entries for a tenant
     */
    public List<AuditLogEntry> getAuditLog(String tenantId, int limit) {
        String sql = """
            SELECT 
                id, tenant_id, created_at,
                actor_user_identity_id, actor_source,
                action_type, target_type, target_id,
                diff_json, notes
            FROM tenant_audit_log
            WHERE tenant_id = :tenantId
            ORDER BY created_at DESC
            LIMIT :limit
            """;
        
        return jdbc.query(sql, Map.of("tenantId", tenantId, "limit", limit), (rs, rowNum) -> {
            UUID actorId = rs.getObject("actor_user_identity_id", UUID.class);
            String targetId = rs.getString("target_id");
            
            // Parse diff_json
            Map<String, Object> diffJson = new HashMap<>();
            try {
                String diffJsonStr = rs.getString("diff_json");
                if (diffJsonStr != null && !diffJsonStr.isEmpty()) {
                    diffJson = objectMapper.readValue(diffJsonStr, Map.class);
                }
            } catch (Exception e) {
                // If parsing fails, use empty map
            }
            
            return new AuditLogEntry(
                rs.getObject("id", UUID.class).toString(),
                rs.getString("tenant_id"),
                rs.getTimestamp("created_at").toInstant(),
                actorId != null ? actorId.toString() : null,
                rs.getString("actor_source"),
                rs.getString("action_type"),
                rs.getString("target_type"),
                targetId != null && !targetId.isEmpty() ? targetId : null,
                diffJson,
                rs.getString("notes")
            );
        });
    }
}

