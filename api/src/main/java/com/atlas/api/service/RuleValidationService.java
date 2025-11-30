package com.atlas.api.service;

import com.atlas.api.model.dto.ValidateRequest;
import com.atlas.api.model.dto.ValidateResponse;
import com.atlas.engine.model.Rule;
import com.atlas.engine.model.RuleExpression;
import com.atlas.engine.model.RuleSet;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class RuleValidationService {

    private final ComponentGroupsService componentGroupsService;

    public RuleValidationService(ComponentGroupsService componentGroupsService) {
        this.componentGroupsService = componentGroupsService;
    }

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

        // Validate group references (check if components reference groups they're not allowed to)
        validateGroupReferences(rs, byTarget, issues, sample);

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
    
    /**
     * Validates that components don't reference groups they're not allowed to.
     * Components in group N can only reference groups 1 through N.
     */
    private void validateGroupReferences(RuleSet rs, Map<String, Rule> byTarget, 
                                        List<ValidateResponse.Issue> issues, Set<String> sample) {
        // Build component-to-group mapping
        Map<String, String> componentToGroup = new HashMap<>();
        Set<String> groupNames = new HashSet<>();
        for (Rule rule : rs.getRules()) {
            String componentName = rule.getTarget();
            Map<String, String> meta = rule.getMeta();
            if (meta != null) {
                String groupName = meta.get("group");
                if (groupName != null && !groupName.isEmpty()) {
                    String normalizedGroup = groupName.toLowerCase();
                    componentToGroup.put(componentName, normalizedGroup);
                    groupNames.add(normalizedGroup);
                }
            }
        }
        
        if (groupNames.isEmpty()) {
            return; // No groups, nothing to validate
        }
        
        // Build group-to-number mapping using display_order from database
        Map<String, Integer> groupToNumber = new HashMap<>();
        Map<Integer, String> numberToGroup = new HashMap<>();
        
        // Get groups from database ordered by display_order
        List<ComponentGroupsService.GroupDto> dbGroups = componentGroupsService.getAllGroups();
        Map<String, Integer> groupDisplayOrder = new HashMap<>();
        for (ComponentGroupsService.GroupDto group : dbGroups) {
            groupDisplayOrder.put(group.groupName().toLowerCase(), group.displayOrder());
        }
        
        // Sort groups by display_order
        List<String> sortedGroups = new ArrayList<>(groupNames);
        sortedGroups.sort((a, b) -> {
            Integer orderA = groupDisplayOrder.get(a);
            Integer orderB = groupDisplayOrder.get(b);
            if (orderA == null && orderB == null) return a.compareTo(b);
            if (orderA == null) return 1;
            if (orderB == null) return -1;
            int cmp = orderA.compareTo(orderB);
            return cmp != 0 ? cmp : a.compareTo(b);
        });
        
        // Assign group numbers
        int groupNumber = 1;
        for (String groupName : sortedGroups) {
            groupToNumber.put(groupName, groupNumber);
            numberToGroup.put(groupNumber, groupName);
            groupNumber++;
        }
        
        // Check each rule for invalid group references
        Set<String> allComponentNames = new HashSet<>(byTarget.keySet());
        allComponentNames.addAll(sample); // Include sample inputs
        // Add group names and group numbers so they can be detected in expressions
        for (int i = 1; i < groupNumber; i++) {
            allComponentNames.add("group" + i);
            String actualGroupName = numberToGroup.get(i);
            if (actualGroupName != null) {
                allComponentNames.add(actualGroupName);
                // Add capitalized version
                if (!actualGroupName.isEmpty()) {
                    String capitalized = actualGroupName.substring(0, 1).toUpperCase() + 
                                       (actualGroupName.length() > 1 ? actualGroupName.substring(1) : "");
                    allComponentNames.add(capitalized);
                }
            }
        }
        
        for (Rule rule : rs.getRules()) {
            String componentName = rule.getTarget();
            String componentGroup = componentToGroup.get(componentName);
            Integer componentGroupNumber = componentGroup != null ? groupToNumber.get(componentGroup) : null;
            
            if (componentGroupNumber == null) {
                continue; // Component has no group, skip validation
            }
            
            // Extract group references from expression
            try {
                RuleExpression ruleExpr = new RuleExpression(rule.getExpression());
                Set<String> dependencies = ruleExpr.extractDependencies(allComponentNames);
                
                for (String dep : dependencies) {
                    // Check if this is a group reference (group1, group2, etc.)
                    String depLower = dep.toLowerCase();
                    if (depLower.startsWith("group") && depLower.length() > 5) {
                        try {
                            int referencedGroupNumber = Integer.parseInt(depLower.substring(5));
                            if (referencedGroupNumber > componentGroupNumber) {
                                issues.add(new ValidateResponse.Issue(
                                    componentName,
                                    "error",
                                    "Component in " + (componentGroup != null ? componentGroup : "unknown group") +
                                    " (group" + componentGroupNumber + ") cannot reference " + dep +
                                    ". Components can only reference earlier groups (not their own group or later groups)."
                                ));
                            } else if (referencedGroupNumber == componentGroupNumber) {
                                issues.add(new ValidateResponse.Issue(
                                    componentName,
                                    "error",
                                    "Component in " + componentGroup + " (group" + componentGroupNumber +
                                    ") cannot reference " + dep + " (its own group). This would create a circular dependency."
                                ));
                            }
                        } catch (NumberFormatException e) {
                            // Not a valid group number, ignore
                        }
                    } else if (groupToNumber.containsKey(depLower)) {
                        // Check if it's an actual group name
                        Integer referencedGroupNumber = groupToNumber.get(depLower);
                        if (referencedGroupNumber != null) {
                            if (referencedGroupNumber > componentGroupNumber) {
                                issues.add(new ValidateResponse.Issue(
                                    componentName,
                                    "error",
                                    "Component in " + componentGroup + " (group" + componentGroupNumber +
                                    ") cannot reference group '" + dep + "' (group" + referencedGroupNumber +
                                    "). Components can only reference earlier groups (not their own group or later groups)."
                                ));
                            } else if (referencedGroupNumber.equals(componentGroupNumber)) {
                                issues.add(new ValidateResponse.Issue(
                                    componentName,
                                    "error",
                                    "Component in " + componentGroup + " (group" + componentGroupNumber +
                                    ") cannot reference group '" + dep + "' (its own group). This would create a circular dependency."
                                ));
                            }
                        }
                    }
                }
            } catch (Exception e) {
                // If expression parsing fails, skip group validation for this rule
                // (other validation will catch the parsing error)
            }
        }
    }
}
