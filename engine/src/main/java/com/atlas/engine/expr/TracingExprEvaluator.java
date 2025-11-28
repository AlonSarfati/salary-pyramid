package com.atlas.engine.expr;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Expression evaluator that traces intermediate calculation steps.
 */
public class TracingExprEvaluator {
    private final List<String> traceSteps = new ArrayList<>();
    
    /**
     * Evaluate an expression with tracing.
     * @param expression The expression to evaluate
     * @param context The evaluation context
     * @return The result value
     */
    public Value evaluate(String expression, EvalContext context) {
        traceSteps.clear();
        Set<String> componentNames = context.getComponentNames();
        ExprParser parser = new ExprParser(expression, componentNames);
        ExprNode node = parser.parse();
        return evaluateWithTrace(node, context);
    }
    
    /**
     * Evaluate a node with tracing, recording intermediate steps.
     */
    private Value evaluateWithTrace(ExprNode node, EvalContext context) {
        if (node instanceof NumberNode) {
            NumberNode numNode = (NumberNode) node;
            return numNode.evaluate(context);
        }
        
        if (node instanceof StringNode) {
            StringNode strNode = (StringNode) node;
            return strNode.evaluate(context);
        }
        
        if (node instanceof BooleanNode) {
            BooleanNode boolNode = (BooleanNode) node;
            return boolNode.evaluate(context);
        }
        
        if (node instanceof ComponentRefNode) {
            ComponentRefNode compNode = (ComponentRefNode) node;
            // Don't add trace for component references - they're shown in dependencies section
            return compNode.evaluate(context);
        }
        
        if (node instanceof BinaryOpNode) {
            BinaryOpNode binOp = (BinaryOpNode) node;
            Value leftValue = evaluateWithTrace(binOp.getLeft(), context);
            Value rightValue = evaluateWithTrace(binOp.getRight(), context);
            
            String leftStr = formatValue(leftValue);
            String rightStr = formatValue(rightValue);
            String opSymbol = binOp.getOperator().getSymbol();
            
            Value result = switch (binOp.getOperator()) {
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
            
            String resultStr = formatValue(result);
            traceSteps.add(leftStr + " " + opSymbol + " " + rightStr + " = " + resultStr);
            return result;
        }
        
        if (node instanceof UnaryOpNode) {
            UnaryOpNode unOp = (UnaryOpNode) node;
            Value operandValue = evaluateWithTrace(unOp.getOperand(), context);
            String operandStr = formatValue(operandValue);
            
            Value result = switch (unOp.getOperator()) {
                case NOT -> operandValue.not();
                case NEGATE -> Value.ofNumber(operandValue.asNumber().negate());
            };
            
            String opSymbol = unOp.getOperator() == UnaryOpNode.Operator.NEGATE ? "-" : "NOT";
            String resultStr = formatValue(result);
            traceSteps.add(opSymbol + " " + operandStr + " = " + resultStr);
            return result;
        }
        
        if (node instanceof FunctionCallNode) {
            FunctionCallNode funcCall = (FunctionCallNode) node;
            List<Value> argValues = new ArrayList<>();
            List<String> argStrs = new ArrayList<>();
            
            for (ExprNode arg : funcCall.getArguments()) {
                Value argValue = evaluateWithTrace(arg, context);
                argValues.add(argValue);
                argStrs.add(formatValue(argValue));
            }
            
            // Evaluate the function
            ExprFunction func = Functions.get(funcCall.getFunctionName());
            if (func == null) {
                throw new IllegalArgumentException("Unknown function: " + funcCall.getFunctionName());
            }
            
            Value result = func.apply(argValues);
            String resultStr = formatValue(result);
            String argsStr = String.join(", ", argStrs);
            traceSteps.add(funcCall.getFunctionName() + "(" + argsStr + ") = " + resultStr);
            return result;
        }
        
        // Fallback: evaluate without tracing
        return node.evaluate(context);
    }
    
    private String formatValue(Value value) {
        if (value == null) return "null";
        if (value.getType() == ValueType.NUMBER) {
            return value.asNumber().toPlainString();
        }
        if (value.getType() == ValueType.BOOLEAN) {
            return String.valueOf(value.asBoolean());
        }
        if (value.getType() == ValueType.STRING) {
            return "\"" + value.asString() + "\"";
        }
        return value.toString();
    }
    
    /**
     * Get the trace steps recorded during evaluation.
     */
    public List<String> getTraceSteps() {
        return new ArrayList<>(traceSteps);
    }
}

