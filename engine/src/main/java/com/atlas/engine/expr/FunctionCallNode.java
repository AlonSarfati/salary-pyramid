package com.atlas.engine.expr;

import java.util.List;

/**
 * AST node for function calls (e.g., IF(...), MIN(...), TBL(...)).
 */
public class FunctionCallNode implements ExprNode {
    private final String functionName;
    private final List<ExprNode> arguments;

    public FunctionCallNode(String functionName, List<ExprNode> arguments) {
        this.functionName = functionName;
        this.arguments = arguments;
    }

    public String getFunctionName() {
        return functionName;
    }

    public List<ExprNode> getArguments() {
        return arguments;
    }

    @Override
    public Value evaluate(EvalContext context) {
        ExprFunction function = Functions.get(functionName);
        if (function == null) {
            throw new IllegalArgumentException("Unknown function: " + functionName);
        }

        List<Value> argValues = arguments.stream()
                .map(arg -> arg.evaluate(context))
                .toList();

        return function.apply(argValues);
    }
}

