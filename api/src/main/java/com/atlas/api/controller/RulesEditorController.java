package com.atlas.api.controller;

import com.atlas.api.model.dto.RuleUpdateRequest;
import com.atlas.api.model.dto.ValidateRequest;
import com.atlas.api.model.dto.ValidateResponse;
import com.atlas.api.service.RuleEditService;
import com.atlas.api.service.RuleValidationService;
import com.atlas.engine.model.RuleSet;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

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
    public ResponseEntity<?> getRuleset(@PathVariable String tenantId,
                                              @PathVariable String rulesetId) {
        try {
            return ResponseEntity.ok(edit.getRuleset(tenantId, rulesetId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            String errorMessage = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to get ruleset: " + errorMessage));
        }
    }

    // 2) Update one rule (formula, deps, dates, basic props)
    @PutMapping("/{tenantId}/{rulesetId}/rules/{target}")
    public ResponseEntity<?> updateRule(@PathVariable String tenantId,
                                              @PathVariable String rulesetId,
                                              @PathVariable String target,
                                              @RequestBody RuleUpdateRequest req) {
        try {
            RuleSet updated = edit.updateRule(tenantId, rulesetId, target, req);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            String errorMessage = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            if (e.getCause() != null) {
                errorMessage += " (Cause: " + e.getCause().getMessage() + ")";
            }
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to update rule: " + errorMessage));
        }
    }

    // 3) Validate (lint + cycles + unknown vars)
    @PostMapping("/{tenantId}/{rulesetId}/validate")
    public ResponseEntity<?> validate(@PathVariable String tenantId,
                                                     @PathVariable String rulesetId,
                                                     @RequestBody(required = false) ValidateRequest req) {
        try {
            RuleSet rs = edit.getRuleset(tenantId, rulesetId);
            return ResponseEntity.ok(validator.validate(rs, req));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            String errorMessage = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            if (e.getCause() != null) {
                errorMessage += " (Cause: " + e.getCause().getMessage() + ")";
            }
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to validate ruleset: " + errorMessage));
        }
    }

    // 4) Delete a rule from a ruleset
    @DeleteMapping("/{tenantId}/{rulesetId}/rules/{target}")
    public ResponseEntity<?> deleteRule(@PathVariable String tenantId,
                                              @PathVariable String rulesetId,
                                              @PathVariable String target) {
        try {
            RuleSet updated = edit.deleteRule(tenantId, rulesetId, target);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            String errorMessage = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to delete rule: " + errorMessage));
        }
    }
}
