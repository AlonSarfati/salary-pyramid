package com.atlas.api.controller;

import com.atlas.api.model.dto.RuleSetRequest;
import com.atlas.api.model.dto.RuleSetResponse;
import com.atlas.api.service.RulesService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/rulesets")
public class RulesController {

    private final RulesService rules;

    public RulesController(RulesService rules) { this.rules = rules; }

    @PostMapping
    public ResponseEntity<RuleSetResponse> create(@RequestBody RuleSetRequest req) {
        String id = rules.saveDraft(req);
        return ResponseEntity.ok(new RuleSetResponse(id, "DRAFT"));
    }

    @PostMapping("/{tenantId}/{rulesetId}/publish")
    public ResponseEntity<RuleSetResponse> publish(@PathVariable String tenantId,
                                                   @PathVariable String rulesetId) {
        rules.publish(tenantId, rulesetId);
        return ResponseEntity.ok(new RuleSetResponse(rulesetId, "ACTIVE"));
    }
}
