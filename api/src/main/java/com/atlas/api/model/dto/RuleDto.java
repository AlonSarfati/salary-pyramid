package com.atlas.api.model.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record RuleDto(
        String target,
        String expression,
        List<String> dependsOn,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        Map<String,String> meta
) {}
