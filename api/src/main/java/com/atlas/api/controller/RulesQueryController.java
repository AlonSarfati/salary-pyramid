// api/src/main/java/com/atlas/api/controller/RulesQueryController.java
package com.atlas.api.controller;

import com.atlas.engine.model.RuleSet;
import com.atlas.api.service.RulesService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/rulesets")
public class RulesQueryController {
    private final RulesService rules;
    private final com.atlas.api.service.RulesServiceDb rulesDb;
    private final com.atlas.api.repo.RulesetJdbcRepo rulesetRepo;
    
    public RulesQueryController(RulesService rules, com.atlas.api.service.RulesServiceDb rulesDb,
                                 com.atlas.api.repo.RulesetJdbcRepo rulesetRepo) { 
        this.rules = rules; 
        this.rulesDb = rulesDb;
        this.rulesetRepo = rulesetRepo;
    }

    // minimal list: just return ids we know about in memory (tenant "default")
    @GetMapping("/{tenantId}/active")
    public ResponseEntity<Map<String, Object>> active(@PathVariable String tenantId) {
        List<RuleSet> list = rules.getActiveList(tenantId, LocalDate.now());

        return ResponseEntity.ok(
                Map.of(
                        "tenantId", tenantId,
                        "ruleSets", list.stream()
                                .map(rs -> {
                                    // Get ruleset name from database
                                    String name = rulesDb.getRulesetName(tenantId, rs.getId());
                                    return Map.of(
                                            "rulesetId", rs.getId(),
                                            "name", name != null ? name : rs.getId(),
                                            "count", rs.getRules().size()
                                    );
                                })
                                .toList()
                )
        );
    }

    // (optional) fetch a ruleset's targets quickly for UI display
    @GetMapping("/{tenantId}/{rulesetId}/targets")
    public ResponseEntity<Map<String,Object>> targets(@PathVariable String tenantId, @PathVariable String rulesetId) {
        RuleSet rs = rules.getById(tenantId, rulesetId);
        var names = rs.getRules().stream().map(r -> r.getTarget()).toList();
        return ResponseEntity.ok(Map.of("rulesetId", rs.getId(), "targets", names));
    }

    // Get all rulesets for a tenant (not just active)
    @GetMapping("/{tenantId}/all")
    public ResponseEntity<List<Map<String, Object>>> getAllRulesets(@PathVariable String tenantId) {
        var allRulesets = rulesetRepo.findAllRulesets(tenantId);
        
        List<Map<String, Object>> response = new ArrayList<>();
        for (var rs : allRulesets) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("rulesetId", rs.ruleset_id());
            map.put("name", rs.name() != null ? rs.name() : rs.ruleset_id());
            map.put("status", rs.status());
            response.add(map);
        }
        
        return ResponseEntity.ok(response);
    }
}
