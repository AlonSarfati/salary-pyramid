package com.atlas.api.controller;

import com.atlas.api.model.dto.RuleSetRequest;
import com.atlas.api.model.dto.RuleSetResponse;
import com.atlas.api.service.RulesService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/rulesets")
public class RulesController {

    private final RulesService rulesService;

    public RulesController(RulesService rulesService) { this.rulesService = rulesService; }

    @PostMapping
    public ResponseEntity<RuleSetResponse> create(@RequestBody RuleSetRequest req) {
        String id = rulesService.saveDraft(req);
        return ResponseEntity.ok(new RuleSetResponse(id, "DRAFT"));
    }

    @PostMapping("/{tenantId}/{rulesetId}/publish")
    public ResponseEntity<RuleSetResponse> publish(@PathVariable String tenantId,
                                                   @PathVariable String rulesetId) {
        rulesService.publish(tenantId, rulesetId);
        return ResponseEntity.ok(new RuleSetResponse(rulesetId, "ACTIVE"));
    }
}
