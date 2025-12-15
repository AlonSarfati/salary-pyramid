package com.atlas.engine.expr;

/**
 * AST node for component references (e.g., ${ComponentName}).
 */
public class ComponentRefNode implements ExprNode {
    private final String componentName;

    public ComponentRefNode(String componentName) {
        this.componentName = componentName;
    }

    public String getComponentName() {
        return componentName;
    }

    @Override
    public Value evaluate(EvalContext context) {
        // Validate component existence in context
        if (context.getComponentNames() != null && !context.getComponentNames().contains(componentName)) {
            throw new IllegalArgumentException("Unknown component: " + componentName);
        }
        Value value = context.getComponent(componentName);
        if (value == null) {
            throw new IllegalArgumentException("Unknown component: " + componentName);
        }
        return value;
    }
}

