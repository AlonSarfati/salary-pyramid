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
    private String target;                 // e.g. "Responsibility Bonus"
    private String expression;             // e.g. "(${Base}+${Expert Bonus})*0.04"
    private List<String> dependsOn;        // explicit deps (optional but recommended)
    private LocalDate effectiveFrom;       // nullable => active since forever
    private LocalDate effectiveTo;         // nullable => active forever
    private Map<String,String> meta;       // caps, groups, flags, etc.

    public boolean isActiveOn(LocalDate date) {
        return (effectiveFrom == null || !date.isBefore(effectiveFrom))
                && (effectiveTo == null || !date.isAfter(effectiveTo));
    }
}
