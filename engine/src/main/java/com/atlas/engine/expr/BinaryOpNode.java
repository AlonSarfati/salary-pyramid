package com.atlas.engine.expr;

/**
 * AST node for binary operations (e.g., +, -, *, /, =, !=, >, >=, <, <=, AND, OR).
 */
public class BinaryOpNode implements ExprNode {
    public enum Operator {
        ADD("+"),
        SUBTRACT("-"),
        MULTIPLY("*"),
        DIVIDE("/"),
        EQUALS("="),
        NOT_EQUALS("!="),
        GREATER_THAN(">"),
        GREATER_THAN_OR_EQUAL(">="),
        LESS_THAN("<"),
        LESS_THAN_OR_EQUAL("<="),
        AND("AND"),
        OR("OR");

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
            throw new IllegalArgumentException("Unknown operator: " + symbol);
        }
    }

    private final ExprNode left;
    private final Operator operator;
    private final ExprNode right;

    public BinaryOpNode(ExprNode left, Operator operator, ExprNode right) {
        this.left = left;
        this.operator = operator;
        this.right = right;
    }

    public ExprNode getLeft() {
        return left;
    }

    public ExprNode getRight() {
        return right;
    }

    public Operator getOperator() {
        return operator;
    }

    @Override
    public Value evaluate(EvalContext context) {
        Value leftValue = left.evaluate(context);
        Value rightValue = right.evaluate(context);

        return switch (operator) {
            case ADD -> leftValue.add(rightValue);
            case SUBTRACT -> leftValue.subtract(rightValue);
            case MULTIPLY -> leftValue.multiply(rightValue);
            case DIVIDE -> leftValue.divide(rightValue);
            case EQUALS -> leftValue.equals(rightValue);
            case NOT_EQUALS -> leftValue.notEquals(rightValue);
            case GREATER_THAN -> leftValue.greaterThan(rightValue);
            case GREATER_THAN_OR_EQUAL -> leftValue.greaterThanOrEqual(rightValue);
            case LESS_THAN -> leftValue.lessThan(rightValue);
            case LESS_THAN_OR_EQUAL -> leftValue.lessThanOrEqual(rightValue);
            case AND -> leftValue.and(rightValue);
            case OR -> leftValue.or(rightValue);
        };
    }
}

