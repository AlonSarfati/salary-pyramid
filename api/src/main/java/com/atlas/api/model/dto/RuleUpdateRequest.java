package com.atlas.api.model.dto;

import java.util.List;

public record RuleUpdateRequest(
        String expression,            // e.g. "(${Base}+${Expert Bonus})*0.04"
        List<String> dependsOn,       // may be null -> infer from vars
        String effectiveFrom,         // yyyy-MM-dd or null
        String effectiveTo,           // yyyy-MM-dd or null
        Boolean taxable,              // optional (if you store it on Rule/meta)
        String group                  // optional
) {}
