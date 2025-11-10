package com.atlas.engine.eval;

import com.atlas.engine.dsl.ExpressionEvaluator;
import com.atlas.engine.model.*;

import java.math.BigDecimal;
import java.util.*;

public class DefaultEvaluator implements Evaluator {
    private final ExpressionEvaluator expr = new ExpressionEvaluator();
    private final DependencyResolver resolver = new DependencyResolver();

    @Override
    public EvaluationResult evaluateAll(RuleSet rules, EvalContext ctx) {
        Map<String, Rule> ruleIdx = rules.activeRuleIndex(ctx.periodDate());
        List<String> order = resolver.order(rules, ctx.periodDate());

        Map<String, BigDecimal> values = new HashMap<>(ctx.inputs()); // seed with inputs (e.g., Base, HOURS)
        Map<String, ComponentResult> results = new LinkedHashMap<>();

        for (String comp : order) {
            Rule r = ruleIdx.get(comp);
            Trace trace = new Trace(comp);

            // capture referenced inputs for trace:
            for (String v : expr.variables(r.getExpression()))
                trace.step(v + " = " + values.getOrDefault(v, BigDecimal.ZERO).toPlainString());

            BigDecimal amount = expr.eval(r.getExpression(), values);
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
