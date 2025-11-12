package com.atlas.api.tables;

import com.atlas.engine.spi.TableService;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Service
@Profile("memory")
public class TableServiceMemory implements TableService {
    // tenant -> component -> table -> rows
    private final Map<String, Map<String, Map<String, List<Row>>>> data = new HashMap<>();

    @Override
    public BigDecimal lookup(String tenant, String component, String table,
                             List<Object> keys, LocalDate onDate) {
        var rows = data.getOrDefault(tenant, Map.of())
                .getOrDefault(component, Map.of())
                .getOrDefault(table, List.of());
        BigDecimal hit = null;
        for (Row r : rows) {
            if (!onDate.isBefore(r.from) && !onDate.isAfter(r.to) && r.matches(keys)) {
                if (hit != null) throw new IllegalStateException("Multiple matches");
                hit = r.value;
            }
        }
        if (hit == null) throw new NoSuchElementException("No match");
        return hit;
    }

    private static class Row {
        final LocalDate from, to; final List<Object> keys; final BigDecimal value;
        Row(LocalDate f, LocalDate t, List<Object> k, BigDecimal v){from=f;to=t;keys=k;value=v;}
        boolean matches(List<Object> k){ return keys.equals(k); } // simplified for dev
    }
}
