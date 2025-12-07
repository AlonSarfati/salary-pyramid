package com.atlas.engine.expr;

import java.math.BigDecimal;
import java.math.MathContext;

/**
 * Represents a value in the expression evaluation system.
 * All numeric operations use BigDecimal for precision.
 */
public final class Value {
    private static final MathContext MC = MathContext.DECIMAL64;
    
    private final ValueType type;
    private final BigDecimal numberValue;
    private final Boolean booleanValue;
    private final String stringValue;

    private Value(ValueType type, BigDecimal numberValue, Boolean booleanValue, String stringValue) {
        this.type = type;
        this.numberValue = numberValue;
        this.booleanValue = booleanValue;
        this.stringValue = stringValue;
    }

    public static Value ofNumber(BigDecimal value) {
        return new Value(ValueType.NUMBER, value, null, null);
    }

    public static Value ofNumber(String value) {
        return ofNumber(new BigDecimal(value));
    }

    public static Value ofNumber(double value) {
        return ofNumber(BigDecimal.valueOf(value));
    }

    public static Value ofBoolean(boolean value) {
        return new Value(ValueType.BOOLEAN, null, value, null);
    }

    public static Value ofString(String value) {
        return new Value(ValueType.STRING, null, null, value);
    }

    public ValueType getType() {
        return type;
    }

    public BigDecimal asNumber() {
        if (type != ValueType.NUMBER) {
            throw new IllegalStateException("Value is not a number: " + type);
        }
        return numberValue;
    }

    public boolean asBoolean() {
        if (type == ValueType.BOOLEAN) {
            return booleanValue;
        }
        if (type == ValueType.NUMBER) {
            return numberValue.compareTo(BigDecimal.ZERO) != 0;
        }
        throw new IllegalStateException("Cannot convert " + type + " to boolean");
    }

    public String asString() {
        return switch (type) {
            case NUMBER -> numberValue.toPlainString();
            case BOOLEAN -> String.valueOf(booleanValue);
            case STRING -> stringValue;
        };
    }

    // Arithmetic operations
    public Value add(Value other) {
        return Value.ofNumber(this.asNumber().add(other.asNumber(), MC));
    }

    public Value subtract(Value other) {
        return Value.ofNumber(this.asNumber().subtract(other.asNumber(), MC));
    }

    public Value multiply(Value other) {
        return Value.ofNumber(this.asNumber().multiply(other.asNumber(), MC));
    }

    public Value divide(Value other) {
        return Value.ofNumber(this.asNumber().divide(other.asNumber(), MC));
    }

    public Value power(Value other) {
        BigDecimal base = this.asNumber();
        BigDecimal exponent = other.asNumber();
        
        // If exponent is an integer, use BigDecimal.pow() for precision
        if (exponent.scale() == 0) {
            try {
                int expInt = exponent.intValueExact();
                return Value.ofNumber(base.pow(expInt, MC));
            } catch (ArithmeticException e) {
                // Exponent too large for int, fall through to Math.pow
            }
        }
        
        // For non-integer exponents or very large exponents, use Math.pow
        double baseDouble = base.doubleValue();
        double expDouble = exponent.doubleValue();
        double result = Math.pow(baseDouble, expDouble);
        return Value.ofNumber(BigDecimal.valueOf(result));
    }

    // Comparison operations
    public Value equals(Value other) {
        // Handle number-to-number comparison
        if (type == ValueType.NUMBER && other.type == ValueType.NUMBER) {
            return Value.ofBoolean(this.asNumber().compareTo(other.asNumber()) == 0);
        }
        // Handle boolean-to-boolean comparison
        if (type == ValueType.BOOLEAN && other.type == ValueType.BOOLEAN) {
            return Value.ofBoolean(this.asBoolean() == other.asBoolean());
        }
        // Handle number-to-boolean comparison: convert number to boolean (non-zero = true, zero = false)
        if (type == ValueType.NUMBER && other.type == ValueType.BOOLEAN) {
            return Value.ofBoolean(this.asBoolean() == other.asBoolean());
        }
        if (type == ValueType.BOOLEAN && other.type == ValueType.NUMBER) {
            return Value.ofBoolean(this.asBoolean() == other.asBoolean());
        }
        // For all other cases (including string comparisons), use string comparison
        return Value.ofBoolean(this.asString().equals(other.asString()));
    }

    public Value notEquals(Value other) {
        return Value.ofBoolean(!equals(other).asBoolean());
    }

    public Value greaterThan(Value other) {
        return Value.ofBoolean(this.asNumber().compareTo(other.asNumber()) > 0);
    }

    public Value greaterThanOrEqual(Value other) {
        return Value.ofBoolean(this.asNumber().compareTo(other.asNumber()) >= 0);
    }

    public Value lessThan(Value other) {
        return Value.ofBoolean(this.asNumber().compareTo(other.asNumber()) < 0);
    }

    public Value lessThanOrEqual(Value other) {
        return Value.ofBoolean(this.asNumber().compareTo(other.asNumber()) <= 0);
    }

    // Logical operations
    public Value and(Value other) {
        return Value.ofBoolean(this.asBoolean() && other.asBoolean());
    }

    public Value or(Value other) {
        return Value.ofBoolean(this.asBoolean() || other.asBoolean());
    }

    public Value not() {
        return Value.ofBoolean(!this.asBoolean());
    }

    @Override
    public String toString() {
        return asString();
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (obj == null || getClass() != obj.getClass()) return false;
        Value value = (Value) obj;
        if (type != value.type) return false;
        return switch (type) {
            case NUMBER -> numberValue.compareTo(value.numberValue) == 0;
            case BOOLEAN -> booleanValue.equals(value.booleanValue);
            case STRING -> stringValue.equals(value.stringValue);
        };
    }

    @Override
    public int hashCode() {
        return switch (type) {
            case NUMBER -> numberValue.hashCode();
            case BOOLEAN -> booleanValue.hashCode();
            case STRING -> stringValue.hashCode();
        };
    }
}

