package com.atlas.engine.expr;

/**
 * Base interface for expression AST nodes.
 */
public interface ExprNode {
    /**
     * Evaluate this node in the given context.
     * @param context The evaluation context
     * @return The evaluated value
     */
    Value evaluate(EvalContext context);
}

