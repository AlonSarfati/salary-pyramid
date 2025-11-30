package com.atlas.api.service;

import com.atlas.api.model.dto.*;
import com.atlas.api.model.mapper.Mappers;
import com.atlas.engine.eval.Evaluator;
import com.atlas.engine.model.EvalContext;
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
    private final ComponentGroupsService componentGroupsService;

    public SimulationService(Evaluator evaluator, RulesService rules, ComponentGroupsService componentGroupsService) {
        this.evaluator = evaluator;
        this.rules = rules;
        this.componentGroupsService = componentGroupsService;
    }

    public SimEmployeeResponse simulateEmployee(SimEmployeeRequest req) {
        RuleSet rs = resolveRules(req.tenantId(), req.rulesetId(), req.payDay());
        EvalContext ctx = addGroupOrdering(Mappers.toEvalContext(req.payDay(), req.employee()));
        EvaluationResult out = evaluator.evaluateAll(rs, ctx);
        return Mappers.toResponse(out);
    }

    public SimBulkResponse simulateBulk(SimBulkRequest req) {
        RuleSet rs = resolveRules(req.tenantId(), req.rulesetId(), req.payDay());
        
        // Get group ordering once for all employees
        Map<String, Integer> groupOrdering = getGroupOrdering();

        List<Map<String,Object>> per = new ArrayList<>();
        Map<String, BigDecimal> totalsByComponent = new LinkedHashMap<>();
        BigDecimal grand = BigDecimal.ZERO;

        for (var emp : req.employees()) {
            EvalContext ctx = addGroupOrdering(Mappers.toEvalContext(req.payDay(), emp), groupOrdering);
            var out = evaluator.evaluateAll(rs, ctx);
            
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
    
    private Map<String, Integer> getGroupOrdering() {
        Map<String, Integer> ordering = new HashMap<>();
        for (ComponentGroupsService.GroupDto group : componentGroupsService.getAllGroups()) {
            ordering.put(group.groupName().toLowerCase(), group.displayOrder());
        }
        return ordering;
    }
    
    private EvalContext addGroupOrdering(EvalContext ctx) {
        return addGroupOrdering(ctx, getGroupOrdering());
    }
    
    private EvalContext addGroupOrdering(EvalContext ctx, Map<String, Integer> groupOrdering) {
        Map<String, Object> inputs = new HashMap<>(ctx.inputs());
        inputs.put("_groupOrdering", groupOrdering);
        return new EvalContext(inputs, ctx.periodDate());
    }
}
