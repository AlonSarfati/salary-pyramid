package com.atlas.engine.model;

import java.time.LocalDate;
import java.util.*;

/**
 * Builder for creating Rule instances with the new expression system.
 * Provides fluent API for constructing rules with validation.
 */
public class RuleBuilder {
    private String target;
    private String expression;
    private List<String> dependsOn;
    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;
    private Map<String, String> meta;
    private Set<String> availableComponents;

    // No-arg constructor for manual builder pattern
    public RuleBuilder() {
    }

    public static RuleBuilder create() {
        return new RuleBuilder();
    }

    // Getters for accessing builder state
    public String getTarget() { return target; }
    public String getExpression() { return expression; }
    public List<String> getDependsOn() { return dependsOn; }
    public LocalDate getEffectiveFrom() { return effectiveFrom; }
    public LocalDate getEffectiveTo() { return effectiveTo; }
    public Map<String, String> getMeta() { return meta; }
    public Set<String> getAvailableComponents() { return availableComponents; }

    public RuleBuilder target(String target) {
        this.target = target;
        return this;
    }

    public RuleBuilder expression(String expression) {
        this.expression = expression;
        return this;
    }

    public RuleBuilder dependsOn(String... components) {
        this.dependsOn = Arrays.asList(components);
        return this;
    }

    public RuleBuilder dependsOn(List<String> components) {
        this.dependsOn = components;
        return this;
    }

    public RuleBuilder effectiveFrom(LocalDate date) {
        this.effectiveFrom = date;
        return this;
    }

    public RuleBuilder effectiveTo(LocalDate date) {
        this.effectiveTo = date;
        return this;
    }

    public RuleBuilder effectiveBetween(LocalDate from, LocalDate to) {
        this.effectiveFrom = from;
        this.effectiveTo = to;
        return this;
    }

    public RuleBuilder meta(String key, String value) {
        if (this.meta == null) {
            this.meta = new HashMap<>();
        }
        this.meta.put(key, value);
        return this;
    }

    public RuleBuilder meta(Map<String, String> meta) {
        this.meta = meta;
        return this;
    }

    public RuleBuilder group(String group) {
        return meta("group", group);
    }

    public RuleBuilder taxable(boolean taxable) {
        return meta("taxable", String.valueOf(taxable));
    }

    public RuleBuilder cap(String capExpression) {
        return meta("cap", capExpression);
    }

    public RuleBuilder availableComponents(Set<String> components) {
        this.availableComponents = components;
        return this;
    }

    /**
     * Build the rule with automatic dependency extraction.
     */
    public Rule build() {
        if (target == null || target.trim().isEmpty()) {
            throw new IllegalArgumentException("Rule target cannot be null or empty");
        }
        if (expression == null || expression.trim().isEmpty()) {
            throw new IllegalArgumentException("Rule expression cannot be null or empty");
        }

        RuleExpression ruleExpr = new RuleExpression(expression);
        
        // Auto-extract dependencies if not provided
        if (dependsOn == null || dependsOn.isEmpty()) {
            Set<String> components = availableComponents != null 
                ? availableComponents 
                : Collections.emptySet();
            dependsOn = new ArrayList<>(ruleExpr.extractDependencies(components));
        }

        return Rule.builder()
                .target(target)
                .expression(expression)
                .dependsOn(dependsOn)
                .effectiveFrom(effectiveFrom)
                .effectiveTo(effectiveTo)
                .meta(meta != null ? meta : Collections.emptyMap())
                .build();
    }

    /**
     * Build and validate the rule.
     */
    public Rule buildAndValidate(Set<String> availableComponents) {
        Rule rule = build();
        
        RuleExpression ruleExpr = new RuleExpression(rule.getExpression());
        RuleExpression.ValidationResult validation = ruleExpr.validate(availableComponents);
        
        if (!validation.isValid()) {
            throw new IllegalArgumentException("Invalid rule expression: " + validation.getErrorMessage());
        }
        
        return rule;
    }
}

