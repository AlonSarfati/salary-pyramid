package com.atlas.api.controller;

import com.atlas.api.service.OptimizerService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/optimizer")
public class OptimizerController {
    private final OptimizerService optimizerService;

    public OptimizerController(OptimizerService optimizerService) {
        this.optimizerService = optimizerService;
    }

    /**
     * POST /optimizer/optimize
     * Run optimization to find a raise percentage that fits within the extra budget.
     * 
     * Request body:
     * {
     *   "tenantId": "default",
     *   "rulesetId": "ruleset-123",
     *   "extraBudget": 1300000,
     *   "strategy": "FLAT_RAISE_ON_BASE",
     *   "targetComponent": "Base",
     *   "asOfDate": "2024-01-01" (optional, defaults to today)
     * }
     */
    @PostMapping("/optimize")
    public ResponseEntity<?> optimize(@RequestBody Map<String, Object> request) {
        try {
            String tenantId = (String) request.get("tenantId");
            String rulesetId = (String) request.get("rulesetId");
            Object extraBudgetObj = request.get("extraBudget");
            String strategy = (String) request.getOrDefault("strategy", "FLAT_RAISE_ON_BASE");
            String targetComponent = (String) request.getOrDefault("targetComponent", "Base");
            String targetGroup = (String) request.get("targetGroup");
            String newComponentName = (String) request.get("newComponentName");
            String targetTable = (String) request.get("targetTable");
            String tableComponent = (String) request.get("tableComponent");
            Object asOfDateObj = request.get("asOfDate");

            if (tenantId == null || tenantId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "tenantId is required"));
            }
            if (rulesetId == null || rulesetId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "rulesetId is required"));
            }
            if (extraBudgetObj == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "extraBudget is required"));
            }

            // Parse extraBudget
            BigDecimal extraBudget;
            if (extraBudgetObj instanceof Number) {
                extraBudget = BigDecimal.valueOf(((Number) extraBudgetObj).doubleValue());
            } else if (extraBudgetObj instanceof String) {
                extraBudget = new BigDecimal((String) extraBudgetObj);
            } else {
                return ResponseEntity.badRequest().body(Map.of("error", "extraBudget must be a number"));
            }

            if (extraBudget.compareTo(BigDecimal.ZERO) <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "extraBudget must be positive"));
            }

            // Parse asOfDate
            LocalDate asOfDate = null;
            if (asOfDateObj != null) {
                if (asOfDateObj instanceof String) {
                    asOfDate = LocalDate.parse((String) asOfDateObj);
                } else {
                    return ResponseEntity.badRequest().body(Map.of("error", "asOfDate must be a date string (YYYY-MM-DD)"));
                }
            }

            OptimizerService.OptimizationResultDto result = optimizerService.optimize(
                tenantId, rulesetId, extraBudget, strategy, targetComponent, 
                targetGroup, newComponentName, targetTable, tableComponent, asOfDate
            );

            // Convert to response map
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("rulesetId", result.rulesetId());
            response.put("rulesetName", result.rulesetName());
            response.put("extraBudget", result.extraBudget().toPlainString());
            response.put("strategy", result.strategy());
            response.put("asOfDate", result.asOfDate().toString());
            response.put("calculatedAt", result.calculatedAt().toInstant().toString());
            
            // Adjustment plan (renamed from raisePlan for clarity)
            Map<String, Object> adjustmentPlan = new LinkedHashMap<>();
            adjustmentPlan.put("strategy", result.adjustmentPlan().strategy());
            if (result.adjustmentPlan().targetComponent() != null) {
                adjustmentPlan.put("targetComponent", result.adjustmentPlan().targetComponent());
            }
            if (result.adjustmentPlan().targetGroup() != null) {
                adjustmentPlan.put("targetGroup", result.adjustmentPlan().targetGroup());
            }
            if (result.adjustmentPlan().newComponentName() != null) {
                adjustmentPlan.put("newComponentName", result.adjustmentPlan().newComponentName());
            }
            if (result.adjustmentPlan().targetTable() != null) {
                adjustmentPlan.put("targetTable", result.adjustmentPlan().targetTable());
            }
            if (result.adjustmentPlan().tableComponent() != null) {
                adjustmentPlan.put("tableComponent", result.adjustmentPlan().tableComponent());
            }
            if (result.adjustmentPlan().percentage() != null) {
                adjustmentPlan.put("percentage", result.adjustmentPlan().percentage().toPlainString());
            }
            if (result.adjustmentPlan().scalarOrFactor() != null) {
                adjustmentPlan.put("scalarOrFactor", result.adjustmentPlan().scalarOrFactor().toPlainString());
            }
            adjustmentPlan.put("description", result.adjustmentPlan().description());
            response.put("raisePlan", adjustmentPlan); // Keep "raisePlan" key for backward compatibility
            response.put("adjustmentPlan", adjustmentPlan); // Also add new key
            
            // Baseline summary
            Map<String, Object> baseline = new LinkedHashMap<>();
            baseline.put("totalCost", result.baseline().totalCost().toPlainString());
            baseline.put("avgPerEmployee", result.baseline().avgPerEmployee().toPlainString());
            baseline.put("employeeCount", result.baseline().employeeCount());
            baseline.put("componentTotals", result.baseline().componentTotals().entrySet().stream()
                .collect(LinkedHashMap::new, 
                    (m, e) -> m.put(e.getKey(), e.getValue().toPlainString()),
                    (m1, m2) -> { m1.putAll(m2); }));
            response.put("baseline", baseline);
            
            // Optimized summary
            Map<String, Object> optimized = new LinkedHashMap<>();
            optimized.put("totalCost", result.optimized().totalCost().toPlainString());
            optimized.put("avgPerEmployee", result.optimized().avgPerEmployee().toPlainString());
            optimized.put("employeeCount", result.optimized().employeeCount());
            optimized.put("componentTotals", result.optimized().componentTotals().entrySet().stream()
                .collect(LinkedHashMap::new,
                    (m, e) -> m.put(e.getKey(), e.getValue().toPlainString()),
                    (m1, m2) -> { m1.putAll(m2); }));
            response.put("optimized", optimized);
            
            // Calculate extra cost used
            BigDecimal extraCostUsed = result.optimized().totalCost().subtract(result.baseline().totalCost());
            response.put("extraCostUsed", extraCostUsed.toPlainString());
            
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            String errorMessage = e.getMessage();
            if (e.getCause() != null) {
                errorMessage += " (Cause: " + e.getCause().getMessage() + ")";
            }
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to optimize: " + errorMessage));
        }
    }
}

