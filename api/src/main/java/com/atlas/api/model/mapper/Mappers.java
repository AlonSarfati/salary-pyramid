package com.atlas.api.model.mapper;

import com.atlas.api.model.dto.*;
import com.atlas.engine.model.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

public class Mappers {

    public static Rule toRule(RuleDto dto) {
        return new Rule(
                dto.target(),
                dto.expression(),
                dto.dependsOn(),
                dto.effectiveFrom(),
                dto.effectiveTo(),
                dto.meta()
        );
    }

    public static RuleSet toRuleSet(String id, List<RuleDto> rules) {
        List<Rule> rr = rules.stream().map(Mappers::toRule).toList();
        return new RuleSet(id, rr);
    }

    public static EvalContext toEvalContext(LocalDate date, EmployeeInput e) {
        Map<String, Object> inputs = new HashMap<>();
        // Map standard fields to CamelCase component names
        if (e.base() != null)  inputs.put("BaseSalary", e.base());
        if (e.hours() != null) inputs.put("Hours", e.hours());
        if (e.rate() != null)  inputs.put("Rate", e.rate());
        if (e.sales() != null) inputs.put("Sales", e.sales());
        if (e.performance() != null) inputs.put("PerformanceRating", e.performance());
        if (e.yearsOfService() != null) inputs.put("YearsOfService", e.yearsOfService());
        if (e.hasFamily() != null) inputs.put("HasFamily", e.hasFamily());
        if (e.isManager() != null) inputs.put("IsManager", e.isManager());
        if (e.department() != null) inputs.put("Department", e.department());
        if (e.status() != null) inputs.put("Status", e.status());
        
        // Map any additional fields from extra to CamelCase
        if (e.extra() != null) {
            for (Map.Entry<String, Object> entry : e.extra().entrySet()) {
                String key = entry.getKey();
                // Keys from extra are already in CamelCase (e.g., "Role"), so use as-is
                inputs.put(key, entry.getValue());
            }
        }
        return new EvalContext(inputs, date);
    }
    
    /**
     * Convert a key to CamelCase (first letter uppercase, rest preserved).
     */
    private static String toCamelCase(String key) {
        if (key == null || key.isEmpty()) {
            return key;
        }
        // Convert first letter to uppercase
        return key.substring(0, 1).toUpperCase() + key.substring(1);
    }

    public static SimEmployeeResponse toResponse(EvaluationResult r) {
        Map<String, BigDecimal> components = new LinkedHashMap<>();
        Map<String, SimEmployeeResponse.ComponentTrace> traces = new LinkedHashMap<>();
        
        r.components().forEach((k, v) -> {
            components.put(k, v.amount());
            Trace trace = v.trace();
            if (trace != null) {
                traces.put(k, new SimEmployeeResponse.ComponentTrace(
                    trace.component(),
                    trace.steps(),
                    trace.finalLine()
                ));
            }
        });
        
        return new SimEmployeeResponse(components, r.total(), traces);
    }

    /**
     * Convert employee data map to EmployeeInput
     */
    public static EmployeeInput toEmployeeInput(String employeeId, Map<String, Object> data) {
        // Extract standard fields
        Object base = data.get("base") != null ? data.get("base") : data.get("BaseSalary");
        Object hours = data.get("hours") != null ? data.get("hours") : data.get("Hours");
        Object rate = data.get("rate") != null ? data.get("rate") : data.get("Rate");
        Object sales = data.get("sales") != null ? data.get("sales") : data.get("Sales");
        Object performance = data.get("performance") != null ? data.get("performance") : data.get("PerformanceRating");
        Object yearsOfService = data.get("yearsOfService") != null ? data.get("yearsOfService") : data.get("YearsOfService");
        Object hasFamily = data.get("hasFamily") != null ? data.get("hasFamily") : data.get("HasFamily");
        Object isManager = data.get("isManager") != null ? data.get("isManager") : data.get("IsManager");
        Object department = data.get("department") != null ? data.get("department") : data.get("Department");
        Object status = data.get("status") != null ? data.get("status") : data.get("Status");
        
        // Build extra map with remaining fields
        Map<String, Object> extra = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : data.entrySet()) {
            String key = entry.getKey();
            // Skip standard fields
            if (!key.equals("base") && !key.equals("BaseSalary") &&
                !key.equals("hours") && !key.equals("Hours") &&
                !key.equals("rate") && !key.equals("Rate") &&
                !key.equals("sales") && !key.equals("Sales") &&
                !key.equals("performance") && !key.equals("PerformanceRating") &&
                !key.equals("yearsOfService") && !key.equals("YearsOfService") &&
                !key.equals("hasFamily") && !key.equals("HasFamily") &&
                !key.equals("isManager") && !key.equals("IsManager") &&
                !key.equals("department") && !key.equals("Department") &&
                !key.equals("status") && !key.equals("Status")) {
                extra.put(key, entry.getValue());
            }
        }
        
        return new EmployeeInput(
            employeeId,
            base != null ? convertToNumber(base) : null,
            hours != null ? convertToNumber(hours) : null,
            rate != null ? convertToNumber(rate) : null,
            sales != null ? convertToNumber(sales) : null,
            performance != null ? convertToNumber(performance) : null,
            yearsOfService != null ? convertToNumber(yearsOfService) : null,
            hasFamily != null ? convertToNumber(hasFamily) : null,
            isManager != null ? convertToNumber(isManager) : null,
            department != null ? department.toString() : null,
            status != null ? status.toString() : null,
            extra.isEmpty() ? null : extra
        );
    }
    
    private static BigDecimal convertToNumber(Object value) {
        if (value instanceof Number) {
            return BigDecimal.valueOf(((Number) value).doubleValue());
        }
        if (value instanceof String) {
            try {
                return new BigDecimal((String) value);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
    
    private static Boolean convertToBoolean(Object value) {
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        if (value instanceof String) {
            return Boolean.parseBoolean((String) value);
        }
        if (value instanceof Number) {
            return ((Number) value).intValue() != 0;
        }
        return null;
    }
}
