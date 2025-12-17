package com.atlas.engine.expr;

import com.atlas.engine.model.EvalContext;

import java.math.BigDecimal;
import java.util.*;

/**
 * Evaluation context that supports group references with restrictions.
 * Groups are numbered sequentially (group1, group2, etc.) and components can only
 * reference their own group or earlier groups to prevent circular dependencies.
 */
public class RestrictedGroupAwareEvalContext implements com.atlas.engine.expr.EvalContext {
    private final DefaultEvalContext baseContext;
    private final Map<String, String> componentToGroup; // component name -> group name (normalized)
    private final Map<String, Integer> groupToNumber; // group name -> group number (1, 2, 3, ...)
    private final Map<Integer, String> numberToGroup; // group number -> group name
    private final int maxAllowedGroupNumber; // maximum group number this component can access
    // Dynamic toggle groups: key = toggle group name (e.g., "pension_group"), value = set of component names
    private final Map<String, Set<String>> toggleGroups;
    
    public RestrictedGroupAwareEvalContext(
            EvalContext modelContext,
            Map<String, String> componentToGroup,
            Map<String, Integer> groupToNumber,
            int maxAllowedGroupNumber,
            Map<String, Set<String>> toggleGroups) {
        if (modelContext == null) {
            throw new IllegalArgumentException("modelContext cannot be null");
        }
        this.baseContext = new DefaultEvalContext(modelContext);
        this.componentToGroup = componentToGroup != null ? componentToGroup : new HashMap<>();
        this.groupToNumber = groupToNumber != null ? groupToNumber : new HashMap<>();
        this.numberToGroup = new HashMap<>();
        if (this.groupToNumber != null) {
            for (Map.Entry<String, Integer> entry : this.groupToNumber.entrySet()) {
                numberToGroup.put(entry.getValue(), entry.getKey());
            }
        }
        this.maxAllowedGroupNumber = Math.max(0, maxAllowedGroupNumber);
        this.toggleGroups = toggleGroups != null ? toggleGroups : new HashMap<>();
    }
    
    @Override
    public Value getComponent(String componentName) {
        // Dynamic toggle groups: any {toggle}_group = sum of all components with that toggle enabled
        // Rule: meta key with value "true" → {camelCaseToSnakeCase(key)}_group
        String normalizedComponentName = componentName.toLowerCase();
        if (toggleGroups.containsKey(normalizedComponentName)) {
            return sumToggleGroup(normalizedComponentName);
        }

        // Check if this is a group reference (group1, group2, etc.)
        if (componentName.toLowerCase().startsWith("group") && componentName.length() > 5) {
            try {
                String numberStr = componentName.substring(5); // "group1" -> "1"
                int groupNumber = Integer.parseInt(numberStr);
                
                // Check if this group number is allowed (must be < maxAllowedGroupNumber)
                // Components cannot reference their own group to prevent circular dependencies
                if (groupNumber >= maxAllowedGroupNumber) {
                    throw new IllegalArgumentException(
                        "Component cannot reference group" + groupNumber + 
                        ". Components can only reference earlier groups (not their own group or later groups).");
                }
                
                // Sum all components in this group AND all previous groups (cumulative)
                return sumGroupCumulative(groupNumber);
            } catch (NumberFormatException e) {
                // Not a valid group number, treat as regular component
            }
        }
        
        // Check if this is an actual group name (case-insensitive)
        String normalizedName = componentName.toLowerCase();
        Integer groupNumber = groupToNumber.get(normalizedName);
        if (groupNumber != null) {
            // Check if this group is allowed (must be < maxAllowedGroupNumber)
            // Components cannot reference their own group to prevent circular dependencies
            if (groupNumber >= maxAllowedGroupNumber) {
                throw new IllegalArgumentException(
                    "Component cannot reference group '" + componentName + 
                    "'. Components can only reference earlier groups (not their own group or later groups).");
            }
            // Sum all components in this group AND all previous groups (cumulative)
            return sumGroupCumulative(groupNumber);
        }
        
        // Otherwise, treat as regular component
        return baseContext.getComponent(componentName);
    }

    /**
     * Sum all components that are tagged with a specific toggle flag.
     * 
     * @param toggleGroupName The toggle group name (e.g., "pension_group", "income_tax_group")
     * @return The sum of all components with this toggle enabled
     */
    private Value sumToggleGroup(String toggleGroupName) {
        BigDecimal sum = BigDecimal.ZERO;
        Set<String> components = toggleGroups.get(toggleGroupName);
        if (components != null) {
            for (String componentName : components) {
                Value componentValue = baseContext.getComponent(componentName);
                if (componentValue != null && componentValue.getType() == ValueType.NUMBER) {
                    sum = sum.add(componentValue.asNumber());
                }
            }
        }
        return Value.ofNumber(sum);
    }
    
    /**
     * Sum all components in the specified group AND all previous groups (cumulative).
     * For example, group2 includes group1 + group2, and group3 includes group1 + group2 + group3.
     */
    private Value sumGroupCumulative(int targetGroupNumber) {
        BigDecimal sum = BigDecimal.ZERO;
        
        // Sum components from group1 up to and including the target group
        for (int i = 1; i <= targetGroupNumber; i++) {
            String actualGroupName = numberToGroup.get(i);
            if (actualGroupName != null) {
                String normalizedGroupName = actualGroupName.toLowerCase();
                for (Map.Entry<String, String> entry : componentToGroup.entrySet()) {
                    // Compare normalized group names
                    if (normalizedGroupName.equals(entry.getValue().toLowerCase())) {
                        Value componentValue = baseContext.getComponent(entry.getKey());
                        if (componentValue != null && componentValue.getType() == ValueType.NUMBER) {
                            sum = sum.add(componentValue.asNumber());
                        }
                    }
                }
            }
        }
        
        return Value.ofNumber(sum);
    }
    
    /**
     * @deprecated Use sumGroupCumulative instead. This method is kept for backward compatibility
     * but should not be used as groups are now cumulative.
     */
    @Deprecated
    private Value sumGroup(String groupName) {
        BigDecimal sum = BigDecimal.ZERO;
        // Normalize the group name for comparison
        String normalizedGroupName = groupName.toLowerCase();
        Integer groupNumber = groupToNumber.get(normalizedGroupName);
        if (groupNumber != null) {
            return sumGroupCumulative(groupNumber);
        }
        return Value.ofNumber(sum);
    }
    
    @Override
    public Set<String> getComponentNames() {
        try {
            // Create a mutable copy of the base context's component names
            Set<String> baseNames = baseContext != null ? baseContext.getComponentNames() : new HashSet<>();
            Set<String> names = new HashSet<>(baseNames);
            // Add group numbers (group1, group2, etc.) up to (but not including) maxAllowedGroupNumber
            // Components cannot reference their own group to prevent circular dependencies
            for (int i = 1; i < maxAllowedGroupNumber; i++) {
                names.add("group" + i);
                // Also add the actual group name if it exists
                if (numberToGroup != null) {
                    String actualGroupName = numberToGroup.get(i);
                    if (actualGroupName != null) {
                        names.add(actualGroupName);
                        // Add capitalized version
                        if (!actualGroupName.isEmpty()) {
                            String capitalized = actualGroupName.substring(0, 1).toUpperCase() + 
                                               (actualGroupName.length() > 1 ? actualGroupName.substring(1) : "");
                            names.add(capitalized);
                        }
                    }
                }
            }
            // Add all toggle group names (e.g., pension_group, income_tax_group)
            if (toggleGroups != null) {
                names.addAll(toggleGroups.keySet());
            }
            return names;
        } catch (Exception e) {
            // Fallback: return just the base context names if something goes wrong
            return baseContext != null ? baseContext.getComponentNames() : new HashSet<>();
        }
    }
    
    @Override
    public Map<String, Object> getValues() {
        return baseContext.getValues();
    }
}

