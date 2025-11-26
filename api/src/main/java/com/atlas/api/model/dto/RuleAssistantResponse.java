package com.atlas.api.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record RuleAssistantResponse(
        @JsonProperty("proposedRule") ProposedRuleDto proposedRule,
        @JsonProperty("explanation") String explanation,
        @JsonProperty("warnings") List<String> warnings
) {
    public RuleAssistantResponse {
        if (warnings == null) warnings = List.of();
        if (explanation == null) explanation = "";
    }
    
    public static RuleAssistantResponse error(String errorMessage) {
        ProposedRuleDto errorRule = new ProposedRuleDto(
                null, null, null, null, null, null, null, errorMessage
        );
        return new RuleAssistantResponse(errorRule, "", List.of(errorMessage));
    }
}

