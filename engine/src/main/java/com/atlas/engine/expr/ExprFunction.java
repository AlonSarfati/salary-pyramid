package com.atlas.engine.expr;

import java.util.List;

/**
 * Interface for expression functions.
 * Functions take a list of Value arguments and return a Value.
 */
@FunctionalInterface
public interface ExprFunction {
    /**
     * Apply the function to the given arguments.
     * @param args The function arguments
     * @return The result value
     * @throws IllegalArgumentException if arguments are invalid
     */
    Value apply(List<Value> args);
}

