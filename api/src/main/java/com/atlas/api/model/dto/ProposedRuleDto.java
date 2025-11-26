package com.atlas.api.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

public record ProposedRuleDto(
        @JsonProperty("target") String target,
        @JsonProperty("dependsOn") List<String> dependsOn,
        @JsonProperty("expression") String expression,
        @JsonProperty("taxable") Boolean taxable,
        @JsonProperty("filters") Map<String, Object> filters,
        @JsonProperty("effectiveFrom") String effectiveFrom,
        @JsonProperty("description") String description,
        @JsonProperty("error") String error
) {
    public ProposedRuleDto {
        // Ensure non-null defaults
        if (dependsOn == null) dependsOn = List.of();
        if (filters == null) filters = Map.of();
        if (taxable == null) taxable = true;
    }
}

