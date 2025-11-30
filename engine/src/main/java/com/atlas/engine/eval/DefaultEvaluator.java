package com.atlas.engine.eval;

import com.atlas.engine.expr.Functions;
import com.atlas.engine.expr.TableLookupServiceAdapter;
import com.atlas.engine.expr.RestrictedGroupAwareEvalContext;
import com.atlas.engine.expr.Value;
import com.atlas.engine.model.ComponentResult;
import com.atlas.engine.model.EvalContext;
import com.atlas.engine.model.EvaluationResult;
import com.atlas.engine.model.Rule;
import com.atlas.engine.model.RuleExpression;
import com.atlas.engine.model.RuleSet;
import com.atlas.engine.model.Trace;
import com.atlas.engine.spi.TableService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class DefaultEvaluator implements Evaluator {

    private final DependencyResolver resolver = new DependencyResolver();
    private final TableService tableService;

    public DefaultEvaluator(TableService tables) {
        this.tableService = tables;
    }

    @Override
    public EvaluationResult evaluateAll(RuleSet rules, EvalContext ctx) {
        Map<String, Rule> ruleIdx = rules.activeRuleIndex(ctx.periodDate());
        List<String> order = resolver.order(rules, ctx.periodDate());

        Map<String, Object> values = new HashMap<>(ctx.inputs()); // seed with inputs
        Map<String, ComponentResult> results = new LinkedHashMap<>();

        final String tenantId = String.valueOf(values.getOrDefault("_tenantId", "default"));
        final LocalDate periodDate = ctx.periodDate();

        // Build set of all component names (targets of rules)
        Set<String> componentNames = new HashSet<>(ruleIdx.keySet());
        componentNames.addAll(ctx.inputs().keySet());
        
        // Build component-to-group mapping and extract group names
        Map<String, String> componentToGroup = new HashMap<>();
        Set<String> groupNames = new HashSet<>();
        for (Rule rule : ruleIdx.values()) {
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
        
        // Map group names to sequential numbers (group1, group2, etc.)
        // Use display_order from database if available, otherwise sort alphabetically
        @SuppressWarnings("unchecked")
        Map<String, Integer> groupDisplayOrder = (Map<String, Integer>) values.get("_groupOrdering");
        
        List<String> sortedGroups = new ArrayList<>(groupNames);
        if (groupDisplayOrder != null && !groupDisplayOrder.isEmpty()) {
            // Sort by display_order from database
            sortedGroups.sort((a, b) -> {
                Integer orderA = groupDisplayOrder.get(a);
                Integer orderB = groupDisplayOrder.get(b);
                if (orderA == null && orderB == null) return a.compareTo(b);
                if (orderA == null) return 1; // nulls last
                if (orderB == null) return -1;
                int cmp = orderA.compareTo(orderB);
                return cmp != 0 ? cmp : a.compareTo(b); // If same order, sort alphabetically
            });
        } else {
            // Fallback to alphabetical sorting
            Collections.sort(sortedGroups);
        }
        
        Map<String, Integer> groupToNumber = new HashMap<>();
        Map<Integer, String> numberToGroup = new HashMap<>();
        int groupNumber = 1;
        for (String groupName : sortedGroups) {
            groupToNumber.put(groupName, groupNumber);
            numberToGroup.put(groupNumber, groupName);
            groupNumber++;
        }
        
        // Add group numbers (group1, group2, etc.) and group names to componentNames
        for (int i = 1; i < groupNumber; i++) {
            componentNames.add("group" + i);
            String actualGroupName = numberToGroup.get(i);
            if (actualGroupName != null) {
                componentNames.add(actualGroupName);
                // Add capitalized version
                if (!actualGroupName.isEmpty()) {
                    String capitalized = actualGroupName.substring(0, 1).toUpperCase() + 
                                       (actualGroupName.length() > 1 ? actualGroupName.substring(1) : "");
                    componentNames.add(capitalized);
                }
            }
        }

        // Reorder components by group (group1 first, then group2, etc.) while preserving dependencies
        order = reorderByGroup(order, componentToGroup, groupToNumber);
        
        // Read WorkPercent input (0-100). If missing or invalid, default to 100%.
        BigDecimal workPercent = BigDecimal.ONE;
        Object wpRaw = values.get("WorkPercent");
        if (wpRaw instanceof Number) {
            workPercent = BigDecimal.valueOf(((Number) wpRaw).doubleValue())
                    .divide(BigDecimal.valueOf(100));
        } else if (wpRaw instanceof String s && !s.isBlank()) {
            try {
                workPercent = new BigDecimal(s).divide(BigDecimal.valueOf(100));
            } catch (NumberFormatException ignored) {
                workPercent = BigDecimal.ONE;
            }
        }

        for (String comp : order) {
            Rule r = ruleIdx.get(comp);
            if (r == null) {
                continue; // Skip if rule not found
            }
            
            Trace trace = new Trace(comp);

            // Create a context that includes both inputs and calculated values
            // EvalContext is a record, so we create a new instance with the updated values map
            EvalContext ruleContext = new EvalContext(values, periodDate);

            // Register TBL function with adapter for this rule (must be done before parsing)
            TableLookupServiceAdapter tableAdapter = new TableLookupServiceAdapter(
                    tableService, tenantId, comp, periodDate);
            Functions.registerTbl(tableAdapter);

            // Create RuleExpression once and reuse it
            RuleExpression ruleExpr = new RuleExpression(r.getExpression());
            
            // Determine which group this component belongs to and its group number
            String componentGroup = componentToGroup.getOrDefault(comp, "").toLowerCase();
            Integer componentGroupNumber = groupToNumber.get(componentGroup);
            // If component has no group, allow all groups (use the maximum group number)
            int maxAllowedGroupNumber = componentGroupNumber != null ? componentGroupNumber : groupToNumber.size();
            
            // Create restricted group-aware evaluation context
            // Components can only reference earlier groups (not their own group to prevent circular dependencies)
            RestrictedGroupAwareEvalContext groupAwareContext = new RestrictedGroupAwareEvalContext(
                ruleContext, componentToGroup, groupToNumber, maxAllowedGroupNumber);
            
            // Trace the expression being evaluated
            trace.step("Expression: " + r.getExpression());
            if (componentGroupNumber != null) {
                trace.step("Component group: " + componentGroup + " (group" + componentGroupNumber + ")");
            }

            // Trace variable values
            try {
                Set<String> deps = ruleExpr.extractDependencies(componentNames);
                if (!deps.isEmpty()) {
                    trace.step("Dependencies:");
                    for (String v : deps) {
                        // Check if it's a group or component
                        String vLower = v.toLowerCase();
                        if (vLower.startsWith("group") && vLower.length() > 5) {
                            // It's a group number reference (group1, group2, etc.)
                            try {
                                int groupNum = Integer.parseInt(vLower.substring(5));
                                if (groupNum < maxAllowedGroupNumber) {
                                    Value groupValue = groupAwareContext.getComponent(v);
                                    trace.step("  " + v + " (group) = " + formatValue(groupValue.asNumber()));
                                } else {
                                    trace.step("  " + v + " (group) - NOT ALLOWED (would create circular dependency)");
                                }
                            } catch (NumberFormatException e) {
                                // Not a valid group number
                                Object val = values.getOrDefault(v, BigDecimal.ZERO);
                                trace.step("  " + v + " = " + formatValue(val));
                            }
                        } else if (groupToNumber.containsKey(vLower)) {
                            // It's a group name
                            Integer groupNum = groupToNumber.get(vLower);
                            if (groupNum != null && groupNum < maxAllowedGroupNumber) {
                                Value groupValue = groupAwareContext.getComponent(v);
                                trace.step("  " + v + " (group" + groupNum + ") = " + formatValue(groupValue.asNumber()));
                            } else {
                                trace.step("  " + v + " (group) - NOT ALLOWED (would create circular dependency)");
                            }
                        } else {
                            Object val = values.getOrDefault(v, BigDecimal.ZERO);
                            trace.step("  " + v + " = " + formatValue(val));
                        }
                    }
                } else {
                    trace.step("No dependencies (constant or input-only expression)");
                }
            } catch (Exception e) {
                // If extraction fails, continue without tracing
                trace.step("Warning: Could not extract dependencies: " + e.getMessage());
            }

            // Evaluate using the new expression system with tracing
            try {
                RuleExpression.EvaluationTraceResult traceResult = ruleExpr.evaluateWithTrace(groupAwareContext, componentNames);
                BigDecimal amount = traceResult.getValue();
                BigDecimal finalAmount = amount;
                
                // Add detailed calculation steps to trace
                trace.step("Calculation steps:");
                for (String step : traceResult.getTraceSteps()) {
                    trace.step("  " + step);
                }

                // Apply WorkPercent scaling if meta flag is set
                if (r.getMeta() != null) {
                    String workPercentFlag = r.getMeta().get("workPercent");
                    if ("true".equalsIgnoreCase(workPercentFlag)) {
                        trace.step("Applying WorkPercent scaling: " + amount.toPlainString() + " × " + workPercent.toPlainString());
                        finalAmount = amount.multiply(workPercent);
                        trace.step("After WorkPercent: " + finalAmount.toPlainString());
                    }
                }
                
                // Check for missing dependencies that evaluated to zero
                Set<String> deps = ruleExpr.extractDependencies(componentNames);
                for (String dep : deps) {
                    // Skip group names - they're resolved dynamically by the context
                    boolean isGroupName = false;
                    String depLower = dep.toLowerCase();
                    if (depLower.startsWith("group") && depLower.length() > 5) {
                        try {
                            Integer.parseInt(depLower.substring(5));
                            isGroupName = true; // It's a numbered group (group1, group2, etc.)
                        } catch (NumberFormatException ignored) {
                            // Not a numbered group
                        }
                    }
                    if (!isGroupName && groupToNumber.containsKey(depLower)) {
                        isGroupName = true; // It's an actual group name
                    }
                    
                    if (!isGroupName && !values.containsKey(dep) && !ctx.inputs().containsKey(dep)) {
                        trace.step("WARNING: Component '" + dep + "' not found - using 0");
                    }
                }
                
                values.put(comp, finalAmount);
                trace.done("Result: " + finalAmount.toPlainString());
                results.put(comp, new ComponentResult(comp, finalAmount, trace));
            } catch (Exception e) {
                // On error, set to zero and trace the error
                BigDecimal amount = BigDecimal.ZERO;
                String errorMsg = "Unknown error";
                try {
                    if (e != null) {
                        errorMsg = e.getMessage();
                        if (errorMsg == null || errorMsg.isEmpty()) {
                            String className = e.getClass() != null ? e.getClass().getSimpleName() : "Exception";
                            errorMsg = className;
                            if (e.getCause() != null) {
                                String causeMsg = e.getCause().getMessage();
                                if (causeMsg != null && !causeMsg.isEmpty()) {
                                    errorMsg += ": " + causeMsg;
                                } else {
                                    String causeClassName = e.getCause().getClass() != null ? e.getCause().getClass().getSimpleName() : "Unknown";
                                    errorMsg += ": " + causeClassName;
                                }
                            }
                        }
                    }
                } catch (Exception ex) {
                    errorMsg = "Error formatting exception: " + (ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName());
                }
                trace.step("ERROR: " + errorMsg);
                try {
                    if (e != null && e.getCause() != null && e.getCause().getMessage() != null && !e.getCause().getMessage().equals(errorMsg)) {
                        trace.step("Caused by: " + e.getCause().getMessage());
                    }
                } catch (Exception ex) {
                    // Ignore errors in logging cause
                }
                // Also log the stack trace for debugging
                if (e != null) {
                    e.printStackTrace();
                }
                trace.done(comp + " = " + amount.toPlainString() + " (error)");
                values.put(comp, amount);
                results.put(comp, new ComponentResult(comp, amount, trace));
            }
        }

        BigDecimal total = results.values().stream()
                .map(ComponentResult::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new EvaluationResult(results, total);
    }
    
    private String formatValue(Object val) {
        if (val == null) return "0";
        if (val instanceof BigDecimal) {
            return ((BigDecimal) val).toPlainString();
        }
        return String.valueOf(val);
    }
    
    /**
     * Reorder components by group number (group1 first, then group2, etc.) while preserving
     * the relative dependency order within each group.
     * 
     * @param dependencyOrder The list of components ordered by dependencies
     * @param componentToGroup Map from component name to group name (lowercase)
     * @param groupToNumber Map from group name (lowercase) to group number (1, 2, 3, ...)
     * @return A new list ordered by group, then by dependencies within each group
     */
    private List<String> reorderByGroup(List<String> dependencyOrder, 
                                        Map<String, String> componentToGroup,
                                        Map<String, Integer> groupToNumber) {
        // Find the maximum group number
        int maxGroupNumber = groupToNumber.values().stream()
                .mapToInt(Integer::intValue)
                .max()
                .orElse(0);
        
        // Build a map of component -> group number
        // Components without a group get the highest group number + 1 (calculated last)
        Map<String, Integer> componentGroupNumber = new HashMap<>();
        for (String component : dependencyOrder) {
            String groupName = componentToGroup.get(component);
            if (groupName != null) {
                Integer groupNum = groupToNumber.get(groupName);
                componentGroupNumber.put(component, groupNum != null ? groupNum : maxGroupNumber + 1);
            } else {
                componentGroupNumber.put(component, maxGroupNumber + 1); // No group = calculate last
            }
        }
        
        // Group components by their group number, preserving relative order within each group
        Map<Integer, List<String>> componentsByGroup = new LinkedHashMap<>();
        for (String component : dependencyOrder) {
            Integer groupNum = componentGroupNumber.get(component);
            componentsByGroup.computeIfAbsent(groupNum, k -> new ArrayList<>()).add(component);
        }
        
        // Build the final ordered list: group 1 first, then 2, 3, etc., then ungrouped components
        List<String> reordered = new ArrayList<>();
        List<Integer> sortedGroupNumbers = new ArrayList<>(componentsByGroup.keySet());
        Collections.sort(sortedGroupNumbers);
        
        for (Integer groupNum : sortedGroupNumbers) {
            reordered.addAll(componentsByGroup.get(groupNum));
        }
        
        return reordered;
    }
}
