package com.atlas.engine.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

public record EvalContext(Map<String, Object> inputs, LocalDate periodDate) {
    // Back-compat numeric accessor
    public BigDecimal num(String key) {
        Object v = inputs.get(key);
        if (v instanceof BigDecimal bd) return bd;
        if (v instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        if (v instanceof String s) return new BigDecimal(s);
        throw new IllegalArgumentException("Variable '" + key + "' is not numeric");
    }
    public String str(String key) { return inputs.get(key) == null ? null : String.valueOf(inputs.get(key)); }
    public Integer intVal(String key) {
        Object v = inputs.get(key);
        if (v instanceof Integer i) return i;
        if (v instanceof Number n) return n.intValue();
        if (v instanceof String s) return Integer.valueOf(s);
        return null;
    }
}
