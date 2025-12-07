package com.atlas.api.tables;

import com.atlas.engine.spi.TableService;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Service
@Profile("postgres")
public class TableServiceDb implements TableService {
    private final NamedParameterJdbcTemplate jdbc;
    private final com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();

    public TableServiceDb(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public BigDecimal lookup(String tenantId, String componentTarget, String tableName,
                             List<Object> keys, LocalDate onDate) {

        // 1) fetch columns (order/types)
        String columnsJson = jdbc.query("""
                SELECT columns_json
                  FROM comp_table
                 WHERE tenant_id=:t AND component_target=:c AND table_name=:n
                """,
                Map.of("t", tenantId, "c", componentTarget, "n", tableName),
                rs -> rs.next() ? rs.getString(1) : null);

        if (columnsJson == null) {
            // Table doesn't exist - return zero instead of throwing exception
            return BigDecimal.ZERO;
        }

        List<String> cols = parseColumnOrder(columnsJson);
        if (cols.size() != keys.size()) {
            throw new IllegalArgumentException("Keys size mismatch for table " + tableName + " expected " + cols.size() + " got " + keys.size());
        }

        // 2) candidate rows (effective on date)
        List<Row> rows = jdbc.query("""
                SELECT keys_json, value
                  FROM comp_table_row
                 WHERE tenant_id=:t AND component_target=:c AND table_name=:n
                   AND effective_from <= :d AND :d <= effective_to
                """,
                Map.of("t", tenantId, "c", componentTarget, "n", tableName, "d", onDate),
                (rs, i) -> new Row(rs.getString("keys_json"), rs.getBigDecimal("value")));

        BigDecimal hit = null;
        for (Row r : rows) {
            if (matches(cols, keys, r.keysJson())) {
                if (hit != null) throw new IllegalStateException("Multiple matches in " + tableName);
                hit = r.value();
            }
        }
        // Return zero if no matching row found (graceful degradation)
        if (hit == null) {
            return BigDecimal.ZERO;
        }
        return hit;
    }

    private record Row(String keysJson, BigDecimal value) {}

    private List<String> parseColumnOrder(String columnsJson) {
        try {
            var arr = mapper.readTree(columnsJson);
            List<String> names = new ArrayList<>();
            arr.forEach(n -> names.add(n.get("name").asText()));
            return names;
        } catch (Exception e) {
            throw new IllegalArgumentException("Bad columns_json", e);
        }
    }

    private boolean matches(List<String> cols, List<Object> args, String keysJson) {
        try {
            var node = mapper.readTree(keysJson);
            for (int i = 0; i < cols.size(); i++) {
                String col = cols.get(i);
                Object val = args.get(i);
                var keyNode = node.get(col);
                if (keyNode == null) return false;

                // Check if this is a range object (has min or max property)
                if (keyNode.isObject() && (keyNode.has("min") || keyNode.has("max")) && val instanceof Number num) {
                    double v = num.doubleValue();
                    boolean matches = true;
                    
                    // Check min bound (if present) - inclusive: v >= min
                    if (keyNode.has("min") && !keyNode.get("min").isNull()) {
                        double min = keyNode.get("min").asDouble();
                        if (v < min) {
                            matches = false;
                        }
                    }
                    
                    // Check max bound (if present) - exclusive: v < max (max is NOT included)
                    if (matches && keyNode.has("max") && !keyNode.get("max").isNull()) {
                        double max = keyNode.get("max").asDouble();
                        if (v >= max) {  // Changed from > to >= to exclude max
                            matches = false;
                        }
                    }
                    
                    if (!matches) return false;
                } else {
                    // Exact match for non-range values
                    // Handle numeric comparison properly - compare numbers numerically, not as strings
                    if (val instanceof Number num && keyNode.isNumber()) {
                        // Both are numbers - compare numerically
                        double keyValue = keyNode.asDouble();
                        double lookupValue = num.doubleValue();
                        if (Math.abs(keyValue - lookupValue) > 0.0001) { // Use small epsilon for floating point comparison
                            return false;
                        }
                    } else if (val instanceof Number num && keyNode.isTextual()) {
                        // Key is stored as text but lookup value is number - try to parse and compare
                        try {
                            double keyValue = Double.parseDouble(keyNode.asText());
                            double lookupValue = num.doubleValue();
                            if (Math.abs(keyValue - lookupValue) > 0.0001) {
                                return false;
                            }
                        } catch (NumberFormatException e) {
                            // Can't parse as number, fall through to string comparison
                            String s = String.valueOf(val);
                            if (!Objects.equals(keyNode.asText(), s)) return false;
                        }
                    } else if (keyNode.isNumber() && val instanceof String str) {
                        // Key is stored as number but lookup value is string - try to parse and compare
                        try {
                            double keyValue = keyNode.asDouble();
                            double lookupValue = Double.parseDouble(str);
                            if (Math.abs(keyValue - lookupValue) > 0.0001) {
                                return false;
                            }
                        } catch (NumberFormatException e) {
                            // Can't parse as number, fall through to string comparison
                            if (!Objects.equals(keyNode.asText(), str)) return false;
                        }
                    } else {
                        // String comparison for non-numeric values
                        String s = String.valueOf(val);
                        if (!Objects.equals(keyNode.asText(), s)) return false;
                    }
                }
            }
            return true;
        } catch (Exception e) {
            throw new IllegalArgumentException("Bad keys_json", e);
        }
    }
}
