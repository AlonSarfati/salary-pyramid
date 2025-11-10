package com.atlas.api.service;

import com.atlas.api.model.dto.RuleSetRequest;
import com.atlas.api.model.mapper.Mappers;
import com.atlas.engine.model.Rule;
import com.atlas.engine.model.RuleSet;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

@Profile("memory")   // activate with SPRING_PROFILES_ACTIVE=memory
@Service
public class RulesServiceMemory implements RulesService {

    private final Map<String, Map<String, RuleSet>> store = new HashMap<>();
    private final Map<String, String> activeByTenant = new HashMap<>();

    @Override
    public void replaceRules(String tenantId, String rulesetId, List<Rule> newRules) {
        RuleSet current = getById(tenantId, rulesetId);
        RuleSet updated = new RuleSet(current.getId(), newRules);
        store.computeIfAbsent(tenantFor(tenantId), t -> new HashMap<>()).put(rulesetId, updated);
    }

    @Override
    public String saveDraft(RuleSetRequest req) {
        String tenant = tenantFor(req.tenantId());
        String rulesetId = req.name() != null ? req.name() : UUID.randomUUID().toString();
        RuleSet rs = Mappers.toRuleSet(rulesetId, req.rules());
        store.computeIfAbsent(tenant, t -> new HashMap<>()).put(rulesetId, rs);
        return rulesetId;
    }

    @Override
    public void publish(String tenantId, String rulesetId) {
        activeByTenant.put(tenantFor(tenantId), rulesetId);
    }

    @Override
    public RuleSet getActive(String tenantId, LocalDate onDate) {
        String tenant = tenantFor(tenantId);
        String activeId = activeByTenant.get(tenant);
        if (activeId == null) throw new IllegalStateException("No active ruleset for tenant=" + tenant);
        RuleSet rs = store.getOrDefault(tenant, Map.of()).get(activeId);
        if (rs == null) throw new IllegalStateException("Active ruleset id not found: " + activeId);
        return rs;
    }

    @Override
    public RuleSet getById(String tenantId, String id) {
        return store.getOrDefault(tenantFor(tenantId), Map.of()).get(id);
    }

    private static String tenantFor(String tenantId) { return tenantId != null ? tenantId : "default"; }
}
