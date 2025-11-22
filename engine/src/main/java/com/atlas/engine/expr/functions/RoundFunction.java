package com.atlas.engine.expr.functions;

import com.atlas.engine.expr.ExprFunction;
import com.atlas.engine.expr.Value;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * ROUND function: ROUND(value, [precision])
 * Rounds the value to the specified precision (default 0, i.e., nearest integer).
 */
public class RoundFunction implements ExprFunction {
    @Override
    public Value apply(List<Value> args) {
        if (args.isEmpty() || args.size() > 2) {
            throw new IllegalArgumentException("ROUND requires 1 or 2 arguments: value, [precision]");
        }
        
        BigDecimal value = args.get(0).asNumber();
        int precision = args.size() == 2 ? args.get(1).asNumber().intValue() : 0;
        
        return Value.ofNumber(value.setScale(precision, RoundingMode.HALF_UP));
    }
}

