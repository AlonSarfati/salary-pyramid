package com.atlas.engine.expr;

/**
 * AST node for string literals.
 */
public class StringNode implements ExprNode {
    private final Value value;

    public StringNode(String value) {
        this.value = Value.ofString(value);
    }

    @Override
    public Value evaluate(EvalContext context) {
        return value;
    }
}

