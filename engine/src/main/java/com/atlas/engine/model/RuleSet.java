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
        Map<String, Rule> idx = new HashMap<>();
        for (Rule r : rules) if (r.isActiveOn(date)) idx.put(r.getTarget(), r);
        return idx;
    }
}
