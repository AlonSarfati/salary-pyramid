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
        // Pass null for componentNames to skip strict validation during evaluation.
        // This allows expressions to reference components that will be calculated later,
        // or components that may have been deleted but are still referenced.
        // Missing components will evaluate to 0 via ComponentRefNode.evaluate() -> context.getComponent().
        ExprParser parser = new ExprParser(expression, null);
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

