package com.atlas.engine.spi;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface TableService {
    BigDecimal lookup(String tenantId,
                      String componentTarget,
                      String tableName,
                      List<Object> keys,
                      LocalDate onDate);
}
