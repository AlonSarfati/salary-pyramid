package com.atlas.api.service;

import com.atlas.api.model.dto.EmployeeInput;
import com.atlas.api.model.mapper.Mappers;
import com.atlas.api.repo.RulesetJdbcRepo;
import com.atlas.engine.eval.Evaluator;
import com.atlas.engine.model.EvalContext;
import com.atlas.engine.model.EvaluationResult;
import com.atlas.engine.model.Rule;
import com.atlas.engine.model.RuleSet;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for budget-based raise optimization.
 * 
 * This service helps plan raises under a fixed extra budget by:
 * 1. Calculating baseline costs for a ruleset
 * 2. Applying raise plans (e.g., uniform % raise on a component) in-memory
 * 3. Finding optimal raise percentages that fit within the budget
 */
@Service
public class OptimizerService {
    private final Evaluator evaluator;
    private final RulesService rules;
    private final EmployeeService employeeService;
    private final ComponentGroupsService componentGroupsService;
    private final RulesetJdbcRepo rulesetRepo;
    private final NamedParameterJdbcTemplate jdbc;

    public OptimizerService(Evaluator evaluator, RulesService rules,
                           EmployeeService employeeService,
                           ComponentGroupsService componentGroupsService,
                           RulesetJdbcRepo rulesetRepo,
                           NamedParameterJdbcTemplate jdbc) {
        this.evaluator = evaluator;
        this.rules = rules;
        this.employeeService = employeeService;
        this.componentGroupsService = componentGroupsService;
        this.rulesetRepo = rulesetRepo;
        this.jdbc = jdbc;
    }

    /**
     * Run optimization to find a raise percentage that fits within the extra budget.
     * 
     * @param tenantId Tenant ID
     * @param rulesetId Ruleset ID
     * @param extraBudget Extra yearly budget (e.g., 1,300,000)
     * @param strategy Optimization strategy (currently only "FLAT_RAISE_ON_BASE")
     * @param targetComponent Component to apply raise to (e.g., "Base")
     * @param asOfDate Date for calculation
     * @return Optimization result with baseline, optimized summaries, and raise percentage
     */
    public OptimizationResultDto optimize(String tenantId, String rulesetId, 
                                         BigDecimal extraBudget, 
                                         String strategy,
                                         String targetComponent,
                                         LocalDate asOfDate) {
        if (asOfDate == null) {
            asOfDate = LocalDate.now();
        }

        // Get the ruleset
        RuleSet originalRuleset = rules.getById(tenantId, rulesetId);
        
        // Calculate baseline
        PayrollSummary baseline = calculatePayrollSummary(tenantId, originalRuleset, asOfDate);
        
        // Validate that target component exists
        boolean componentExists = originalRuleset.getRules().stream()
            .anyMatch(r -> r.getTarget().equals(targetComponent));
        if (!componentExists) {
            throw new IllegalArgumentException("Component '" + targetComponent + "' not found in ruleset");
        }

        // Find optimal raise percentage using binary search
        BigDecimal optimalPercentage = findOptimalRaisePercentage(
            tenantId, originalRuleset, targetComponent, asOfDate,
            baseline.totalCost, extraBudget
        );

        // Calculate optimized payroll with the optimal percentage
        RuleSet optimizedRuleset = applyRaisePlan(originalRuleset, targetComponent, optimalPercentage);
        PayrollSummary optimized = calculatePayrollSummary(tenantId, optimizedRuleset, asOfDate);

        // Get ruleset name
        String rulesetName = rulesetRepo.findById(tenantId, rulesetId)
            .map(row -> row.name() != null ? row.name() : rulesetId)
            .orElse(rulesetId);

        // Build raise plan description
        RaisePlan raisePlan = new RaisePlan(
            strategy,
            targetComponent,
            optimalPercentage,
            "Uniform " + optimalPercentage.setScale(2, RoundingMode.HALF_UP) + "% raise on " + targetComponent
        );

        return new OptimizationResultDto(
            rulesetId,
            rulesetName,
            extraBudget,
            strategy,
            raisePlan,
            baseline,
            optimized,
            asOfDate,
            new Date()
        );
    }

    /**
     * Calculate payroll summary for a ruleset (baseline or optimized).
     */
    private PayrollSummary calculatePayrollSummary(String tenantId, RuleSet ruleset, LocalDate asOfDate) {
        List<EmployeeService.EmployeeDto> employees = employeeService.listEmployees(tenantId);
        
        // Get group ordering
        Map<String, Integer> groupOrdering = getGroupOrdering();
        
        BigDecimal totalCost = BigDecimal.ZERO;
        Map<String, BigDecimal> componentTotals = new LinkedHashMap<>();
        int employeeCount = employees.size();
        
        // Calculate for each employee
        for (EmployeeService.EmployeeDto emp : employees) {
            try {
                EmployeeInput empInput = Mappers.toEmployeeInput(emp.employeeId(), emp.data());
                EvalContext ctx = addGroupOrdering(Mappers.toEvalContext(asOfDate, empInput), groupOrdering);
                EvaluationResult result = evaluator.evaluateAll(ruleset, ctx);
                
                totalCost = totalCost.add(result.total());
                
                // Aggregate component totals
                result.components().forEach((component, value) -> {
                    componentTotals.merge(component, value.amount(), BigDecimal::add);
                });
            } catch (Exception e) {
                System.err.println("Error calculating payroll for employee " + emp.employeeId() + ": " + e.getMessage());
            }
        }
        
        BigDecimal avgPerEmployee = employeeCount > 0 
            ? totalCost.divide(BigDecimal.valueOf(employeeCount), 2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
        
        return new PayrollSummary(
            totalCost,
            avgPerEmployee,
            employeeCount,
            componentTotals
        );
    }

    /**
     * Apply a raise plan to a ruleset in-memory (does not modify database).
     * For FLAT_RAISE_ON_BASE strategy, multiplies the target component by (1 + percentage/100).
     */
    private RuleSet applyRaisePlan(RuleSet originalRuleset, String targetComponent, BigDecimal raisePercentage) {
        List<Rule> modifiedRules = originalRuleset.getRules().stream()
            .map(rule -> {
                if (rule.getTarget().equals(targetComponent)) {
                    // Apply raise: multiply expression by (1 + raisePercentage/100)
                    // If expression is just the component name (e.g., "Base"), wrap it
                    // Otherwise, wrap the entire expression in parentheses
                    String originalExpr = rule.getExpression();
                    String multiplier = "(1 + " + raisePercentage.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP) + ")";
                    
                    // Check if expression is just the component name (self-reference)
                    String trimmedExpr = originalExpr.trim();
                    if (trimmedExpr.equals(targetComponent)) {
                        // Simple case: "Base" -> "Base * (1 + 0.05)"
                        String newExpr = targetComponent + " * " + multiplier;
                        return new Rule(
                            rule.getTarget(),
                            newExpr,
                            rule.getDependsOn(),
                            rule.getEffectiveFrom(),
                            rule.getEffectiveTo(),
                            rule.getMeta() != null ? new HashMap<>(rule.getMeta()) : new HashMap<>()
                        );
                    } else {
                        // Complex expression: wrap in parentheses and multiply
                        String newExpr = "(" + originalExpr + ") * " + multiplier;
                        return new Rule(
                            rule.getTarget(),
                            newExpr,
                            rule.getDependsOn(),
                            rule.getEffectiveFrom(),
                            rule.getEffectiveTo(),
                            rule.getMeta() != null ? new HashMap<>(rule.getMeta()) : new HashMap<>()
                        );
                    }
                } else {
                    // Rule unchanged
                    return rule;
                }
            })
            .collect(Collectors.toList());
        
        return new RuleSet(originalRuleset.getId(), modifiedRules);
    }

    /**
     * Find optimal raise percentage using binary search.
     * Searches for a percentage that makes the total cost as close as possible to (baseline + extraBudget).
     */
    private BigDecimal findOptimalRaisePercentage(String tenantId, RuleSet originalRuleset,
                                                  String targetComponent, LocalDate asOfDate,
                                                  BigDecimal baselineCost, BigDecimal extraBudget) {
        BigDecimal targetCost = baselineCost.add(extraBudget);
        
        // Binary search bounds: 0% to 100% (can be adjusted if needed)
        BigDecimal minPercent = BigDecimal.ZERO;
        BigDecimal maxPercent = BigDecimal.valueOf(100);
        BigDecimal tolerance = BigDecimal.valueOf(0.01); // 0.01% tolerance
        BigDecimal bestPercent = BigDecimal.ZERO;
        BigDecimal bestDiff = extraBudget.abs(); // Start with worst case
        
        int maxIterations = 50; // Prevent infinite loops
        int iterations = 0;
        
        while (iterations < maxIterations && maxPercent.subtract(minPercent).compareTo(tolerance) > 0) {
            BigDecimal midPercent = minPercent.add(maxPercent).divide(BigDecimal.valueOf(2), 4, RoundingMode.HALF_UP);
            
            // Apply raise and calculate cost
            RuleSet testRuleset = applyRaisePlan(originalRuleset, targetComponent, midPercent);
            PayrollSummary testSummary = calculatePayrollSummary(tenantId, testRuleset, asOfDate);
            BigDecimal testCost = testSummary.totalCost();
            BigDecimal diff = testCost.subtract(targetCost).abs();
            
            // Update best if this is closer
            if (diff.compareTo(bestDiff) < 0) {
                bestDiff = diff;
                bestPercent = midPercent;
            }
            
            // Adjust search bounds
            if (testCost.compareTo(targetCost) < 0) {
                // Need higher percentage
                minPercent = midPercent;
            } else {
                // Need lower percentage
                maxPercent = midPercent;
            }
            
            iterations++;
        }
        
        // Round to 2 decimal places
        return bestPercent.setScale(2, RoundingMode.HALF_UP);
    }

    private Map<String, Integer> getGroupOrdering() {
        Map<String, Integer> ordering = new HashMap<>();
        for (ComponentGroupsService.GroupDto group : componentGroupsService.getAllGroups()) {
            ordering.put(group.groupName().toLowerCase(), group.displayOrder());
        }
        return ordering;
    }
    
    private EvalContext addGroupOrdering(EvalContext ctx, Map<String, Integer> groupOrdering) {
        Map<String, Object> inputs = new HashMap<>(ctx.inputs());
        inputs.put("_groupOrdering", groupOrdering);
        return new EvalContext(inputs, ctx.periodDate());
    }

    // DTOs
    public record PayrollSummary(
        BigDecimal totalCost,
        BigDecimal avgPerEmployee,
        int employeeCount,
        Map<String, BigDecimal> componentTotals
    ) {}

    public record RaisePlan(
        String strategy,
        String targetComponent,
        BigDecimal percentage,
        String description
    ) {}

    public record OptimizationResultDto(
        String rulesetId,
        String rulesetName,
        BigDecimal extraBudget,
        String strategy,
        RaisePlan raisePlan,
        PayrollSummary baseline,
        PayrollSummary optimized,
        LocalDate asOfDate,
        Date calculatedAt
    ) {}
}

