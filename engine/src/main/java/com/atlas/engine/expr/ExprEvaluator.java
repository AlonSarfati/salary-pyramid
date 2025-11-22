package com.atlas.engine.expr;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Set;

/**
 * Expression evaluator using the new expression system.
 * Parses and evaluates expressions with full operator and function support.
 */
public class ExprEvaluator {
    
    /**
     * Evaluate an expression string.
     * @param expression The expression to evaluate
     * @param context The evaluation context
     * @return The result value
     */
    public Value evaluate(String expression, EvalContext context) {
        Set<String> componentNames = context.getComponentNames();
        ExprParser parser = new ExprParser(expression, componentNames);
        ExprNode node = parser.parse();
        return node.evaluate(context);
    }

    /**
     * Evaluate an expression and return as BigDecimal.
     * @param expression The expression to evaluate
     * @param context The evaluation context
     * @return The result as BigDecimal
     */
    public BigDecimal evaluateAsNumber(String expression, EvalContext context) {
        Value result = evaluate(expression, context);
        return result.asNumber();
    }
}

