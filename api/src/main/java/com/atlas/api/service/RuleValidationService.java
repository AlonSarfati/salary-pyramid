package com.atlas.api.service;

import com.atlas.api.model.dto.ValidateRequest;
import com.atlas.api.model.dto.ValidateResponse;
import com.atlas.engine.model.Rule;
import com.atlas.engine.model.RuleSet;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class RuleValidationService {

    // ${VarName} extractor
    private static final Pattern VAR = Pattern.compile("\\$\\{([^}]+)}");

    public ValidateResponse validate(RuleSet rs, ValidateRequest req) {
        // Build maps
        Map<String, Rule> byTarget = new HashMap<>();
        for (Rule r : rs.getRules()) byTarget.put(r.getTarget(), r);

        // Infer deps from expressions
        Map<String, Set<String>> deps = new HashMap<>();
        Set<String> referencedInputs = new HashSet<>();

        for (Rule r : rs.getRules()) {
            Set<String> d = new HashSet<>(Optional.ofNullable(r.getDependsOn()).orElse(List.of()));
            for (String v : extractVars(r.getExpression())) {
                if (byTarget.containsKey(v)) d.add(v);
                else referencedInputs.add(v);
            }
            deps.put(r.getTarget(), d);
        }

        // Cycle detection
        List<List<String>> cycles = findCycles(deps);

        // Unknown variables (not a rule target AND not provided in sample inputs)
        Set<String> sample = req != null && req.sampleInputs() != null
                ? req.sampleInputs().keySet()
                : Set.of();
        List<ValidateResponse.Issue> issues = new ArrayList<>();
        for (String v : referencedInputs) {
            if (!byTarget.containsKey(v) && !sample.contains(v)) {
                issues.add(new ValidateResponse.Issue(
                        "<global>", "error", "Unknown variable ${" + v + "} (not a component and not in sampleInputs)"
                ));
            }
        }

        // Missing target / empty expression checks
        for (Rule r : rs.getRules()) {
            if (r.getTarget() == null || r.getTarget().isBlank()) {
                issues.add(new ValidateResponse.Issue("<global>", "error", "A rule has empty target"));
            }
            if (r.getExpression() == null || r.getExpression().isBlank()) {
                issues.add(new ValidateResponse.Issue(r.getTarget(), "error", "Expression is empty"));
            }
        }

        boolean ok = cycles.isEmpty() && issues.stream().noneMatch(i -> "error".equalsIgnoreCase(i.severity()));
        return new ValidateResponse(ok, issues, cycles, List.copyOf(sample));
    }

    private static List<String> extractVars(String expr) {
        if (expr == null) return List.of();
        List<String> vars = new ArrayList<>();
        Matcher m = VAR.matcher(expr);
        while (m.find()) vars.add(m.group(1));
        return vars;
    }

    private static List<List<String>> findCycles(Map<String, Set<String>> deps) {
        List<List<String>> cycles = new ArrayList<>();
        Set<String> visited = new HashSet<>();
        Set<String> stack = new HashSet<>();
        Deque<String> path = new ArrayDeque<>();

        for (String node : deps.keySet()) {
            dfs(node, deps, visited, stack, path, cycles);
        }
        return cycles;
    }

    private static void dfs(String node, Map<String, Set<String>> deps,
                            Set<String> visited, Set<String> stack,
                            Deque<String> path, List<List<String>> cycles) {
        if (visited.contains(node)) return;
        visited.add(node);
        stack.add(node);
        path.addLast(node);

        for (String nxt : deps.getOrDefault(node, Set.of())) {
            if (!deps.containsKey(nxt)) continue; // dependency is an input, not a rule
            if (!visited.contains(nxt)) {
                dfs(nxt, deps, visited, stack, path, cycles);
            } else if (stack.contains(nxt)) {
                // cycle found: extract from nxt to end
                List<String> cyc = new ArrayList<>();
                boolean on = false;
                for (String p : path) {
                    if (p.equals(nxt)) on = true;
                    if (on) cyc.add(p);
                }
                cyc.add(nxt);
                cycles.add(cyc);
            }
        }

        stack.remove(node);
        path.removeLast();
    }
}
