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
                .map(r -> r.getTarget().equals(target) ? apply(r, req, rs) : r)
                .collect(Collectors.toCollection(ArrayList::new));

        // if target not found, optionally create it (comment next 3 lines to forbid)
        boolean exists = updated.stream().anyMatch(r -> r.getTarget().equals(target));
        if (!exists) updated.add(apply(new Rule(target, "0", List.of(), null, null, new HashMap<>()), req, rs));

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

    private Rule apply(Rule r, RuleUpdateRequest req, RuleSet ruleset) {
        // Create a mutable copy (assuming Lombok setters; otherwise use constructor)
        String expression = defaultIfNull(req.expression(), r.getExpression());
        
        // Validate expression syntax before saving
        if (req.expression() != null && !expression.trim().isEmpty()) {
            try {
                com.atlas.engine.model.RuleExpression ruleExpr = new com.atlas.engine.model.RuleExpression(expression);
                // Try to parse the expression to validate syntax
                com.atlas.engine.model.RuleExpression.ValidationResult validation = ruleExpr.validate(Set.of()); // Use empty set to allow all component references
                if (!validation.isValid()) {
                    throw new IllegalArgumentException("Invalid expression syntax: " + validation.getErrorMessage() + 
                        ". Expression: " + expression);
                }
            } catch (IllegalArgumentException e) {
                // Re-throw validation errors as-is
                throw e;
            } catch (Exception e) {
                throw new IllegalArgumentException("Invalid expression syntax: " + e.getMessage() + 
                    ". Expression: " + expression, e);
            }
        }
        
        r.setExpression(expression);
        
        // Handle dependsOn: if explicitly provided, use it; otherwise auto-extract from expression
        if (req.dependsOn() != null) {
            r.setDependsOn(req.dependsOn());
        } else if (req.expression() != null && !expression.trim().isEmpty()) {
            // Auto-extract dependencies from the new expression
            try {
                com.atlas.engine.model.RuleExpression ruleExpr = new com.atlas.engine.model.RuleExpression(expression);
                // Get all available component names from the ruleset
                Set<String> availableComponents = ruleset.getRules().stream()
                    .map(rule -> rule.getTarget())
                    .collect(java.util.stream.Collectors.toSet());
                Set<String> extractedDeps = ruleExpr.extractDependencies(availableComponents);
                r.setDependsOn(new ArrayList<>(extractedDeps));
            } catch (Exception e) {
                // If extraction fails, keep existing dependsOn or leave it empty
                // This is safe - dependencies are also extracted during evaluation
            }
        }
        
        if (req.effectiveFrom() != null) r.setEffectiveFrom(parseDateOrNull(req.effectiveFrom()));
        if (req.effectiveTo() != null) r.setEffectiveTo(parseDateOrNull(req.effectiveTo()));
        Map<String, String> meta = r.getMeta() == null ? new HashMap<>() : new HashMap<>(r.getMeta());
        if (req.group() != null) {
            meta.put("group", req.group());
        }
        if (req.incomeTax() != null) {
            meta.put("incomeTax", String.valueOf(req.incomeTax()));
        }
        if (req.socialSecurity() != null) {
            meta.put("socialSecurity", String.valueOf(req.socialSecurity()));
        }
        if (req.pension() != null) {
            meta.put("pensionFlag", String.valueOf(req.pension()));
        }
        if (req.workPension() != null) {
            meta.put("workPension", String.valueOf(req.workPension()));
        }
        if (req.expensesPension() != null) {
            meta.put("expensesPension", String.valueOf(req.expensesPension()));
        }
        if (req.educationFund() != null) {
            meta.put("educationFund", String.valueOf(req.educationFund()));
        }
        r.setMeta(meta);
        return r;
    }

    private static String defaultIfNull(String v, String def) { return v != null ? v : def; }

    private static LocalDate parseDateOrNull(String s) {
        if (s == null || s.isBlank()) return null;
        return LocalDate.parse(s);
    }
}
