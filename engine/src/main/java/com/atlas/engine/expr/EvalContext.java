package com.atlas.engine.expr;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Evaluation context for expressions.
 * Provides access to component values and other context information.
 */
public interface EvalContext {
    /**
     * Get the value of a component by name.
     * @param componentName The component name
     * @return The component value, or null if not found
     */
    Value getComponent(String componentName);

    /**
     * Get all available component names.
     * @return Set of component names
     */
    java.util.Set<String> getComponentNames();

    /**
     * Get the raw value map (for backward compatibility).
     * @return Map of variable names to values
     */
    Map<String, Object> getValues();
}

