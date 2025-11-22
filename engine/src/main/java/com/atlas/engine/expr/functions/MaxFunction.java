package com.atlas.engine.expr.functions;

import com.atlas.engine.expr.ExprFunction;
import com.atlas.engine.expr.Value;

import java.math.BigDecimal;
import java.util.List;

/**
 * MAX function: MAX(value1, value2, ...)
 * Returns the maximum numeric value among the arguments.
 */
public class MaxFunction implements ExprFunction {
    @Override
    public Value apply(List<Value> args) {
        if (args.isEmpty()) {
            throw new IllegalArgumentException("MAX requires at least one argument");
        }
        
        BigDecimal max = args.get(0).asNumber();
        for (int i = 1; i < args.size(); i++) {
            BigDecimal current = args.get(i).asNumber();
            if (current.compareTo(max) > 0) {
                max = current;
            }
        }
        return Value.ofNumber(max);
    }
}

