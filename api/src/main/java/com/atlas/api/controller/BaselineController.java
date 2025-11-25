package com.atlas.api.controller;

import com.atlas.api.service.BaselineService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/baseline")
public class BaselineController {
    private final BaselineService baselineService;

    public BaselineController(BaselineService baselineService) {
        this.baselineService = baselineService;
    }

    /**
     * GET /baseline/summary
     * Get baseline payroll summary
     */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary(
            @RequestParam String tenantId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOfDate,
            @RequestParam(required = false) String rulesetId) {
        if (asOfDate == null) {
            asOfDate = LocalDate.now();
        }
        
        BaselineService.BaselineSummaryDto summary = baselineService.calculateBaselineSummary(tenantId, asOfDate, rulesetId);
        
        return ResponseEntity.ok(Map.of(
            "totalPayroll", summary.totalPayroll(),
            "avgPerEmployee", summary.avgPerEmployee(),
            "employeeCount", summary.employeeCount(),
            "activeRulesetName", summary.activeRulesetName(),
            "activeRulesetId", summary.activeRulesetId(),
            "asOfDate", summary.asOfDate().toString(),
            "calculatedAt", summary.calculatedAt().toString()
        ));
    }

    /**
     * GET /baseline/trend
     * Get payroll trend (last 12 months)
     */
    @GetMapping("/trend")
    public ResponseEntity<List<Map<String, Object>>> getTrend(
            @RequestParam String tenantId) {
        List<BaselineService.BaselineTrendPointDto> trend = baselineService.getPayrollTrend(tenantId);
        
        List<Map<String, Object>> response = new ArrayList<>();
        for (BaselineService.BaselineTrendPointDto point : trend) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("month", point.month());
            map.put("totalPayroll", point.totalPayroll());
            response.add(map);
        }
        
        return ResponseEntity.ok(response);
    }

    /**
     * GET /baseline/breakdown
     * Get payroll composition breakdown
     */
    @GetMapping("/breakdown")
    public ResponseEntity<Map<String, Object>> getBreakdown(
            @RequestParam String tenantId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOfDate,
            @RequestParam(required = false) String rulesetId) {
        if (asOfDate == null) {
            asOfDate = LocalDate.now();
        }
        
        BaselineService.BaselineBreakdownDto breakdown = baselineService.getPayrollBreakdown(tenantId, asOfDate, rulesetId);
        
        Map<String, Object> categoryMap = new java.util.LinkedHashMap<>();
        breakdown.categoryTotals().forEach((category, amount) -> {
            categoryMap.put(category, amount);
        });
        
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("categoryTotals", categoryMap);
        response.put("calculatedAt", breakdown.calculatedAt());
        
        return ResponseEntity.ok(response);
    }

    /**
     * GET /baseline/simulations/count
     * Get total count of simulations
     */
    @GetMapping("/simulations/count")
    public ResponseEntity<Map<String, Object>> getSimulationCount(
            @RequestParam String tenantId) {
        long count = baselineService.getSimulationCount(tenantId);
        return ResponseEntity.ok(Map.of("count", count));
    }

    /**
     * GET /baseline/full-simulation
     * Run full simulation for all employees using a specific ruleset
     */
    @GetMapping("/full-simulation")
    public ResponseEntity<Map<String, Object>> runFullSimulation(
            @RequestParam String tenantId,
            @RequestParam String rulesetId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOfDate) {
        if (asOfDate == null) {
            asOfDate = LocalDate.now();
        }
        
        BaselineService.FullSimulationResultDto result = baselineService.runFullSimulation(tenantId, rulesetId, asOfDate);
        
        // Convert to response map
        List<Map<String, Object>> employeeResults = result.employeeResults().stream()
            .map(emp -> {
                Map<String, Object> empMap = new LinkedHashMap<>();
                empMap.put("employeeId", emp.employeeId());
                empMap.put("employeeName", emp.employeeName());
                empMap.put("total", emp.total());
                Map<String, Object> components = new LinkedHashMap<>();
                emp.components().forEach((k, v) -> components.put(k, v));
                empMap.put("components", components);
                return empMap;
            })
            .toList();
        
        Map<String, Object> componentTotals = new LinkedHashMap<>();
        result.componentTotals().forEach((k, v) -> componentTotals.put(k, v));
        
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("rulesetId", result.rulesetId());
        response.put("rulesetName", result.rulesetName());
        response.put("asOfDate", result.asOfDate().toString());
        response.put("employeeResults", employeeResults);
        response.put("componentTotals", componentTotals);
        response.put("grandTotal", result.grandTotal());
        response.put("employeeCount", result.employeeCount());
        response.put("calculatedAt", result.calculatedAt());
        
        return ResponseEntity.ok(response);
    }
}

