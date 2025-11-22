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
        Value value = context.getComponent(componentName);
        // DefaultEvalContext returns zero for missing components, so we accept any value
        // If value is null (shouldn't happen with DefaultEvalContext), return zero
        if (value == null) {
            return Value.ofNumber(java.math.BigDecimal.ZERO);
        }
        return value;
    }
}

