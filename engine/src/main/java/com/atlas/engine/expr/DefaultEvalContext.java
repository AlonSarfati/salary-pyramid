package com.atlas.engine.expr;

import com.atlas.engine.model.EvalContext;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Default implementation of EvalContext that bridges to the existing model.EvalContext.
 */
public class DefaultEvalContext implements com.atlas.engine.expr.EvalContext {
    private final EvalContext modelContext;
    private final Map<String, Value> componentCache;

    public DefaultEvalContext(EvalContext modelContext) {
        this.modelContext = modelContext;
        this.componentCache = modelContext.inputs().entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> convertToValue(e.getValue())
                ));
    }

    @Override
    public Value getComponent(String componentName) {
        // Always check the model context first (it may have been updated with calculated values)
        Object value = modelContext.inputs().get(componentName);
        if (value != null) {
            Value converted = convertToValue(value);
            componentCache.put(componentName, converted);
            return converted;
        }
        
        // Check cache as fallback
        Value cached = componentCache.get(componentName);
        if (cached != null) {
            return cached;
        }
        
        // Return zero if not found (component not yet calculated or doesn't exist)
        return Value.ofNumber(BigDecimal.ZERO);
    }

    @Override
    public Set<String> getComponentNames() {
        return modelContext.inputs().keySet();
    }

    @Override
    public Map<String, Object> getValues() {
        return modelContext.inputs();
    }

    private Value convertToValue(Object obj) {
        if (obj == null) {
            return Value.ofNumber(BigDecimal.ZERO);
        }
        if (obj instanceof BigDecimal bd) {
            return Value.ofNumber(bd);
        }
        if (obj instanceof Number num) {
            return Value.ofNumber(BigDecimal.valueOf(num.doubleValue()));
        }
        if (obj instanceof Boolean bool) {
            return Value.ofBoolean(bool);
        }
        if (obj instanceof String str) {
            // Try to parse as number first
            try {
                return Value.ofNumber(new BigDecimal(str));
            } catch (NumberFormatException e) {
                return Value.ofString(str);
            }
        }
        // Default: convert to string then try number
        String str = String.valueOf(obj);
        try {
            return Value.ofNumber(new BigDecimal(str));
        } catch (NumberFormatException e) {
            return Value.ofString(str);
        }
    }
}

