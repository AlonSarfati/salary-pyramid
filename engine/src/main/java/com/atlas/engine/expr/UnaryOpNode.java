package com.atlas.engine.expr;

/**
 * AST node for unary operations (e.g., NOT, -).
 */
public class UnaryOpNode implements ExprNode {
    public enum Operator {
        NOT("NOT"),
        NEGATE("-");

        private final String symbol;

        Operator(String symbol) {
            this.symbol = symbol;
        }

        public String getSymbol() {
            return symbol;
        }

        public static Operator fromSymbol(String symbol) {
            for (Operator op : values()) {
                if (op.symbol.equals(symbol)) {
                    return op;
                }
            }
            throw new IllegalArgumentException("Unknown unary operator: " + symbol);
        }
    }

    private final Operator operator;
    private final ExprNode operand;

    public UnaryOpNode(Operator operator, ExprNode operand) {
        this.operator = operator;
        this.operand = operand;
    }

    public ExprNode getOperand() {
        return operand;
    }

    public Operator getOperator() {
        return operator;
    }

    @Override
    public Value evaluate(EvalContext context) {
        Value operandValue = operand.evaluate(context);

        return switch (operator) {
            case NOT -> operandValue.not();
            case NEGATE -> Value.ofNumber(operandValue.asNumber().negate());
        };
    }
}

