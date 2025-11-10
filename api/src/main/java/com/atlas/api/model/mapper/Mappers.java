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

    public static EvalContext toEvalContext(PeriodDto p, EmployeeInput e) {
        Map<String, BigDecimal> inputs = new HashMap<>();
        if (e.base() != null)  inputs.put("Base", e.base());
        if (e.hours() != null) inputs.put("HOURS", e.hours());
        if (e.rate() != null)  inputs.put("RATE", e.rate());
        if (e.extra() != null) inputs.putAll(e.extra());
        LocalDate date = (p != null && p.from() != null) ? p.from() : LocalDate.now();
        return new EvalContext(inputs, date);
    }

    public static SimEmployeeResponse toResponse(EvaluationResult r) {
        Map<String, BigDecimal> components = new LinkedHashMap<>();
        r.components().forEach((k,v) -> components.put(k, v.amount()));
        return new SimEmployeeResponse(components, r.total());
    }
}
