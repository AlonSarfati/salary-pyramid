package com.atlas.engine.expr;

import java.math.BigDecimal;

/**
 * AST node for numeric literals.
 */
public class NumberNode implements ExprNode {
    private final Value value;

    public NumberNode(BigDecimal value) {
        this.value = Value.ofNumber(value);
    }

    public NumberNode(String value) {
        this.value = Value.ofNumber(value);
    }

    @Override
    public Value evaluate(EvalContext context) {
        return value;
    }
}

