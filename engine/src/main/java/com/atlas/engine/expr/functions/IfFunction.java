package com.atlas.engine.expr.functions;

import com.atlas.engine.expr.ExprFunction;
import com.atlas.engine.expr.Value;

import java.util.List;

/**
 * IF function: IF(condition, trueValue, falseValue)
 * Returns trueValue if condition is true, otherwise falseValue.
 */
public class IfFunction implements ExprFunction {
    @Override
    public Value apply(List<Value> args) {
        if (args.size() != 3) {
            throw new IllegalArgumentException("IF requires 3 arguments: condition, trueValue, falseValue");
        }
        Value condition = args.get(0);
        Value trueValue = args.get(1);
        Value falseValue = args.get(2);
        
        return condition.asBoolean() ? trueValue : falseValue;
    }
}

