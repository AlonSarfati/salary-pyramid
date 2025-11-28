package com.atlas.engine.eval;

import com.atlas.engine.expr.Functions;
import com.atlas.engine.expr.TableLookupServiceAdapter;
import com.atlas.engine.model.ComponentResult;
import com.atlas.engine.model.EvalContext;
import com.atlas.engine.model.EvaluationResult;
import com.atlas.engine.model.Rule;
import com.atlas.engine.model.RuleExpression;
import com.atlas.engine.model.RuleSet;
import com.atlas.engine.model.Trace;
import com.atlas.engine.spi.TableService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class DefaultEvaluator implements Evaluator {

    private final DependencyResolver resolver = new DependencyResolver();
    private final TableService tableService;

    public DefaultEvaluator(TableService tables) {
        this.tableService = tables;
    }

    @Override
    public EvaluationResult evaluateAll(RuleSet rules, EvalContext ctx) {
        Map<String, Rule> ruleIdx = rules.activeRuleIndex(ctx.periodDate());
        List<String> order = resolver.order(rules, ctx.periodDate());

        Map<String, Object> values = new HashMap<>(ctx.inputs()); // seed with inputs
        Map<String, ComponentResult> results = new LinkedHashMap<>();

        final String tenantId = String.valueOf(values.getOrDefault("_tenantId", "default"));
        final LocalDate periodDate = ctx.periodDate();

        // Build set of all component names (targets of rules)
        Set<String> componentNames = new HashSet<>(ruleIdx.keySet());
        componentNames.addAll(ctx.inputs().keySet());

        // Read WorkPercent input (0-100). If missing or invalid, default to 100%.
        BigDecimal workPercent = BigDecimal.ONE;
        Object wpRaw = values.get("WorkPercent");
        if (wpRaw instanceof Number) {
            workPercent = BigDecimal.valueOf(((Number) wpRaw).doubleValue())
                    .divide(BigDecimal.valueOf(100));
        } else if (wpRaw instanceof String s && !s.isBlank()) {
            try {
                workPercent = new BigDecimal(s).divide(BigDecimal.valueOf(100));
            } catch (NumberFormatException ignored) {
                workPercent = BigDecimal.ONE;
            }
        }

        for (String comp : order) {
            Rule r = ruleIdx.get(comp);
            if (r == null) {
                continue; // Skip if rule not found
            }
            
            Trace trace = new Trace(comp);

            // Create a context that includes both inputs and calculated values
            // EvalContext is a record, so we create a new instance with the updated values map
            EvalContext ruleContext = new EvalContext(values, periodDate);

            // Register TBL function with adapter for this rule (must be done before parsing)
            TableLookupServiceAdapter tableAdapter = new TableLookupServiceAdapter(
                    tableService, tenantId, comp, periodDate);
            Functions.registerTbl(tableAdapter);

            // Create RuleExpression once and reuse it
            RuleExpression ruleExpr = new RuleExpression(r.getExpression());
            
            // Trace the expression being evaluated
            trace.step("Expression: " + r.getExpression());

            // Trace variable values
            try {
                Set<String> deps = ruleExpr.extractDependencies(componentNames);
                if (!deps.isEmpty()) {
                    trace.step("Dependencies:");
                    for (String v : deps) {
                        Object val = values.getOrDefault(v, BigDecimal.ZERO);
                        trace.step("  " + v + " = " + formatValue(val));
                    }
                } else {
                    trace.step("No dependencies (constant or input-only expression)");
                }
            } catch (Exception e) {
                // If extraction fails, continue without tracing
                trace.step("Warning: Could not extract dependencies: " + e.getMessage());
            }

            // Evaluate using the new expression system
            try {
                BigDecimal amount = ruleExpr.evaluate(ruleContext, componentNames);
                BigDecimal finalAmount = amount;

                // Apply WorkPercent scaling if meta flag is set
                if (r.getMeta() != null) {
                    String workPercentFlag = r.getMeta().get("workPercent");
                    if ("true".equalsIgnoreCase(workPercentFlag)) {
                        trace.step("Applying WorkPercent scaling: " + amount.toPlainString() + " × " + workPercent.toPlainString());
                        finalAmount = amount.multiply(workPercent);
                        trace.step("After WorkPercent: " + finalAmount.toPlainString());
                    }
                }
                
                // Check for missing dependencies that evaluated to zero
                Set<String> deps = ruleExpr.extractDependencies(componentNames);
                for (String dep : deps) {
                    if (!values.containsKey(dep) && !ctx.inputs().containsKey(dep)) {
                        trace.step("WARNING: Component '" + dep + "' not found - using 0");
                    }
                }
                
                values.put(comp, finalAmount);
                trace.done("Result: " + finalAmount.toPlainString());
                results.put(comp, new ComponentResult(comp, finalAmount, trace));
            } catch (Exception e) {
                // On error, set to zero and trace the error
                BigDecimal amount = BigDecimal.ZERO;
                trace.step("ERROR: " + e.getMessage());
                if (e.getCause() != null) {
                    trace.step("Caused by: " + e.getCause().getMessage());
                }
                trace.done(comp + " = " + amount.toPlainString() + " (error)");
                values.put(comp, amount);
                results.put(comp, new ComponentResult(comp, amount, trace));
            }
        }

        BigDecimal total = results.values().stream()
                .map(ComponentResult::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new EvaluationResult(results, total);
    }
    
    private String formatValue(Object val) {
        if (val == null) return "0";
        if (val instanceof BigDecimal) {
            return ((BigDecimal) val).toPlainString();
        }
        return String.valueOf(val);
    }
}
