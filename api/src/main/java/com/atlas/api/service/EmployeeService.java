package com.atlas.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class EmployeeService {
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public EmployeeService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * List all employees for a tenant
     */
    public List<EmployeeDto> listEmployees(String tenantId) {
        String sql = """
            SELECT employee_id, tenant_id, name, data_json, created_at, updated_at
            FROM employee
            WHERE tenant_id = :tenantId
            ORDER BY name NULLS LAST, employee_id
            """;
        
        return jdbc.query(sql, Map.of("tenantId", tenantId), (rs, rowNum) -> {
            try {
                String dataJson = rs.getString("data_json");
                Map<String, Object> data = objectMapper.readValue(dataJson, Map.class);
                return new EmployeeDto(
                    rs.getString("employee_id"),
                    rs.getString("tenant_id"),
                    rs.getString("name"),
                    data,
                    rs.getTimestamp("created_at").toInstant(),
                    rs.getTimestamp("updated_at").toInstant()
                );
            } catch (Exception e) {
                throw new RuntimeException("Failed to parse employee data", e);
            }
        });
    }

    /**
     * Get a specific employee by ID
     */
    public Optional<EmployeeDto> getEmployee(String tenantId, String employeeId) {
        String sql = """
            SELECT employee_id, tenant_id, name, data_json, created_at, updated_at
            FROM employee
            WHERE tenant_id = :tenantId AND employee_id = :employeeId
            """;
        
        List<EmployeeDto> employees = jdbc.query(sql, Map.of("tenantId", tenantId, "employeeId", employeeId),
            (rs, rowNum) -> {
                try {
                    String dataJson = rs.getString("data_json");
                    Map<String, Object> data = objectMapper.readValue(dataJson, Map.class);
                    return new EmployeeDto(
                        rs.getString("employee_id"),
                        rs.getString("tenant_id"),
                        rs.getString("name"),
                        data,
                        rs.getTimestamp("created_at").toInstant(),
                        rs.getTimestamp("updated_at").toInstant()
                    );
                } catch (Exception e) {
                    throw new RuntimeException("Failed to parse employee data", e);
                }
            });
        
        return employees.stream().findFirst();
    }

    /**
     * Create a new employee
     */
    public EmployeeDto createEmployee(String tenantId, String employeeId, String name, Map<String, Object> data) {
        if (employeeId == null || employeeId.isBlank()) {
            throw new IllegalArgumentException("employeeId is required");
        }
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("tenantId is required");
        }
        if (data == null) {
            data = Map.of();
        }

        try {
            String dataJson = objectMapper.writeValueAsString(data);
            
            // Use MapSqlParameterSource to handle null values properly
            var params = new org.springframework.jdbc.core.namedparam.MapSqlParameterSource()
                    .addValue("id", employeeId)
                    .addValue("tenantId", tenantId)
                    .addValue("name", name) // Can be null
                    .addValue("data", dataJson);
            
            String sql = """
                INSERT INTO employee (employee_id, tenant_id, name, data_json, created_at, updated_at)
                VALUES (:id, :tenantId, :name, CAST(:data AS jsonb), now(), now())
                ON CONFLICT (employee_id, tenant_id) DO UPDATE
                SET name = :name, data_json = CAST(:data AS jsonb), updated_at = now()
                RETURNING employee_id, tenant_id, name, data_json::text, created_at, updated_at
                """;
            
            List<EmployeeDto> results = jdbc.query(sql, params, (rs, rowNum) -> {
                try {
                    String resultDataJson = rs.getString("data_json");
                    Map<String, Object> resultData = objectMapper.readValue(resultDataJson, Map.class);
                    return new EmployeeDto(
                        rs.getString("employee_id"),
                        rs.getString("tenant_id"),
                        rs.getString("name"),
                        resultData,
                        rs.getTimestamp("created_at").toInstant(),
                        rs.getTimestamp("updated_at").toInstant()
                    );
                } catch (Exception e) {
                    throw new RuntimeException("Failed to parse employee data", e);
                }
            });
            
            if (results.isEmpty()) {
                throw new RuntimeException("Failed to create employee: no result returned");
            }
            
            return results.get(0);
        } catch (RuntimeException e) {
            // If it's already a RuntimeException with a message, preserve it
            if (e.getMessage() != null && !e.getMessage().equals("Failed to create employee")) {
                throw e;
            }
            throw new RuntimeException("Failed to create employee: " + e.getClass().getSimpleName() + " - " + e.getMessage(), e);
        } catch (Exception e) {
            throw new RuntimeException("Failed to create employee: " + e.getClass().getSimpleName() + " - " + e.getMessage(), e);
        }
    }

    /**
     * Update an employee
     */
    public Optional<EmployeeDto> updateEmployee(String tenantId, String employeeId, String name, Map<String, Object> data) {
        try {
            String dataJson = data != null ? objectMapper.writeValueAsString(data) : null;
            
            StringBuilder sql = new StringBuilder("UPDATE employee SET updated_at = now()");
            Map<String, Object> params = new java.util.HashMap<>(Map.of("tenantId", tenantId, "id", employeeId));
            
            if (name != null) {
                sql.append(", name = :name");
                params.put("name", name);
            }
            if (dataJson != null) {
                sql.append(", data_json = CAST(:data AS jsonb)");
                params.put("data", dataJson);
            }
            
            sql.append(" WHERE tenant_id = :tenantId AND employee_id = :id RETURNING employee_id, tenant_id, name, data_json::text, created_at, updated_at");
            
            List<EmployeeDto> employees = jdbc.query(sql.toString(), params,
                (rs, rowNum) -> {
                    try {
                        String resultDataJson = rs.getString("data_json");
                        Map<String, Object> resultData = objectMapper.readValue(resultDataJson, Map.class);
                        return new EmployeeDto(
                            rs.getString("employee_id"),
                            rs.getString("tenant_id"),
                            rs.getString("name"),
                            resultData,
                            rs.getTimestamp("created_at").toInstant(),
                            rs.getTimestamp("updated_at").toInstant()
                        );
                    } catch (Exception e) {
                        throw new RuntimeException("Failed to parse employee data", e);
                    }
                });
            
            return employees.stream().findFirst();
        } catch (Exception e) {
            throw new RuntimeException("Failed to update employee", e);
        }
    }

    /**
     * Delete an employee
     */
    public boolean deleteEmployee(String tenantId, String employeeId) {
        String sql = """
            DELETE FROM employee
            WHERE tenant_id = :tenantId AND employee_id = :employeeId
            """;
        
        int deleted = jdbc.update(sql, Map.of("tenantId", tenantId, "employeeId", employeeId));
        return deleted > 0;
    }

    /**
     * DTO for employee data
     */
    public record EmployeeDto(
        String employeeId,
        String tenantId,
        String name,
        Map<String, Object> data,
        Instant createdAt,
        Instant updatedAt
    ) {
        public Map<String, Object> toMap() {
            return Map.of(
                "employeeId", employeeId,
                "tenantId", tenantId,
                "name", name != null ? name : "",
                "data", data,
                "createdAt", createdAt.toString(),
                "updatedAt", updatedAt.toString()
            );
        }
    }
}

