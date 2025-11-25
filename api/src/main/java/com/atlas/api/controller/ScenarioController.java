package com.atlas.api.controller;

import com.atlas.api.service.ScenarioService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/scenarios")
public class ScenarioController {
    private final ScenarioService scenarioService;

    public ScenarioController(ScenarioService scenarioService) {
        this.scenarioService = scenarioService;
    }

    /**
     * List all scenarios for a tenant
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listScenarios(
            @RequestParam String tenantId) {
        List<ScenarioService.ScenarioDto> scenarios = scenarioService.listScenarios(tenantId);
        List<Map<String, Object>> response = scenarios.stream()
            .map(ScenarioService.ScenarioDto::toMap)
            .toList();
        return ResponseEntity.ok(response);
    }

    /**
     * Get a specific scenario
     */
    @GetMapping("/{scenarioId}")
    public ResponseEntity<Map<String, Object>> getScenario(
            @RequestParam String tenantId,
            @PathVariable String scenarioId) {
        return scenarioService.getScenario(tenantId, scenarioId)
            .map(scenario -> ResponseEntity.ok(scenario.toMap()))
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Create a new scenario
     */
    @PostMapping
    public ResponseEntity<?> createScenario(@RequestBody Map<String, Object> body) {
        try {
            String tenantId = (String) body.get("tenantId");
            String name = (String) body.get("name");
            String rulesetId = (String) body.get("rulesetId");
            String payMonth = (String) body.get("payMonth");
            @SuppressWarnings("unchecked")
            Map<String, Object> inputData = (Map<String, Object>) body.getOrDefault("inputData", Map.of());
            @SuppressWarnings("unchecked")
            Map<String, Object> resultData = (Map<String, Object>) body.getOrDefault("resultData", Map.of());
            String simulationType = (String) body.getOrDefault("simulationType", "single");
            
            if (tenantId == null || tenantId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "tenantId is required"));
            }
            if (name == null || name.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "name is required"));
            }
            if (rulesetId == null || rulesetId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "rulesetId is required"));
            }
            if (payMonth == null || payMonth.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "payMonth is required"));
            }
            
            ScenarioService.ScenarioDto scenario = scenarioService.createScenario(
                tenantId, name, rulesetId, payMonth, inputData, resultData, simulationType);
            return ResponseEntity.ok(scenario.toMap());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            String errorMessage = e.getMessage();
            if (e.getCause() != null) {
                errorMessage += " (Cause: " + e.getCause().getMessage() + ")";
            }
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to create scenario: " + errorMessage));
        }
    }

    /**
     * Update a scenario
     */
    @PutMapping("/{scenarioId}")
    public ResponseEntity<?> updateScenario(
            @RequestParam String tenantId,
            @PathVariable String scenarioId,
            @RequestBody Map<String, Object> body) {
        try {
            String name = (String) body.get("name");
            @SuppressWarnings("unchecked")
            Map<String, Object> inputData = (Map<String, Object>) body.get("inputData");
            @SuppressWarnings("unchecked")
            Map<String, Object> resultData = (Map<String, Object>) body.get("resultData");
            
            return scenarioService.updateScenario(tenantId, scenarioId, name, inputData, resultData)
                .map(scenario -> ResponseEntity.ok(scenario.toMap()))
                .orElse(ResponseEntity.notFound().build());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to update scenario: " + e.getMessage()));
        }
    }

    /**
     * Delete a scenario
     */
    @DeleteMapping("/{scenarioId}")
    public ResponseEntity<Map<String, String>> deleteScenario(
            @RequestParam String tenantId,
            @PathVariable String scenarioId) {
        boolean deleted = scenarioService.deleteScenario(tenantId, scenarioId);
        
        if (!deleted) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(Map.of("status", "deleted", "scenarioId", scenarioId));
    }
}

