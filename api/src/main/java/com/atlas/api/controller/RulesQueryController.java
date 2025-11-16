// api/src/main/java/com/atlas/api/controller/RulesQueryController.java
package com.atlas.api.controller;

import com.atlas.engine.model.RuleSet;
import com.atlas.api.service.RulesService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/rulesets")
public class RulesQueryController {
    private final RulesService rules;
    public RulesQueryController(RulesService rules) { this.rules = rules; }

    // minimal list: just return ids we know about in memory (tenant "default")
    @GetMapping("/{tenantId}/active")
    public ResponseEntity<Map<String, Object>> active(@PathVariable String tenantId) {
        List<RuleSet> list = rules.getActiveList(tenantId, LocalDate.now());

        return ResponseEntity.ok(
                Map.of(
                        "tenantId", tenantId,
                        "ruleSets", list.stream()
                                .map(rs -> Map.of(
                                        "rulesetId", rs.getId(),
                                        "count", rs.getRules().size()
                                ))
                                .toList()
                )
        );
    }

    // (optional) fetch a ruleset’s targets quickly for UI display
    @GetMapping("/{tenantId}/{rulesetId}/targets")
    public ResponseEntity<Map<String,Object>> targets(@PathVariable String tenantId, @PathVariable String rulesetId) {
        RuleSet rs = rules.getById(tenantId, rulesetId);
        var names = rs.getRules().stream().map(r -> r.getTarget()).toList();
        return ResponseEntity.ok(Map.of("rulesetId", rs.getId(), "targets", names));
    }
}
