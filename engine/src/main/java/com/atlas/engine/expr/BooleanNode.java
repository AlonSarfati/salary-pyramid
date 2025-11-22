package com.atlas.engine.expr;

/**
 * AST node for boolean literals.
 */
public class BooleanNode implements ExprNode {
    private final Value value;

    public BooleanNode(boolean value) {
        this.value = Value.ofBoolean(value);
    }

    @Override
    public Value evaluate(EvalContext context) {
        return value;
    }
}

