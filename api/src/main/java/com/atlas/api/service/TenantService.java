package com.atlas.api.service;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class TenantService {
    private final NamedParameterJdbcTemplate jdbc;

    public TenantService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * List all tenants
     */
    public List<TenantDto> listTenants() {
        String sql = """
            SELECT tenant_id, name, status, created_at, updated_at
            FROM tenant
            ORDER BY name
            """;
        
        return jdbc.query(sql, Map.of(), (rs, rowNum) -> 
            new TenantDto(
                rs.getString("tenant_id"),
                rs.getString("name"),
                rs.getString("status"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant()
            )
        );
    }

    /**
     * Get a specific tenant by ID
     */
    public Optional<TenantDto> getTenant(String tenantId) {
        String sql = """
            SELECT tenant_id, name, status, created_at, updated_at
            FROM tenant
            WHERE tenant_id = :id
            """;
        
        List<TenantDto> tenants = jdbc.query(sql, Map.of("id", tenantId),
            (rs, rowNum) -> new TenantDto(
                rs.getString("tenant_id"),
                rs.getString("name"),
                rs.getString("status"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant()
            ));
        
        return tenants.stream().findFirst();
    }

    /**
     * Create a new tenant
     */
    public TenantDto createTenant(String tenantId, String name, String status) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("tenantId is required");
        }
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        if (status == null || (!status.equals("ACTIVE") && !status.equals("INACTIVE"))) {
            throw new IllegalArgumentException("status must be ACTIVE or INACTIVE");
        }

        String sql = """
            INSERT INTO tenant (tenant_id, name, status, created_at, updated_at)
            VALUES (:id, :name, :status, now(), now())
            ON CONFLICT (tenant_id) DO UPDATE
            SET name = :name, status = :status, updated_at = now()
            RETURNING tenant_id, name, status, created_at, updated_at
            """;
        
        Map<String, Object> result = jdbc.queryForMap(sql, Map.of(
            "id", tenantId,
            "name", name,
            "status", status
        ));
        
        return new TenantDto(
            (String) result.get("tenant_id"),
            (String) result.get("name"),
            (String) result.get("status"),
            ((java.sql.Timestamp) result.get("created_at")).toInstant(),
            ((java.sql.Timestamp) result.get("updated_at")).toInstant()
        );
    }

    /**
     * Update a tenant's name and/or status
     */
    public Optional<TenantDto> updateTenant(String tenantId, String name, String status) {
        if (name == null && status == null) {
            throw new IllegalArgumentException("name or status must be provided");
        }
        if (status != null && !status.equals("ACTIVE") && !status.equals("INACTIVE")) {
            throw new IllegalArgumentException("status must be ACTIVE or INACTIVE");
        }

        // Build dynamic update query
        StringBuilder sql = new StringBuilder("UPDATE tenant SET updated_at = now()");
        Map<String, Object> params = new java.util.HashMap<>(Map.of("id", tenantId));
        
        if (name != null) {
            sql.append(", name = :name");
            params.put("name", name);
        }
        if (status != null) {
            sql.append(", status = :status");
            params.put("status", status);
        }
        
        sql.append(" WHERE tenant_id = :id RETURNING tenant_id, name, status, created_at, updated_at");
        
        List<TenantDto> tenants = jdbc.query(sql.toString(), params,
            (rs, rowNum) -> new TenantDto(
                rs.getString("tenant_id"),
                rs.getString("name"),
                rs.getString("status"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant()
            ));
        
        return tenants.stream().findFirst();
    }

    /**
     * Deactivate a tenant (soft delete)
     */
    public boolean deactivateTenant(String tenantId) {
        String sql = """
            UPDATE tenant
            SET status = 'INACTIVE', updated_at = now()
            WHERE tenant_id = :id
            """;
        
        int updated = jdbc.update(sql, Map.of("id", tenantId));
        return updated > 0;
    }

    /**
     * DTO for tenant data
     */
    public record TenantDto(
        String tenantId,
        String name,
        String status,
        Instant createdAt,
        Instant updatedAt
    ) {
        public Map<String, Object> toMap() {
            return Map.of(
                "tenantId", tenantId,
                "name", name,
                "status", status,
                "createdAt", createdAt.toString(),
                "updatedAt", updatedAt.toString()
            );
        }
    }
}

