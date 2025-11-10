package com.atlas.engine.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.*;

@Data
@AllArgsConstructor
@Builder
public class RuleSet {
<<<<<<< HEAD
    private final String id;
    private final List<Rule> rules;
=======
    private String id;
    private List<Rule> rules;
>>>>>>> f4b783057e5112365cf0a997d5505aad4ad5f5bd

    public Map<String, Rule> activeRuleIndex(java.time.LocalDate date) {
        Map<String, Rule> idx = new HashMap<>();
        for (Rule r : rules) if (r.isActiveOn(date)) idx.put(r.getTarget(), r);
        return idx;
    }
}
