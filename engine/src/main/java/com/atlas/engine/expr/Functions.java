package com.atlas.engine.expr;

import com.atlas.engine.expr.functions.*;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Registry for built-in expression functions.
 * Functions are registered by name and can be retrieved for evaluation.
 */
public class Functions {
    private static final Map<String, ExprFunction> REGISTRY = new ConcurrentHashMap<>();
    
    static {
        // Register built-in functions
        register("IF", new IfFunction());
        register("MIN", new MinFunction());
        register("MAX", new MaxFunction());
        register("ROUND", new RoundFunction());
    }

    /**
     * Register a function by name.
     * @param name The function name (case-insensitive)
     * @param function The function implementation
     */
    public static void register(String name, ExprFunction function) {
        REGISTRY.put(name.toUpperCase(), function);
    }

    /**
     * Get a function by name.
     * @param name The function name (case-insensitive)
     * @return The function, or null if not found
     */
    public static ExprFunction get(String name) {
        return REGISTRY.get(name.toUpperCase());
    }

    /**
     * Check if a function exists.
     * @param name The function name (case-insensitive)
     * @return true if the function is registered
     */
    public static boolean has(String name) {
        return REGISTRY.containsKey(name.toUpperCase());
    }

    /**
     * Register TBL function with a TableLookupService.
     * This must be called before using TBL in expressions.
     * @param tableLookupService The table lookup service
     */
    public static void registerTbl(TableLookupService tableLookupService) {
        register("TBL", new TblFunction(tableLookupService));
    }
}

