package com.atlas.api.service;

import com.atlas.api.model.dto.*;
import com.atlas.api.model.mapper.Mappers;
import com.atlas.engine.eval.Evaluator;
import com.atlas.engine.model.EvaluationResult;
import com.atlas.engine.model.RuleSet;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Service
public class SimulationService {

    private final Evaluator evaluator;
    private final RulesService rules;

    public SimulationService(Evaluator evaluator, RulesService rules) {
        this.evaluator = evaluator;
        this.rules = rules;
    }

    public SimEmployeeResponse simulateEmployee(SimEmployeeRequest req) {
        RuleSet rs = resolveRules(req.tenantId(), req.rulesetId(), req.payDay());
        EvaluationResult out = evaluator.evaluateAll(rs, Mappers.toEvalContext(req.payDay(), req.employee()));
        return Mappers.toResponse(out);
    }

    public SimBulkResponse simulateBulk(SimBulkRequest req) {
        RuleSet rs = resolveRules(req.tenantId(), req.rulesetId(), req.payDay());

        List<Map<String,Object>> per = new ArrayList<>();
        Map<String, BigDecimal> totalsByComponent = new LinkedHashMap<>();
        BigDecimal grand = BigDecimal.ZERO;

        for (var emp : req.employees()) {
            var out = evaluator.evaluateAll(rs, Mappers.toEvalContext(req.payDay(), emp));
            
            // Include component breakdown for each employee
            Map<String, BigDecimal> employeeComponents = new LinkedHashMap<>();
            out.components().forEach((k, v) -> employeeComponents.put(k, v.amount()));
            
            per.add(Map.of(
                "employeeId", emp.id(),
                "total", out.total(),
                "components", employeeComponents
            ));
            grand = grand.add(out.total());
            out.components().forEach((k,v) ->
                    totalsByComponent.merge(k, v.amount(), BigDecimal::add));
        }
        return new SimBulkResponse(per, totalsByComponent, grand);
    }

    private RuleSet resolveRules(String tenantId, String rulesetId, LocalDate payDay) {
        if (rulesetId != null) return rules.getById(tenantId, rulesetId);
        var date = payDay != null ? payDay : java.time.LocalDate.now();
        return rules.getActive(tenantId, date);
    }
}
