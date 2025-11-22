package com.atlas.engine.expr.functions;

import com.atlas.engine.expr.ExprFunction;
import com.atlas.engine.expr.Value;
import com.atlas.engine.expr.TableLookupService;

import java.math.BigDecimal;
import java.util.List;

/**
 * TBL function: TBL(tableName, key1, key2, ...)
 * Performs a table lookup using the TableLookupService.
 */
public class TblFunction implements ExprFunction {
    private final TableLookupService tableLookupService;

    public TblFunction(TableLookupService tableLookupService) {
        this.tableLookupService = tableLookupService;
    }

    @Override
    public Value apply(List<Value> args) {
        if (args.isEmpty()) {
            throw new IllegalArgumentException("TBL requires at least one argument: tableName");
        }
        
        String tableName = args.get(0).asString();
        List<Value> keys = args.subList(1, args.size());
        
        BigDecimal result = tableLookupService.lookup(tableName, keys);
        return Value.ofNumber(result);
    }
}

