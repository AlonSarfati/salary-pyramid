package com.atlas.engine.eval;

import com.atlas.engine.model.Rule;
import com.atlas.engine.model.RuleExpression;
import com.atlas.engine.model.RuleSet;

import java.util.*;

public class DependencyResolver {

    public List<String> order(RuleSet rules, java.time.LocalDate date) {
        Map<String, Rule> idx = rules.activeRuleIndex(date);
        // Use LinkedHashSet to preserve insertion order from LinkedHashMap (deterministic)
        Set<String> targets = new LinkedHashSet<>(idx.keySet());
        // Use LinkedHashMap to preserve insertion order (deterministic)
        Map<String, Set<String>> graph = new LinkedHashMap<>();

        // Iterate over rules in deterministic order (by target name)
        List<Rule> sortedRules = new ArrayList<>(idx.values());
        sortedRules.sort(Comparator.comparing(Rule::getTarget)); // Sort by target for determinism
        
        for (Rule r : sortedRules) {
            Set<String> deps = new LinkedHashSet<>();
            if (r.getDependsOn() != null) {
                // Sort dependencies before adding to ensure deterministic order
                List<String> sortedDeps = new ArrayList<>(r.getDependsOn());
                Collections.sort(sortedDeps);
                deps.addAll(sortedDeps);
            }
            
            // Use RuleExpression to extract dependencies from the new expression syntax
            try {
                RuleExpression ruleExpr = new RuleExpression(r.getExpression());
                Set<String> exprDeps = ruleExpr.extractDependencies(targets);
                // Sort extracted dependencies before adding to ensure deterministic order
                List<String> sortedExprDeps = new ArrayList<>(exprDeps);
                Collections.sort(sortedExprDeps);
                deps.addAll(sortedExprDeps);
            } catch (Exception e) {
                // If parsing fails, the extractDependencies method will fall back to regex internally
                // So we can just catch and continue - dependencies will be empty for this rule
                // which is safe (it just means we can't determine dependencies automatically)
            }
            
            deps.remove(r.getTarget());      // no self-dep
            deps.retainAll(targets);         // <-- KEY: only keep deps that are also rule targets
            graph.put(r.getTarget(), deps);  // node = a rule we actually compute
        }
        return topoSort(graph);

    }

    private List<String> topoSort(Map<String, Set<String>> g) {
        Map<String,Integer> indeg = new LinkedHashMap<>();
        // Build indegree map - iterate in sorted order for determinism
        List<String> allNodes = new ArrayList<>(g.keySet());
        Collections.sort(allNodes); // Sort for deterministic processing
        
        for (String node : allNodes) {
            indeg.putIfAbsent(node, 0);
            Set<String> deps = g.get(node);
            if (deps != null) {
                for (String d : deps) {
                    indeg.putIfAbsent(d, 0);
                }
            }
        }
        
        // Calculate in-degrees
        for (String node : allNodes) {
            Set<String> deps = g.get(node);
            if (deps != null) {
                for (String d : deps) {
                    indeg.put(node, indeg.get(node) + 1);
                }
            }
        }

        // Use PriorityQueue for deterministic ordering (alphabetical)
        PriorityQueue<String> q = new PriorityQueue<>();
        for (Map.Entry<String, Integer> e : indeg.entrySet()) {
            if (e.getValue() == 0) {
                q.add(e.getKey());
            }
        }

        List<String> order = new ArrayList<>();
        while (!q.isEmpty()) {
            String n = q.poll();
            order.add(n);
            
            // Find all nodes that depend on n - iterate in sorted order for determinism
            for (String dependent : allNodes) {
                Set<String> deps = g.get(dependent);
                if (deps != null && deps.contains(n)) {
                    int newIndeg = indeg.get(dependent) - 1;
                    indeg.put(dependent, newIndeg);
                    if (newIndeg == 0) {
                        q.add(dependent);
                    }
                }
            }
        }
        
        if (order.size() != indeg.size()) {
            throw new IllegalStateException("Cyclic dependency detected");
        }
        return order;
    }
}
