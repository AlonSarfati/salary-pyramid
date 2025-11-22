package com.atlas.engine.expr;

import com.atlas.engine.spi.TableService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Adapter that bridges TableLookupService to the existing TableService SPI.
 */
public class TableLookupServiceAdapter implements TableLookupService {
    private final TableService tableService;
    private final String tenantId;
    private final String componentTarget;
    private final LocalDate defaultDate;

    public TableLookupServiceAdapter(TableService tableService, String tenantId, 
                                     String componentTarget, LocalDate defaultDate) {
        this.tableService = tableService;
        this.tenantId = tenantId;
        this.componentTarget = componentTarget;
        this.defaultDate = defaultDate;
    }

    @Override
    public BigDecimal lookup(String tableName, List<Value> keys) {
        // Convert Value list to Object list for TableService
        List<Object> keyObjects = new ArrayList<>();
        LocalDate date = defaultDate;
        
        for (int i = 0; i < keys.size(); i++) {
            Value key = keys.get(i);
            
            // Last argument might be a date
            if (i == keys.size() - 1 && key.getType() == ValueType.STRING) {
                String str = key.asString();
                if (str.matches("\\d{4}-\\d{2}-\\d{2}")) {
                    try {
                        date = LocalDate.parse(str);
                        continue; // Don't add date to keys
                    } catch (Exception e) {
                        // Not a date, continue as normal
                    }
                }
            }
            
            // Convert Value to Object
            switch (key.getType()) {
                case NUMBER -> keyObjects.add(key.asNumber());
                case BOOLEAN -> keyObjects.add(key.asBoolean());
                case STRING -> keyObjects.add(key.asString());
            }
        }
        
        return tableService.lookup(tenantId, componentTarget, tableName, keyObjects, date);
    }
}

