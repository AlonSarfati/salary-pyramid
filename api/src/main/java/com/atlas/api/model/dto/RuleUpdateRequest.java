package com.atlas.api.model.dto;

import java.util.List;

public record RuleUpdateRequest(
        String expression,            // e.g. "(${Base}+${Expert Bonus})*0.04"
        List<String> dependsOn,       // may be null -> infer from vars
        String effectiveFrom,         // yyyy-MM-dd or null
        String effectiveTo,           // yyyy-MM-dd or null
        String group,                 // component group
        Boolean incomeTax,            // income tax flag
        Boolean socialSecurity,
        Boolean pension,
        Boolean workPension,
        Boolean expensesPension,
        Boolean educationFund,
        Boolean workPercent          // apply WorkPercent flag
) {}
