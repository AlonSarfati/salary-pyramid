package com.atlas.api.controller;

import com.atlas.api.model.dto.RuleAssistantRequest;
import com.atlas.api.model.dto.RuleAssistantResponse;
import com.atlas.api.service.RuleAssistantService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/rules/assistant")
public class RuleAssistantController {
    
    private final RuleAssistantService assistantService;
    
    public RuleAssistantController(RuleAssistantService assistantService) {
        this.assistantService = assistantService;
    }
    
    @PostMapping("/generate")
    public ResponseEntity<RuleAssistantResponse> generateRule(
            @RequestParam(defaultValue = "default") String tenantId,
            @RequestBody RuleAssistantRequest request) {
        try {
            // Validate request
            if (request.prompt() == null || request.prompt().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(RuleAssistantResponse.error("Prompt cannot be empty"));
            }
            
            // Generate rule
            RuleAssistantResponse response = assistantService.generateRule(tenantId, request);
            
            // Check if there was a fatal error
            if (response.proposedRule().error() != null && 
                response.proposedRule().target() == null) {
                // This is a fatal error (not just validation warnings)
                return ResponseEntity.status(502)
                        .body(response);
            }
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            return ResponseEntity.status(500)
                    .body(RuleAssistantResponse.error("Internal server error: " + e.getMessage()));
        }
    }
}

