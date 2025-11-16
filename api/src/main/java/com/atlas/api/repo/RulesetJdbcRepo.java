// api/src/main/java/com/atlas/api/repo/RulesetJdbcRepo.java
package com.atlas.api.repo;

import org.springframework.jdbc.core.DataClassRowMapper;
import org.springframework.jdbc.core.namedparam.*;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.*;

@Repository
public class RulesetJdbcRepo {
    private final NamedParameterJdbcTemplate jdbc;
    public RulesetJdbcRepo(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record RulesetRow(String ruleset_id, String tenant_id, String name, String status) {}
    public record RuleRow(Long rule_id, String ruleset_id, String target, String expression,
                          String depends_on, String meta, java.sql.Date effective_from, java.sql.Date effective_to) {}

    public Optional<RulesetRow> findById(String tenantId, String rulesetId) {
        var sql = "SELECT ruleset_id, tenant_id, name, status FROM ruleset WHERE tenant_id=:t AND ruleset_id=:r";
        var rows = jdbc.query(sql, Map.of("t", tenantId, "r", rulesetId), new DataClassRowMapper<>(RulesetRow.class));
        return rows.stream().findFirst();
    }

    public Optional<String> findActiveRulesetId(String tenantId) {
        var sql = "SELECT ruleset_id FROM tenant_active_ruleset WHERE tenant_id=:t";
        var list = jdbc.queryForList(sql, Map.of("t", tenantId), String.class);
        return list.stream().findFirst();
    }

    public List<String> findAllActiveRulesetIds(String tenantId, LocalDate date) {

        String sql = """
        SELECT ruleset_id
        FROM ruleset
        WHERE tenant_id = :tenant
            AND status = 'ACTIVE'
    """;

        var params = new MapSqlParameterSource()
                .addValue("tenant", tenantId)
                .addValue("d", date);

        return jdbc.query(sql, params,
                (rs, rowNum) -> rs.getString("ruleset_id"));
    }

    public List<RuleRow> listRules(String rulesetId) {
        var sql = """
      SELECT rule_id, ruleset_id, target, expression,
             to_jsonb(depends_on)::text AS depends_on,
             to_jsonb(meta)::text AS meta,
             effective_from, effective_to
      FROM rule WHERE ruleset_id=:r ORDER BY target
    """;
        return jdbc.query(sql, Map.of("r", rulesetId), new DataClassRowMapper<>(RuleRow.class));
    }

    public void upsertRuleset(String rulesetId, String tenantId, String name, String status) {
        var sql = """
      INSERT INTO ruleset (ruleset_id, tenant_id, name, status)
      VALUES (:r,:t,:n,:s)
      ON CONFLICT (ruleset_id) DO UPDATE SET name=:n, status=:s
    """;
        jdbc.update(sql, new MapSqlParameterSource().addValue("r", rulesetId).addValue("t", tenantId)
                .addValue("n", name).addValue("s", status));
    }

    public void replaceRules(String rulesetId, List<Map<String,Object>> rules) {
        jdbc.update("DELETE FROM rule WHERE ruleset_id=:r", Map.of("r", rulesetId));
        var sql = """
      INSERT INTO rule (ruleset_id, target, expression, depends_on, meta, effective_from, effective_to)
      VALUES (:r,:target,:expr,CAST(:deps AS jsonb),CAST(:meta AS jsonb),:from,:to)
    """;
        for (var m : rules) {
            var ps = new MapSqlParameterSource()
                    .addValue("r", rulesetId)
                    .addValue("target", m.get("target"))
                    .addValue("expr", m.get("expression"))
                    .addValue("deps", m.getOrDefault("depends_on", "[]"))
                    .addValue("meta", m.getOrDefault("meta", "{}"))
                    .addValue("from", m.get("effective_from"))
                    .addValue("to", m.get("effective_to"));
            jdbc.update(sql, ps);
        }
    }

    public void setActive(String tenantId, String rulesetId) {
        var sql = """
      INSERT INTO tenant_active_ruleset (tenant_id, ruleset_id)
      VALUES (:t,:r)
      ON CONFLICT (tenant_id) DO UPDATE SET ruleset_id=:r, updated_at=now()
    """;
        jdbc.update(sql, Map.of("t", tenantId, "r", rulesetId));
        jdbc.update("UPDATE ruleset SET status='ACTIVE', published_at=now() WHERE ruleset_id=:r", Map.of("r", rulesetId));
    }
}
