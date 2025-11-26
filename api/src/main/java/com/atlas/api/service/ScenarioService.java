package com.atlas.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class ScenarioService {
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ScenarioService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * List all scenarios for a tenant
     */
    public List<ScenarioDto> listScenarios(String tenantId) {
        String sql = """
            SELECT scenario_id, tenant_id, name, ruleset_id, pay_month, 
                   input_data, result_data, simulation_type, created_at, updated_at
            FROM scenario
            WHERE tenant_id = :tenantId
            ORDER BY created_at DESC
            """;
        
        return jdbc.query(sql, Map.of("tenantId", tenantId), (rs, rowNum) -> {
            try {
                String inputJson = rs.getString("input_data");
                String resultJson = rs.getString("result_data");
                Map<String, Object> inputData = objectMapper.readValue(inputJson, Map.class);
                Map<String, Object> resultData = objectMapper.readValue(resultJson, Map.class);
                
                return new ScenarioDto(
                    rs.getString("scenario_id"),
                    rs.getString("tenant_id"),
                    rs.getString("name"),
                    rs.getString("ruleset_id"),
                    rs.getString("pay_month"),
                    inputData,
                    resultData,
                    rs.getString("simulation_type"),
                    rs.getTimestamp("created_at").toInstant(),
                    rs.getTimestamp("updated_at").toInstant()
                );
            } catch (Exception e) {
                throw new RuntimeException("Failed to parse scenario data", e);
            }
        });
    }

    /**
     * Get a specific scenario by ID
     */
    public Optional<ScenarioDto> getScenario(String tenantId, String scenarioId) {
        String sql = """
            SELECT scenario_id, tenant_id, name, ruleset_id, pay_month, 
                   input_data, result_data, simulation_type, created_at, updated_at
            FROM scenario
            WHERE tenant_id = :tenantId AND scenario_id = :scenarioId
            """;
        
        List<ScenarioDto> scenarios = jdbc.query(
            sql, 
            Map.of("tenantId", tenantId, "scenarioId", scenarioId),
            (rs, rowNum) -> {
                try {
                    String inputJson = rs.getString("input_data");
                    String resultJson = rs.getString("result_data");
                    Map<String, Object> inputData = objectMapper.readValue(inputJson, Map.class);
                    Map<String, Object> resultData = objectMapper.readValue(resultJson, Map.class);
                    
                    return new ScenarioDto(
                        rs.getString("scenario_id"),
                        rs.getString("tenant_id"),
                        rs.getString("name"),
                        rs.getString("ruleset_id"),
                        rs.getString("pay_month"),
                        inputData,
                        resultData,
                        rs.getString("simulation_type"),
                        rs.getTimestamp("created_at").toInstant(),
                        rs.getTimestamp("updated_at").toInstant()
                    );
                } catch (Exception e) {
                    throw new RuntimeException("Failed to parse scenario data", e);
                }
            }
        );
        
        return scenarios.stream().findFirst();
    }

    /**
     * Create a new scenario
     */
    public ScenarioDto createScenario(String tenantId, String name, String rulesetId, 
                                      String payMonth, Map<String, Object> inputData, 
                                      Map<String, Object> resultData, String simulationType) {
        String scenarioId = UUID.randomUUID().toString();
        
        try {
            String inputJson = objectMapper.writeValueAsString(inputData);
            String resultJson = objectMapper.writeValueAsString(resultData);

            // If no name provided, generate a default one based on scenario ID
            String finalName;
            if (name == null || name.isBlank()) {
                String shortId = scenarioId.substring(0, 8);
                finalName = "Scenario " + shortId;
            } else {
                finalName = name;
            }
            
            String sql = """
                INSERT INTO scenario (scenario_id, tenant_id, name, ruleset_id, pay_month, 
                                     input_data, result_data, simulation_type, created_at, updated_at)
                VALUES (:scenarioId, :tenantId, :name, :rulesetId, :payMonth, 
                        :inputData::jsonb, :resultData::jsonb, :simulationType, now(), now())
                """;
            
            jdbc.update(sql, Map.of(
                "scenarioId", scenarioId,
                "tenantId", tenantId,
                "name", finalName,
                "rulesetId", rulesetId,
                "payMonth", payMonth,
                "inputData", inputJson,
                "resultData", resultJson,
                "simulationType", simulationType != null ? simulationType : "single"
            ));
            
            return getScenario(tenantId, scenarioId)
                .orElseThrow(() -> new RuntimeException("Failed to retrieve created scenario"));
        } catch (Exception e) {
            throw new RuntimeException("Failed to create scenario", e);
        }
    }

    /**
     * Update an existing scenario
     */
    public Optional<ScenarioDto> updateScenario(String tenantId, String scenarioId, 
                                               String name, Map<String, Object> inputData, 
                                               Map<String, Object> resultData) {
        try {
            String inputJson = objectMapper.writeValueAsString(inputData);
            String resultJson = objectMapper.writeValueAsString(resultData);
            
            String sql = """
                UPDATE scenario
                SET name = :name,
                    input_data = :inputData::jsonb,
                    result_data = :resultData::jsonb,
                    updated_at = now()
                WHERE tenant_id = :tenantId AND scenario_id = :scenarioId
                """;
            
            int updated = jdbc.update(sql, Map.of(
                "tenantId", tenantId,
                "scenarioId", scenarioId,
                "name", name,
                "inputData", inputJson,
                "resultData", resultJson
            ));
            
            if (updated > 0) {
                return getScenario(tenantId, scenarioId);
            }
            return Optional.empty();
        } catch (Exception e) {
            throw new RuntimeException("Failed to update scenario", e);
        }
    }

    /**
     * Delete a scenario
     */
    public boolean deleteScenario(String tenantId, String scenarioId) {
        String sql = """
            DELETE FROM scenario
            WHERE tenant_id = :tenantId AND scenario_id = :scenarioId
            """;
        
        int deleted = jdbc.update(sql, Map.of("tenantId", tenantId, "scenarioId", scenarioId));
        return deleted > 0;
    }

    /**
     * Delete ALL scenarios for a tenant (clear history)
     */
    public int deleteAllScenarios(String tenantId) {
        String sql = """
            DELETE FROM scenario
            WHERE tenant_id = :tenantId
            """;
        return jdbc.update(sql, Map.of("tenantId", tenantId));
    }

    /**
     * DTO for scenario data
     */
    public record ScenarioDto(
        String scenarioId,
        String tenantId,
        String name,
        String rulesetId,
        String payMonth,
        Map<String, Object> inputData,
        Map<String, Object> resultData,
        String simulationType,
        Instant createdAt,
        Instant updatedAt
    ) {
        public Map<String, Object> toMap() {
            return Map.of(
                "scenarioId", scenarioId,
                "tenantId", tenantId,
                "name", name,
                "rulesetId", rulesetId,
                "payMonth", payMonth,
                "inputData", inputData,
                "resultData", resultData,
                "simulationType", simulationType,
                "createdAt", createdAt.toString(),
                "updatedAt", updatedAt.toString()
            );
        }
    }
}

