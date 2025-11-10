package com.atlas.api.service;

import com.atlas.api.model.dto.RuleDto;
import com.atlas.api.model.dto.RuleSetRequest;
import com.atlas.api.model.mapper.Mappers;
<<<<<<< HEAD
=======
import com.atlas.engine.model.Rule;
>>>>>>> f4b783057e5112365cf0a997d5505aad4ad5f5bd
import com.atlas.engine.model.RuleSet;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

@Service
public class RulesService {

    // tenantId -> (rulesetId -> RuleSet)
    private final Map<String, Map<String, RuleSet>> store = new HashMap<>();
    // tenantId -> active ruleset id + since date
    private final Map<String, String> activeByTenant = new HashMap<>();

<<<<<<< HEAD
=======
    public void replaceRules(String tenantId, String rulesetId, List<Rule> newRules) {
        RuleSet current = getById(tenantId, rulesetId);
        // Construct an updated RuleSet (immutable pattern)
        RuleSet updated = new RuleSet(current.getId(), newRules);
        // persist back to your store
        store.computeIfAbsent(tenantId, t -> new HashMap<>()).put(rulesetId, updated);
    }

>>>>>>> f4b783057e5112365cf0a997d5505aad4ad5f5bd
    public String saveDraft(RuleSetRequest req) {
        String tenant = req.tenantId() != null ? req.tenantId() : "default";
        String rulesetId = req.name() != null ? req.name() : UUID.randomUUID().toString();
        RuleSet rs = Mappers.toRuleSet(rulesetId, req.rules());
        store.computeIfAbsent(tenant, t -> new HashMap<>()).put(rulesetId, rs);
        return rulesetId;
    }

    public void publish(String tenantId, String rulesetId) {
        // naive: mark as active; in DB you'd keep effective dates
        activeByTenant.put(tenantFor(tenantId), rulesetId);
    }

    public RuleSet getActive(String tenantId, LocalDate onDate) {
        String tenant = tenantFor(tenantId);
        String activeId = activeByTenant.get(tenant);
        if (activeId == null) throw new IllegalStateException("No active ruleset for tenant="+tenant);
        RuleSet rs = store.getOrDefault(tenant, Map.of()).get(activeId);
        if (rs == null) throw new IllegalStateException("Active ruleset id not found: "+activeId);
        return rs;
    }

    public RuleSet getById(String tenantId, String id) {
        return store.getOrDefault(tenantFor(tenantId), Map.of()).get(id);
    }

    private String tenantFor(String tenantId) { return tenantId != null ? tenantId : "default"; }
}
