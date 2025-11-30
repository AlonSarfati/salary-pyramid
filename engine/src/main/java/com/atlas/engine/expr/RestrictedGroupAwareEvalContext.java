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
    
    public RestrictedGroupAwareEvalContext(
            EvalContext modelContext,
            Map<String, String> componentToGroup,
            Map<String, Integer> groupToNumber,
            int maxAllowedGroupNumber) {
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
    }
    
    @Override
    public Value getComponent(String componentName) {
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
                
                // Get the actual group name for this number
                String actualGroupName = numberToGroup.get(groupNumber);
                if (actualGroupName == null) {
                    return Value.ofNumber(BigDecimal.ZERO);
                }
                
                // Sum all components in this group
                return sumGroup(actualGroupName);
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
            return sumGroup(normalizedName);
        }
        
        // Otherwise, treat as regular component
        return baseContext.getComponent(componentName);
    }
    
    private Value sumGroup(String groupName) {
        BigDecimal sum = BigDecimal.ZERO;
        // Normalize the group name for comparison
        String normalizedGroupName = groupName.toLowerCase();
        for (Map.Entry<String, String> entry : componentToGroup.entrySet()) {
            // Compare normalized group names
            if (normalizedGroupName.equals(entry.getValue().toLowerCase())) {
                Value componentValue = baseContext.getComponent(entry.getKey());
                if (componentValue != null && componentValue.getType() == ValueType.NUMBER) {
                    sum = sum.add(componentValue.asNumber());
                }
            }
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

