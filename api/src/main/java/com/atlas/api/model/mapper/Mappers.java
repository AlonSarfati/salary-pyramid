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
        r.components().forEach((k,v) -> components.put(k, v.amount()));
        return new SimEmployeeResponse(components, r.total());
    }
}
