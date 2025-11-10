package com.atlas.api.controller;

import com.atlas.api.model.dto.RuleUpdateRequest;
import com.atlas.api.model.dto.ValidateRequest;
import com.atlas.api.model.dto.ValidateResponse;
import com.atlas.api.service.RuleEditService;
import com.atlas.api.service.RuleValidationService;
import com.atlas.engine.model.RuleSet;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/rulesets")
public class RulesEditorController {

    private final RuleEditService edit;
    private final RuleValidationService validator;

    public RulesEditorController(RuleEditService edit, RuleValidationService validator) {
        this.edit = edit;
        this.validator = validator;
    }

    // 1) Fetch ruleset for editor
    @GetMapping("/{tenantId}/{rulesetId}")
    public ResponseEntity<RuleSet> getRuleset(@PathVariable String tenantId,
                                              @PathVariable String rulesetId) {
        return ResponseEntity.ok(edit.getRuleset(tenantId, rulesetId));
    }

    // 2) Update one rule (formula, deps, dates, basic props)
    @PutMapping("/{tenantId}/{rulesetId}/rules/{target}")
    public ResponseEntity<RuleSet> updateRule(@PathVariable String tenantId,
                                              @PathVariable String rulesetId,
                                              @PathVariable String target,
                                              @RequestBody RuleUpdateRequest req) {
        RuleSet updated = edit.updateRule(tenantId, rulesetId, target, req);
        return ResponseEntity.ok(updated);
    }

    // 3) Validate (lint + cycles + unknown vars)
    @PostMapping("/{tenantId}/{rulesetId}/validate")
    public ResponseEntity<ValidateResponse> validate(@PathVariable String tenantId,
                                                     @PathVariable String rulesetId,
                                                     @RequestBody(required = false) ValidateRequest req) {
        RuleSet rs = edit.getRuleset(tenantId, rulesetId);
        return ResponseEntity.ok(validator.validate(rs, req));
    }
}
