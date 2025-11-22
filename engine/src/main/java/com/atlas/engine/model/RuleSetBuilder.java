package com.atlas.engine.model;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Builder for creating RuleSet instances with validation and dependency management.
 */
public class RuleSetBuilder {
    private String id;
    private List<Rule> rules = new ArrayList<>();
    private Set<String> availableComponents;

    public static RuleSetBuilder create() {
        return new RuleSetBuilder();
    }

    public RuleSetBuilder id(String id) {
        this.id = id;
        return this;
    }

    public RuleSetBuilder rule(Rule rule) {
        this.rules.add(rule);
        return this;
    }

    public RuleSetBuilder rules(List<Rule> rules) {
        this.rules.addAll(rules);
        return this;
    }

    public RuleSetBuilder rule(RuleBuilder ruleBuilder) {
        if (availableComponents != null) {
            ruleBuilder.availableComponents(availableComponents);
        }
        this.rules.add(ruleBuilder.build());
        return this;
    }

    public RuleSetBuilder availableComponents(Set<String> components) {
        this.availableComponents = components;
        return this;
    }

    /**
     * Build the RuleSet with validation.
     */
    public RuleSet build() {
        if (id == null || id.trim().isEmpty()) {
            throw new IllegalArgumentException("RuleSet ID cannot be null or empty");
        }
        if (rules.isEmpty()) {
            throw new IllegalArgumentException("RuleSet must contain at least one rule");
        }

        // Validate all rules
        for (Rule rule : rules) {
            RuleExpression ruleExpr = new RuleExpression(rule.getExpression());
            if (availableComponents != null) {
                RuleExpression.ValidationResult validation = ruleExpr.validate(availableComponents);
                if (!validation.isValid()) {
                    throw new IllegalArgumentException(
                        "Invalid expression in rule '" + rule.getTarget() + "': " + validation.getErrorMessage()
                    );
                }
            }
        }

        return new RuleSet(id, rules);
    }

    /**
     * Build a RuleSet with example rules for testing.
     */
    public static RuleSet buildExample() {
        return RuleSetBuilder.create()
                .id("example-ruleset")
                .rules(ExpressionExamples.getExampleRules())
                .build();
    }
}

