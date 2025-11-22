package com.atlas.engine.expr.functions;

import com.atlas.engine.expr.ExprFunction;
import com.atlas.engine.expr.Value;

import java.math.BigDecimal;
import java.util.List;

/**
 * MIN function: MIN(value1, value2, ...)
 * Returns the minimum numeric value among the arguments.
 */
public class MinFunction implements ExprFunction {
    @Override
    public Value apply(List<Value> args) {
        if (args.isEmpty()) {
            throw new IllegalArgumentException("MIN requires at least one argument");
        }
        
        BigDecimal min = args.get(0).asNumber();
        for (int i = 1; i < args.size(); i++) {
            BigDecimal current = args.get(i).asNumber();
            if (current.compareTo(min) < 0) {
                min = current;
            }
        }
        return Value.ofNumber(min);
    }
}

