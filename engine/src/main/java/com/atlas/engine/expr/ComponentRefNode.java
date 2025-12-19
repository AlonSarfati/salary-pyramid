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
        // Get component value - getComponent() already handles missing components by returning 0
        // This is more resilient: if a component doesn't exist (e.g., was deleted but still referenced),
        // it will evaluate to 0 instead of throwing an exception and breaking the entire calculation
        Value value = context.getComponent(componentName);
        // getComponent() should never return null, but if it does, return 0 as fallback
        if (value == null) {
            return Value.ofNumber(java.math.BigDecimal.ZERO);
        }
        return value;
    }
}

