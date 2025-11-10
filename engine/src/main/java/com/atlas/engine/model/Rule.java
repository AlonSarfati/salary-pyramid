package com.atlas.engine.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Data
@AllArgsConstructor
@Builder
public class Rule {
    private final String target;                 // e.g. "Responsibility Bonus"
    private final String expression;             // e.g. "(${Base}+${Expert Bonus})*0.04"
    private final List<String> dependsOn;        // explicit deps (optional but recommended)
    private final LocalDate effectiveFrom;       // nullable => active since forever
    private final LocalDate effectiveTo;         // nullable => active forever
    private final Map<String,String> meta;       // caps, groups, flags, etc.


    public boolean isActiveOn(LocalDate date) {
        return (effectiveFrom == null || !date.isBefore(effectiveFrom))
                && (effectiveTo == null || !date.isAfter(effectiveTo));
    }
}
