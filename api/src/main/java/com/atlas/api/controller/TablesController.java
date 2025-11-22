package com.atlas.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/tables")
public class TablesController {
    private final NamedParameterJdbcTemplate jdbc;
    private final com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();

    public TablesController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PostMapping("/{tenantId}/{component}/{tableName}")
    public ResponseEntity<?> createDef(@PathVariable String tenantId,
                                       @PathVariable String component,
                                       @PathVariable String tableName,
                                       @RequestBody Map<String,Object> body) {
        String description = (String) body.getOrDefault("description", "");
        String columns = toJson(body.get("columns")); // array of {name,type}
        jdbc.update("""
            INSERT INTO comp_table(tenant_id, component_target, table_name, description, columns_json)
            VALUES(:t,:c,:n,:d,CAST(:cols AS JSONB))
            ON CONFLICT (tenant_id, component_target, table_name)
            DO UPDATE SET description=:d, columns_json=CAST(:cols AS JSONB)
            """, Map.of("t",tenantId,"c",component,"n",tableName,"d",description,"cols",columns));
        return ResponseEntity.ok(Map.of("status","OK"));
    }

    @PutMapping("/{tenantId}/{component}/{tableName}/rows")
    public ResponseEntity<?> upsertRows(@PathVariable String tenantId,
                                        @PathVariable String component,
                                        @PathVariable String tableName,
                                        @RequestBody Map<String,Object> body) {
        var rows = (List<Map<String,Object>>) body.get("rows");
        
        // First, delete all existing rows for this table (replace-all strategy)
        jdbc.update("""
            DELETE FROM comp_table_row
             WHERE tenant_id=:t AND component_target=:c AND table_name=:n
            """, Map.of("t", tenantId, "c", component, "n", tableName));
        
        // Then insert all the new rows
        int count = 0;
        for (var r : rows) {
            // Parse to LocalDate (ISO-8601 "yyyy-MM-dd")
            var ef = java.time.LocalDate.parse(String.valueOf(r.getOrDefault("effectiveFrom","1900-01-01")));
            var et = java.time.LocalDate.parse(String.valueOf(r.getOrDefault("effectiveTo","9999-12-31")));

            var keysJson = toJson(r.get("keys"));
            var val      = new java.math.BigDecimal(String.valueOf(r.get("value")));

            var params = new org.springframework.jdbc.core.namedparam.MapSqlParameterSource()
                    .addValue("t", tenantId)
                    .addValue("c", component)
                    .addValue("n", tableName)
                    .addValue("ef", ef)   // <-- LocalDate; the driver maps this to DATE
                    .addValue("et", et)   // <-- LocalDate
                    .addValue("keys", keysJson)
                    .addValue("val", val);

            count += jdbc.update("""
            INSERT INTO comp_table_row(tenant_id, component_target, table_name,
                                       effective_from, effective_to, keys_json, value)
            VALUES(:t,:c,:n, :ef, :et, CAST(:keys AS JSONB), :val)
            """, params);
        }
        return ResponseEntity.ok(Map.of("upserted", count));
    }


    @PostMapping("/{tenantId}/{component}/{tableName}/lookup")
    public ResponseEntity<?> dryLookup(@PathVariable String tenantId,
                                       @PathVariable String component,
                                       @PathVariable String tableName,
                                       @RequestBody Map<String,Object> body) {
        var keys = (List<Object>) body.get("keys");
        var on = LocalDate.parse(String.valueOf(body.getOrDefault("on", LocalDate.now().toString())));

        // naive: just return first row's value with matching date (no JSON matching here)
        var vals = jdbc.query("""
            SELECT value
              FROM comp_table_row
             WHERE tenant_id=:t AND component_target=:c AND table_name=:n
               AND effective_from <= :d AND :d <= effective_to
            """,
                Map.of("t",tenantId,"c",component,"n",tableName,"d",on),
                (rs, i) -> rs.getBigDecimal("value"));
        return ResponseEntity.ok(Map.of("value", vals.isEmpty()? null : vals.get(0)));
    }

    // Get list of tables for a component
    @GetMapping("/{tenantId}/{component}")
    public ResponseEntity<?> listTables(@PathVariable String tenantId,
                                       @PathVariable String component) {
        var tables = jdbc.query("""
            SELECT table_name, description, columns_json
              FROM comp_table
             WHERE tenant_id=:t AND component_target=:c
             ORDER BY table_name
            """,
            Map.of("t", tenantId, "c", component),
            (rs, i) -> {
                try {
                    var columnsJson = rs.getString("columns_json");
                    var columns = mapper.readTree(columnsJson);
                    return Map.of(
                        "tableName", rs.getString("table_name"),
                        "description", rs.getString("description") != null ? rs.getString("description") : "",
                        "columns", columns
                    );
                } catch (Exception e) {
                    return Map.of(
                        "tableName", rs.getString("table_name"),
                        "description", rs.getString("description") != null ? rs.getString("description") : "",
                        "columns", List.of()
                    );
                }
            });
        return ResponseEntity.ok(Map.of("tables", tables));
    }

    // Get table definition and rows
    @GetMapping("/{tenantId}/{component}/{tableName}")
    public ResponseEntity<?> getTable(@PathVariable String tenantId,
                                      @PathVariable String component,
                                      @PathVariable String tableName) {
        // Get table definition
        var def = jdbc.query("""
            SELECT description, columns_json
              FROM comp_table
             WHERE tenant_id=:t AND component_target=:c AND table_name=:n
            """,
            Map.of("t", tenantId, "c", component, "n", tableName),
            rs -> {
                if (!rs.next()) return null;
                try {
                    var columnsJson = rs.getString("columns_json");
                    var columns = mapper.readTree(columnsJson);
                    return Map.of(
                        "description", rs.getString("description") != null ? rs.getString("description") : "",
                        "columns", columns
                    );
                } catch (Exception e) {
                    return Map.of(
                        "description", rs.getString("description") != null ? rs.getString("description") : "",
                        "columns", List.of()
                    );
                }
            });

        if (def == null) {
            // Table doesn't exist - return empty structure instead of 404
            return ResponseEntity.ok(Map.of(
                "description", "",
                "columns", List.of(),
                "rows", List.of()
            ));
        }

        // Get table rows
        var rows = jdbc.query("""
            SELECT effective_from, effective_to, keys_json, value
              FROM comp_table_row
             WHERE tenant_id=:t AND component_target=:c AND table_name=:n
             ORDER BY effective_from, keys_json
            """,
            Map.of("t", tenantId, "c", component, "n", tableName),
            (rs, i) -> {
                try {
                    var keysJson = rs.getString("keys_json");
                    var keys = mapper.readTree(keysJson);
                    return Map.of(
                        "effectiveFrom", rs.getDate("effective_from").toLocalDate().toString(),
                        "effectiveTo", rs.getDate("effective_to").toLocalDate().toString(),
                        "keys", keys,
                        "value", rs.getBigDecimal("value").toPlainString()
                    );
                } catch (Exception e) {
                    return Map.of(
                        "effectiveFrom", rs.getDate("effective_from").toLocalDate().toString(),
                        "effectiveTo", rs.getDate("effective_to").toLocalDate().toString(),
                        "keys", Map.of(),
                        "value", rs.getBigDecimal("value").toPlainString()
                    );
                }
            });

        var result = new java.util.HashMap<>(def);
        result.put("rows", rows);
        return ResponseEntity.ok(result);
    }

    private String toJson(Object o) {
        try { return mapper.writeValueAsString(o); }
        catch (Exception e) { throw new RuntimeException(e); }
    }
}
