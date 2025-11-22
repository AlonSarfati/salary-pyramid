package com.atlas.engine.expr;

import java.math.BigDecimal;
import java.util.List;

/**
 * Service interface for table lookups in expressions.
 * This bridges the expression system to the existing TableService SPI.
 */
public interface TableLookupService {
    /**
     * Lookup a value from a table.
     * @param tableName The name of the table
     * @param keys The lookup keys
     * @return The looked up value
     */
    BigDecimal lookup(String tableName, List<Value> keys);
}

