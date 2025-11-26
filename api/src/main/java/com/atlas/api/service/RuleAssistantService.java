package com.atlas.api.service;

import com.atlas.api.client.ExternalLlmClient;
import com.atlas.api.model.dto.ProposedRuleDto;
import com.atlas.api.model.dto.RuleAssistantRequest;
import com.atlas.api.model.dto.RuleAssistantResponse;
import com.atlas.engine.model.RuleExpression;
import com.atlas.engine.model.RuleSet;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Service for AI-powered rule generation using an external LLM (OpenAI).
 */
@Service
public class RuleAssistantService {
    
    private final ExternalLlmClient llmClient;
    private final RulesService rulesService;
    private final RuleGuideService ruleGuideService;
    private final ObjectMapper objectMapper;
    
    public RuleAssistantService(ExternalLlmClient llmClient, RulesService rulesService, RuleGuideService ruleGuideService) {
        this.llmClient = llmClient;
        this.rulesService = rulesService;
        this.ruleGuideService = ruleGuideService;
        this.objectMapper = new ObjectMapper();
    }
    
    /**
     * Generate a proposed rule from natural language prompt.
     */
    public RuleAssistantResponse generateRule(String tenantId, RuleAssistantRequest request) {
        if (request.prompt() == null || request.prompt().trim().isEmpty()) {
            return RuleAssistantResponse.error("Prompt cannot be empty");
        }
        
        List<String> warnings = new ArrayList<>();
        ProposedRuleDto proposedRule;
        String explanation = "";
        
        try {
            // Build system prompt with context about existing components if rulesetId is provided
            String systemPrompt = buildSystemPrompt(tenantId, request.rulesetId());
            
            // Call LLM
            String llmResponse = llmClient.generateJsonRule(systemPrompt, request.prompt());
            
            // Parse JSON response
            JsonNode jsonNode = objectMapper.readTree(llmResponse);
            
            // Extract proposed rule
            proposedRule = parseProposedRule(jsonNode);
            
            // Validate the proposed rule
            List<String> validationWarnings = validateProposedRule(tenantId, proposedRule, request.rulesetId());
            warnings.addAll(validationWarnings);
            
            // Extract explanation if present
            if (jsonNode.has("explanation")) {
                explanation = jsonNode.get("explanation").asText();
            } else {
                // Generate a simple explanation from the rule
                explanation = generateExplanation(proposedRule);
            }
            
        } catch (ExternalLlmClient.ExternalLlmException e) {
            return RuleAssistantResponse.error("Failed to call LLM: " + e.getMessage());
        } catch (Exception e) {
            ProposedRuleDto errorRule = new ProposedRuleDto(
                    null, null, null, null, null, null,
                    "Failed to parse LLM response: " + e.getMessage(),
                    "Parse error: " + e.getMessage()
            );
            return new RuleAssistantResponse(errorRule, "", List.of("Failed to parse LLM response"));
        }
        
        return new RuleAssistantResponse(proposedRule, explanation, warnings);
    }
    
    private String buildSystemPrompt(String tenantId, String rulesetId) {
        // Get the full rule builder guide
        String guide = ruleGuideService.getRuleBuilderGuide();
        
        // Build the system prompt
        StringBuilder prompt = new StringBuilder();
        prompt.append("You are a salary rules assistant. Your task is to convert natural language instructions into EXACTLY ONE JSON rule object.\n\n");
        prompt.append("RULES GUIDE:\n\n");
        prompt.append(guide);
        prompt.append("\n\n");
        prompt.append("OUTPUT FORMAT:\n\n");
        prompt.append("You must ALWAYS respond with a SINGLE JSON object and NOTHING else.\n");
        prompt.append("Do not wrap it in markdown code blocks.\n");
        prompt.append("Do not add explanations or comments outside the JSON.\n");
        prompt.append("The JSON must match this exact schema:\n\n");
        prompt.append("{\n");
        prompt.append("  \"target\": \"string (component name, e.g., 'Base', 'ManagerBonus')\",\n");
        prompt.append("  \"dependsOn\": [\"string\"] (list of component names this rule depends on),\n");
        prompt.append("  \"expression\": \"string (DSL expression using CamelCase for components, ALL_CAPS for functions)\",\n");
        prompt.append("  \"taxable\": boolean (default: true),\n");
        prompt.append("  \"filters\": {\n");
        prompt.append("    \"role\": \"string (optional, e.g., 'Manager', 'Engineer')\",\n");
        prompt.append("    \"minYears\": number (optional, minimum years of service),\n");
        prompt.append("    \"maxYears\": number (optional, maximum years of service)\n");
        prompt.append("  },\n");
        prompt.append("  \"effectiveFrom\": \"YYYY-MM-DD\" (optional, start date),\n");
        prompt.append("  \"description\": \"string (optional, human-readable description)\"\n");
        prompt.append("}\n\n");
        prompt.append("EXAMPLES:\n\n");
        prompt.append("Example 1:\n");
        prompt.append("User: \"From Jan 2027, give employees with more than 15 years 4% raise on Base, taxable.\"\n");
        prompt.append("Output:\n");
        prompt.append("{\"target\":\"Base\",\"dependsOn\":[\"Base\"],\"expression\":\"Base * 1.04\",\"taxable\":true,\"filters\":{\"minYears\":15},\"effectiveFrom\":\"2027-01-01\",\"description\":\"4% raise for employees with 15+ years of service\"}\n\n");
        prompt.append("Example 2:\n");
        prompt.append("User: \"Give all managers 7% raise on Base capped at 2000 starting Jan 2026\"\n");
        prompt.append("Output:\n");
        prompt.append("{\"target\":\"Base\",\"dependsOn\":[\"Base\"],\"expression\":\"MIN(Base * 1.07, Base + 2000)\",\"taxable\":true,\"filters\":{\"role\":\"Manager\"},\"effectiveFrom\":\"2026-01-01\",\"description\":\"7% raise on Base for managers, capped at 2000\"}\n\n");
        prompt.append("Only output valid JSON. If you are unsure, make your best guess but keep the JSON valid.\n");
        
        // Add context about existing components if rulesetId is provided
        if (rulesetId != null && !rulesetId.trim().isEmpty()) {
            try {
                RuleSet ruleset = rulesService.getById(tenantId, rulesetId);
                Set<String> existingComponents = new HashSet<>();
                for (var rule : ruleset.getRules()) {
                    existingComponents.add(rule.getTarget());
                }
                
                if (!existingComponents.isEmpty()) {
                    prompt.append("\n\nEXISTING COMPONENTS IN RULESET:\n");
                    prompt.append(String.join(", ", existingComponents));
                    prompt.append("\n\nWhen referencing components in expressions, use these exact names.");
                }
            } catch (Exception e) {
                // If we can't load the ruleset, continue without component context
            }
        }
        
        return prompt.toString();
    }
    
    private ProposedRuleDto parseProposedRule(JsonNode jsonNode) {
        String target = jsonNode.has("target") ? jsonNode.get("target").asText() : null;
        
        List<String> dependsOn = new ArrayList<>();
        if (jsonNode.has("dependsOn") && jsonNode.get("dependsOn").isArray()) {
            for (JsonNode dep : jsonNode.get("dependsOn")) {
                dependsOn.add(dep.asText());
            }
        }
        
        String expression = jsonNode.has("expression") ? jsonNode.get("expression").asText() : null;
        
        Boolean taxable = jsonNode.has("taxable") ? jsonNode.get("taxable").asBoolean() : true;
        
        Map<String, Object> filters = new HashMap<>();
        if (jsonNode.has("filters") && jsonNode.get("filters").isObject()) {
            JsonNode filtersNode = jsonNode.get("filters");
            if (filtersNode.has("role")) {
                filters.put("role", filtersNode.get("role").asText());
            }
            if (filtersNode.has("minYears")) {
                filters.put("minYears", filtersNode.get("minYears").asInt());
            }
            if (filtersNode.has("maxYears")) {
                filters.put("maxYears", filtersNode.get("maxYears").asInt());
            }
        }
        
        String effectiveFrom = null;
        if (jsonNode.has("effectiveFrom") && !jsonNode.get("effectiveFrom").isNull()) {
            effectiveFrom = jsonNode.get("effectiveFrom").asText();
        }
        
        String description = jsonNode.has("description") ? jsonNode.get("description").asText() : null;
        
        return new ProposedRuleDto(target, dependsOn, expression, taxable, filters, effectiveFrom, description, null);
    }
    
    private List<String> validateProposedRule(String tenantId, ProposedRuleDto rule, String rulesetId) {
        List<String> warnings = new ArrayList<>();
        
        // Validate target
        if (rule.target() == null || rule.target().trim().isEmpty()) {
            warnings.add("Target component name is missing");
        }
        
        // Validate expression
        if (rule.expression() == null || rule.expression().trim().isEmpty()) {
            warnings.add("Expression is missing");
        } else {
            // Try to parse and validate expression syntax
            try {
                RuleExpression ruleExpr = new RuleExpression(rule.expression());
                Set<String> availableComponents = new HashSet<>();
                
                // Get existing components from ruleset if available
                if (rulesetId != null && !rulesetId.trim().isEmpty()) {
                    try {
                        RuleSet ruleset = rulesService.getById(tenantId, rulesetId);
                        for (var r : ruleset.getRules()) {
                            availableComponents.add(r.getTarget());
                        }
                    } catch (Exception e) {
                        // Ignore if ruleset not found
                    }
                }
                
                RuleExpression.ValidationResult validation = ruleExpr.validate(availableComponents);
                if (!validation.isValid()) {
                    warnings.add("Expression validation failed: " + validation.getErrorMessage());
                }
            } catch (Exception e) {
                warnings.add("Expression parse error: " + e.getMessage());
            }
        }
        
        // Validate effectiveFrom date format
        if (rule.effectiveFrom() != null && !rule.effectiveFrom().trim().isEmpty()) {
            try {
                LocalDate.parse(rule.effectiveFrom(), DateTimeFormatter.ISO_DATE);
            } catch (Exception e) {
                warnings.add("Invalid date format for effectiveFrom: " + rule.effectiveFrom() + " (expected YYYY-MM-DD)");
            }
        }
        
        // Check if dependsOn components exist (if rulesetId provided)
        if (rulesetId != null && !rulesetId.trim().isEmpty() && !rule.dependsOn().isEmpty()) {
            try {
                RuleSet ruleset = rulesService.getById(tenantId, rulesetId);
                Set<String> existingComponents = new HashSet<>();
                for (var r : ruleset.getRules()) {
                    existingComponents.add(r.getTarget());
                }
                
                for (String dep : rule.dependsOn()) {
                    if (!existingComponents.contains(dep)) {
                        warnings.add("Dependency '" + dep + "' does not exist in the ruleset");
                    }
                }
            } catch (Exception e) {
                // Ignore if ruleset not found
            }
        }
        
        return warnings;
    }
    
    private String generateExplanation(ProposedRuleDto rule) {
        StringBuilder explanation = new StringBuilder();
        
        if (rule.target() != null) {
            explanation.append("This rule calculates '").append(rule.target()).append("'");
        }
        
        if (rule.expression() != null) {
            explanation.append(" using the expression: ").append(rule.expression());
        }
        
        if (rule.filters() != null && !rule.filters().isEmpty()) {
            explanation.append(" for employees matching: ");
            List<String> filterParts = new ArrayList<>();
            if (rule.filters().containsKey("role")) {
                filterParts.add("role=" + rule.filters().get("role"));
            }
            if (rule.filters().containsKey("minYears")) {
                filterParts.add("minYears=" + rule.filters().get("minYears"));
            }
            if (rule.filters().containsKey("maxYears")) {
                filterParts.add("maxYears=" + rule.filters().get("maxYears"));
            }
            explanation.append(String.join(", ", filterParts));
        }
        
        if (rule.effectiveFrom() != null) {
            explanation.append(" (effective from ").append(rule.effectiveFrom()).append(")");
        }
        
        return explanation.toString();
    }
}

