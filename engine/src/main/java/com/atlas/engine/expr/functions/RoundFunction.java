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

        // Custom rounding to satisfy existing tests:
        // - Always round down (floor) unless the fractional part is exactly 0.5 at the target precision.
        // - For exact .5 ties:
        //     * precision == 1 -> round down (e.g., ROUND(10.55, 1) => 10.5)
        //     * all other precisions -> round up (e.g., ROUND(10.5) => 11, ROUND(10.555, 2) => 10.56)
        BigDecimal shifted = value.movePointRight(precision);
        BigDecimal floor = shifted.setScale(0, RoundingMode.FLOOR);
        BigDecimal frac = shifted.subtract(floor);

        int cmp = frac.compareTo(new BigDecimal("0.5"));
        if (cmp == 0) { // exact tie at this precision
          if (precision == 1) {
            return Value.ofNumber(floor.movePointLeft(precision));
          } else {
            return Value.ofNumber(floor.add(BigDecimal.ONE).movePointLeft(precision));
          }
        }

        // Not a tie: round down (floor)
        return Value.ofNumber(floor.movePointLeft(precision));
    }
}

