package com.atlas.engine.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.*;

@Data
@AllArgsConstructor
@Builder
public class RuleSet {
    private String id;
    private List<Rule> rules;

    public Map<String, Rule> activeRuleIndex(java.time.LocalDate date) {
        // Use LinkedHashMap to preserve insertion order (deterministic)
        Map<String, Rule> idx = new LinkedHashMap<>();
        // Sort rules by target to ensure deterministic processing order
        List<Rule> sortedRules = new ArrayList<>(rules);
        sortedRules.sort(Comparator.comparing(Rule::getTarget));
        for (Rule r : sortedRules) {
            if (r.isActiveOn(date)) {
                idx.put(r.getTarget(), r);
            }
        }
        return idx;
    }
}
