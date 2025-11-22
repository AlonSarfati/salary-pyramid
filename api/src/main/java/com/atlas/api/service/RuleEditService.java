package com.atlas.api.service;

import com.atlas.api.model.dto.RuleUpdateRequest;
import com.atlas.engine.model.Rule;
import com.atlas.engine.model.RuleSet;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RuleEditService {

    private final RulesService rulesService;

    public RuleEditService(RulesService rulesService) {
        this.rulesService = rulesService;
    }

    public RuleSet getRuleset(String tenantId, String rulesetId) {
        return rulesService.getById(tenantId, rulesetId);
    }

    public RuleSet updateRule(String tenantId, String rulesetId, String target, RuleUpdateRequest req) {
        RuleSet rs = rulesService.getById(tenantId, rulesetId);
        // clone list to avoid mutating in place
        List<Rule> updated = rs.getRules().stream()
                .map(r -> r.getTarget().equals(target) ? apply(r, req) : r)
                .collect(Collectors.toCollection(ArrayList::new));

        // if target not found, optionally create it (comment next 3 lines to forbid)
        boolean exists = updated.stream().anyMatch(r -> r.getTarget().equals(target));
        if (!exists) updated.add(apply(new Rule(target, "0", List.of(), null, null, new HashMap<>()), req));

        rulesService.replaceRules(tenantId, rulesetId, updated);
        return rulesService.getById(tenantId, rulesetId);
    }

    public RuleSet deleteRule(String tenantId, String rulesetId, String target) {
        RuleSet rs = rulesService.getById(tenantId, rulesetId);
        // Remove the rule with the given target
        List<Rule> updated = rs.getRules().stream()
                .filter(r -> !r.getTarget().equals(target))
                .collect(Collectors.toCollection(ArrayList::new));

        rulesService.replaceRules(tenantId, rulesetId, updated);
        return rulesService.getById(tenantId, rulesetId);
    }

    private Rule apply(Rule r, RuleUpdateRequest req) {
        // Create a mutable copy (assuming Lombok setters; otherwise use constructor)
        r.setExpression(defaultIfNull(req.expression(), r.getExpression()));
        if (req.dependsOn() != null) r.setDependsOn(req.dependsOn());
        if (req.effectiveFrom() != null) r.setEffectiveFrom(parseDateOrNull(req.effectiveFrom()));
        if (req.effectiveTo() != null) r.setEffectiveTo(parseDateOrNull(req.effectiveTo()));
        if (req.taxable() != null) {
            Map<String, String> meta = r.getMeta() == null ? new HashMap<>() : new HashMap<>(r.getMeta());
            meta.put("taxable", String.valueOf(req.taxable()));
            r.setMeta(meta);
        }
        if (req.group() != null) {
            Map<String, String> meta = r.getMeta() == null ? new HashMap<>() : new HashMap<>(r.getMeta());
            meta.put("group", req.group());
            r.setMeta(meta);
        }
        return r;
    }

    private static String defaultIfNull(String v, String def) { return v != null ? v : def; }

    private static LocalDate parseDateOrNull(String s) {
        if (s == null || s.isBlank()) return null;
        return LocalDate.parse(s);
    }
}
