package com.atlas.engine.eval;

import com.atlas.engine.model.Rule;
import com.atlas.engine.model.RuleExpression;
import com.atlas.engine.model.RuleSet;

import java.util.*;

public class DependencyResolver {

    public List<String> order(RuleSet rules, java.time.LocalDate date) {
        Map<String, Rule> idx = rules.activeRuleIndex(date);
        Set<String> targets = idx.keySet();
        Map<String, Set<String>> graph = new HashMap<>();

        for (Rule r : idx.values()) {
            Set<String> deps = new LinkedHashSet<>();
            if (r.getDependsOn() != null) {
                deps.addAll(r.getDependsOn());
            }
            
            // Use RuleExpression to extract dependencies from the new expression syntax
            try {
                RuleExpression ruleExpr = new RuleExpression(r.getExpression());
                Set<String> exprDeps = ruleExpr.extractDependencies(targets);
                deps.addAll(exprDeps);
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
        Map<String,Integer> indeg = new HashMap<>();
        for (var e: g.entrySet()) {
            indeg.putIfAbsent(e.getKey(), 0);
            for (String d : e.getValue()) indeg.put(d, indeg.getOrDefault(d,0));
        }
        for (var e: g.entrySet()) for (String d: e.getValue()) indeg.put(e.getKey(), indeg.get(e.getKey())+1);

        Deque<String> q=new ArrayDeque<>();
        for (var e: indeg.entrySet()) if (e.getValue()==0) q.add(e.getKey());

        List<String> order=new ArrayList<>();
        while(!q.isEmpty()){
            String n=q.remove();
            order.add(n);
            for (var e: g.entrySet()) if (e.getValue().contains(n)) {
                indeg.put(e.getKey(), indeg.get(e.getKey())-1);
                if (indeg.get(e.getKey())==0) q.add(e.getKey());
            }
        }
        if (order.size()!=indeg.size()) throw new IllegalStateException("Cyclic dependency detected");
        return order;
    }
}
