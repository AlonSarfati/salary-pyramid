package com.atlas.api.service;

import com.atlas.api.model.dto.RuleSetRequest;
import com.atlas.api.repo.RulesetJdbcRepo;
import com.atlas.engine.model.Rule;
import com.atlas.engine.model.RuleSet;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

@Profile("postgres")   // activate with SPRING_PROFILES_ACTIVE=postgres
@Service
public class RulesServiceDb implements RulesService {

    private final RulesetJdbcRepo repo;

    public RulesServiceDb(RulesetJdbcRepo repo) { this.repo = repo; }

    @Override
    public void replaceRules(String tenantId, String rulesetId, List<Rule> newRules) {
        var rows = new ArrayList<Map<String,Object>>();
        for (var r : newRules) {
            var m = new LinkedHashMap<String,Object>();
            m.put("target", r.getTarget());
            m.put("expression", r.getExpression());
            m.put("depends_on", Jsons.toJsonArray(r.getDependsOn()));
            m.put("meta", Jsons.toJsonObject(r.getMeta() == null ? Map.of() : r.getMeta()));
            m.put("effective_from", r.getEffectiveFrom());
            m.put("effective_to", r.getEffectiveTo());
            rows.add(m);
        }
        repo.replaceRules(rulesetId, rows);
    }

    @Override
    @Transactional
    public String saveDraft(RuleSetRequest req) {
        var tenant = tenant(req.tenantId());
        var rulesetId = req.name() != null ? req.name() : UUID.randomUUID().toString();
        repo.upsertRuleset(rulesetId, tenant, req.name() != null ? req.name() : rulesetId, "DRAFT");

        var rows = new ArrayList<Map<String,Object>>();
        for (var r : req.rules()) {
            var m = new LinkedHashMap<String,Object>();
            m.put("target", r.target());
            m.put("expression", r.expression());
            m.put("depends_on", Jsons.toJsonArray(r.dependsOn()));
            m.put("meta", Jsons.toJsonObject(Map.of()));
            m.put("effective_from", null);
            m.put("effective_to", null);
            rows.add(m);
        }
        repo.replaceRules(rulesetId, rows);
        return rulesetId;
    }

    @Override
    public void publish(String tenantId, String rulesetId) { repo.setActive(tenant(tenantId), rulesetId); }

    @Override
    public RuleSet getActive(String tenantId, LocalDate onDate) {
        var rid = repo.findActiveRulesetId(tenant(tenantId))
                .orElseThrow(() -> new IllegalStateException("No active ruleset for tenant=" + tenant(tenantId)));
        return getById(tenantId, rid);
    }

    @Override
    public List<RuleSet> getActiveList(String tenantId, LocalDate onDate) {
        var ids = repo.findAllActiveRulesetIds(tenant(tenantId), onDate);
        return ids.stream()
                .map(id -> getById(tenantId, id))
                .toList();
    }

    @Override
    public RuleSet getById(String tenantId, String id) {
        var rs = repo.findById(tenant(tenantId), id)
                .orElseThrow(() -> new NoSuchElementException("Ruleset not found: " + id));
        var rows = repo.listRules(id);
        var rules = new ArrayList<Rule>();
        for (var row : rows) {
            rules.add(new Rule(
                    row.target(),
                    row.expression(),
                    Jsons.stringArray(row.depends_on()),
                    row.effective_from() == null ? null : row.effective_from().toLocalDate(),
                    row.effective_to() == null ? null : row.effective_to().toLocalDate(),
                    Jsons.map(row.meta())
            ));
        }
        return new RuleSet(rs.ruleset_id(), rules);
    }

    public String getRulesetName(String tenantId, String rulesetId) {
        return repo.findById(tenant(tenantId), rulesetId)
                .map(rs -> rs.name())
                .orElse(rulesetId);
    }

    @Override
    public void renameRuleset(String tenantId, String rulesetId, String newName) {
        repo.updateRulesetName(tenant(tenantId), rulesetId, newName);
    }

    @Override
    public void deleteRuleset(String tenantId, String rulesetId) {
        repo.deleteRuleset(tenant(tenantId), rulesetId);
    }

    private static String tenant(String t) { return t != null ? t : "default"; }
}
