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
public class AllowlistService {
    private final NamedParameterJdbcTemplate jdbc;

    public AllowlistService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record AllowlistEntry(
        UUID id,
        String email,
        String issuer,
        String subject,
        String status,
        String mode,
        String role,
        String createdBy,
        Instant createdAt,
        String notes,
        List<String> tenantIds
    ) {}

    public Optional<AllowlistEntry> findByIssuerAndSubject(String issuer, String subject) {
        String sql = """
            SELECT id, email, issuer, subject, status, mode, role, created_by, created_at, notes
            FROM access_allowlist
            WHERE issuer = :issuer AND subject = :subject
            """;
        
        var results = jdbc.query(sql, Map.of("issuer", issuer, "subject", subject), (rs, rowNum) -> {
            UUID id = (UUID) rs.getObject("id");
            List<String> tenantIds = getTenantIds(id);
            return new AllowlistEntry(
                id,
                rs.getString("email"),
                rs.getString("issuer"),
                rs.getString("subject"),
                rs.getString("status"),
                rs.getString("mode"),
                rs.getString("role"),
                rs.getString("created_by"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getString("notes"),
                tenantIds
            );
        });
        
        return results.stream().findFirst();
    }

    public Optional<AllowlistEntry> findByEmail(String email) {
        if (email == null || email.trim().isEmpty()) {
            return Optional.empty();
        }
        String normalizedEmail = email.trim().toLowerCase();
        String sql = """
            SELECT id, email, issuer, subject, status, mode, role, created_by, created_at, notes
            FROM access_allowlist
            WHERE LOWER(email) = :email AND status = 'ACTIVE'
            """;
        
        var results = jdbc.query(sql, Map.of("email", normalizedEmail), (rs, rowNum) -> {
            UUID id = (UUID) rs.getObject("id");
            List<String> tenantIds = getTenantIds(id);
            return new AllowlistEntry(
                id,
                rs.getString("email"),
                rs.getString("issuer"),
                rs.getString("subject"),
                rs.getString("status"),
                rs.getString("mode"),
                rs.getString("role"),
                rs.getString("created_by"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getString("notes"),
                tenantIds
            );
        });
        
        return results.stream().findFirst();
    }

    private List<String> getTenantIds(UUID allowlistId) {
        String sql = "SELECT tenant_id FROM allowlist_tenants WHERE allowlist_id = :id ORDER BY tenant_id";
        return jdbc.queryForList(sql, Map.of("id", allowlistId), String.class);
    }

    @Transactional
    public void bindIssuerSubject(UUID allowlistId, String issuer, String subject) {
        // Only bind if not already bound
        String checkSql = """
            SELECT issuer, subject FROM access_allowlist WHERE id = :id
            """;
        var existing = jdbc.query(checkSql, Map.of("id", allowlistId), (rs, rowNum) -> {
            // Use HashMap to handle null values (Map.of doesn't allow nulls)
            Map<String, String> row = new HashMap<>();
            row.put("issuer", rs.getString("issuer"));
            row.put("subject", rs.getString("subject"));
            return row;
        });
        
        if (!existing.isEmpty()) {
            var row = existing.get(0);
            if (row.get("issuer") == null && row.get("subject") == null) {
                String updateSql = """
                    UPDATE access_allowlist
                    SET issuer = :issuer, subject = :subject
                    WHERE id = :id
                    """;
                jdbc.update(updateSql, Map.of("id", allowlistId, "issuer", issuer, "subject", subject));
            }
        }
    }

    public List<AllowlistEntry> listAll() {
        String sql = """
            SELECT id, email, issuer, subject, status, mode, role, created_by, created_at, notes
            FROM access_allowlist
            ORDER BY created_at DESC
            """;
        
        return jdbc.query(sql, Map.of(), (rs, rowNum) -> {
            UUID id = (UUID) rs.getObject("id");
            List<String> tenantIds = getTenantIds(id);
            return new AllowlistEntry(
                id,
                rs.getString("email"),
                rs.getString("issuer"),
                rs.getString("subject"),
                rs.getString("status"),
                rs.getString("mode"),
                rs.getString("role"),
                rs.getString("created_by"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getString("notes"),
                tenantIds
            );
        });
    }

    @Transactional
    public AllowlistEntry create(String email, String mode, String role, String createdBy, String notes, List<String> tenantIds) {
        String insertSql = """
            INSERT INTO access_allowlist (email, status, mode, role, created_by, notes)
            VALUES (:email, 'ACTIVE', :mode, :role, :createdBy, :notes)
            RETURNING id, email, issuer, subject, status, mode, role, created_by, created_at, notes
            """;
        
        var created = jdbc.query(insertSql, Map.of(
            "email", email != null ? email.trim().toLowerCase() : "",
            "mode", mode,
            "role", role,
            "createdBy", createdBy != null ? createdBy : "system",
            "notes", notes != null ? notes : ""
        ), (rs, rowNum) -> {
            UUID id = (UUID) rs.getObject("id");
            // Insert tenant IDs
            if (tenantIds != null && !tenantIds.isEmpty()) {
                insertTenantIds(id, tenantIds);
            }
            return new AllowlistEntry(
                id,
                rs.getString("email"),
                rs.getString("issuer"),
                rs.getString("subject"),
                rs.getString("status"),
                rs.getString("mode"),
                rs.getString("role"),
                rs.getString("created_by"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getString("notes"),
                tenantIds != null ? tenantIds : List.of()
            );
        });
        
        return created.get(0);
    }

    @Transactional
    public void updateStatus(UUID id, String status) {
        String sql = "UPDATE access_allowlist SET status = :status WHERE id = :id";
        jdbc.update(sql, Map.of("id", id, "status", status));
    }

    @Transactional
    public void replaceTenants(UUID id, List<String> tenantIds) {
        // Delete existing
        String deleteSql = "DELETE FROM allowlist_tenants WHERE allowlist_id = :id";
        jdbc.update(deleteSql, Map.of("id", id));
        
        // Insert new
        if (tenantIds != null && !tenantIds.isEmpty()) {
            insertTenantIds(id, tenantIds);
        }
    }

    private void insertTenantIds(UUID allowlistId, List<String> tenantIds) {
        String insertSql = "INSERT INTO allowlist_tenants (allowlist_id, tenant_id) VALUES (:allowlistId, :tenantId)";
        for (String tenantId : tenantIds) {
            jdbc.update(insertSql, Map.of("allowlistId", allowlistId, "tenantId", tenantId));
        }
    }

    public Optional<AllowlistEntry> findById(UUID id) {
        String sql = """
            SELECT id, email, issuer, subject, status, mode, role, created_by, created_at, notes
            FROM access_allowlist
            WHERE id = :id
            """;
        
        var results = jdbc.query(sql, Map.of("id", id), (rs, rowNum) -> {
            UUID entryId = (UUID) rs.getObject("id");
            List<String> tenantIds = getTenantIds(entryId);
            return new AllowlistEntry(
                entryId,
                rs.getString("email"),
                rs.getString("issuer"),
                rs.getString("subject"),
                rs.getString("status"),
                rs.getString("mode"),
                rs.getString("role"),
                rs.getString("created_by"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getString("notes"),
                tenantIds
            );
        });
        
        return results.stream().findFirst();
    }
}

