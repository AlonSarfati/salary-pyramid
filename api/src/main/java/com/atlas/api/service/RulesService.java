package com.atlas.api.service;

import com.atlas.api.model.dto.RuleSetRequest;
import com.atlas.engine.model.Rule;
import com.atlas.engine.model.RuleSet;

import java.time.LocalDate;
import java.util.List;

public interface RulesService {
    void replaceRules(String tenantId, String rulesetId, List<Rule> newRules);
    String saveDraft(RuleSetRequest req);
    void publish(String tenantId, String rulesetId);
    RuleSet getActive(String tenantId, LocalDate onDate);
    List<RuleSet> getActiveList(String tenantId, LocalDate onDate);
    RuleSet getById(String tenantId, String id);
}
