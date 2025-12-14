package com.atlas.api.controller;

import com.atlas.api.model.dto.RuleSetRequest;
import com.atlas.api.model.dto.RuleSetResponse;
import com.atlas.api.service.RulesService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/rulesets")
public class RulesController {

    private final RulesService rulesService;

    public RulesController(RulesService rulesService) { this.rulesService = rulesService; }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody RuleSetRequest req) {
        // Validate ruleset name doesn't contain slashes
        if (req.name() != null && (req.name().contains("/") || req.name().contains("\\"))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Ruleset name cannot contain slashes (/) or backslashes (\\)"));
        }
        String id = rulesService.saveDraft(req);
        return ResponseEntity.ok(new RuleSetResponse(id, "DRAFT"));
    }

    @PostMapping("/{tenantId}/{rulesetId}/publish")
    public ResponseEntity<RuleSetResponse> publish(@PathVariable String tenantId,
                                                   @PathVariable String rulesetId) {
        rulesService.publish(tenantId, rulesetId);
        return ResponseEntity.ok(new RuleSetResponse(rulesetId, "ACTIVE"));
    }

    @PutMapping("/{tenantId}/{rulesetId}")
    public ResponseEntity<?> renameRuleset(@PathVariable String tenantId,
                                           @PathVariable String rulesetId,
                                           @RequestBody Map<String, Object> body) {
        String newName = (String) body.get("name");
        if (newName == null || newName.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "name is required"));
        }
        // Validate ruleset name doesn't contain slashes
        if (newName.contains("/") || newName.contains("\\")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Ruleset name cannot contain slashes (/) or backslashes (\\)"));
        }
        rulesService.renameRuleset(tenantId, rulesetId, newName.trim());
        return ResponseEntity.ok(Map.of("rulesetId", rulesetId, "name", newName.trim()));
    }

    @DeleteMapping("/{tenantId}/{rulesetId}")
    public ResponseEntity<?> deleteRuleset(@PathVariable String tenantId,
                                           @PathVariable String rulesetId) {
        rulesService.deleteRuleset(tenantId, rulesetId);
        return ResponseEntity.ok(Map.of("status", "deleted", "rulesetId", rulesetId));
    }

    @PostMapping("/{tenantId}/{rulesetId}/copy")
    public ResponseEntity<?> copyRuleset(@PathVariable String tenantId,
                                         @PathVariable String rulesetId,
                                         @RequestBody(required = false) Map<String, Object> body) {
        String newId = body != null ? (String) body.get("rulesetId") : null;
        String newName = body != null ? (String) body.get("name") : null;

        // Validate ruleset name doesn't contain slashes
        if (newName != null && (newName.contains("/") || newName.contains("\\"))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Ruleset name cannot contain slashes (/) or backslashes (\\)"));
        }

        String createdId = rulesService.copyRuleset(tenantId, rulesetId, newId, newName);

        return ResponseEntity.ok(Map.of(
                "rulesetId", createdId,
                "name", newName != null && !newName.isBlank() ? newName : createdId,
                "status", "DRAFT"
        ));
    }
}