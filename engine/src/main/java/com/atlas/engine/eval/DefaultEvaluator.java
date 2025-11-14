package com.atlas.engine.eval;

import com.atlas.engine.dsl.ExpressionEvaluator;
import com.atlas.engine.model.*;
import com.atlas.engine.spi.TableService;

import java.math.BigDecimal;
import java.util.*;

public class DefaultEvaluator implements Evaluator {

    private final ExpressionEvaluator expr = new ExpressionEvaluator();
    private final DependencyResolver resolver = new DependencyResolver();
    private final TableCallResolver tableResolver;

    public DefaultEvaluator(TableService tables) {
        // If you ever want a different implementation, inject it instead
        this.tableResolver = new RegexTableCallResolver(tables);
    }

    @Override
    public EvaluationResult evaluateAll(RuleSet rules, EvalContext ctx) {
        Map<String, Rule> ruleIdx = rules.activeRuleIndex(ctx.periodDate());
        List<String> order = resolver.order(rules, ctx.periodDate());

        Map<String, Object> values = new HashMap<>(ctx.inputs()); // seed with inputs
        Map<String, ComponentResult> results = new LinkedHashMap<>();

        final String tenantId = String.valueOf(values.getOrDefault("_tenantId", "default"));

        for (String comp : order) {
            Rule r = ruleIdx.get(comp);
            Trace trace = new Trace(comp);

            // trace variable values BEFORE table resolution
            for (String v : expr.variables(r.getExpression())) {
                Object val = values.getOrDefault(v, BigDecimal.ZERO);
                trace.step(v + " = " + String.valueOf(val));
            }

            // resolve TBL(...) calls
            String resolvedExpr = tableResolver.resolve(
                    r.getExpression(),
                    values,
                    ctx.periodDate(),
                    tenantId,
                    comp,
                    trace
            );

            // evaluate arithmetic part
            BigDecimal amount = expr.eval(resolvedExpr, values);
            values.put(comp, amount);
            trace.done(comp + " = " + amount.toPlainString());

            results.put(comp, new ComponentResult(comp, amount, trace));
        }

        BigDecimal total = results.values().stream()
                .map(ComponentResult::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new EvaluationResult(results, total);
    }
}
