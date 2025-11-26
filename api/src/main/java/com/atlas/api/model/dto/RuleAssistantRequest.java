package com.atlas.api.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record RuleAssistantRequest(
        @JsonProperty("prompt") String prompt,
        @JsonProperty("rulesetId") String rulesetId
) {}

