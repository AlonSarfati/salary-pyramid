package com.atlas.engine.expr;

import com.atlas.engine.model.EvalContext;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Set;

/**
 * Evaluation context that supports group references.
 * When a group name (lowercase) is referenced, it returns the sum of all components in that group.
 */
public class GroupAwareEvalContext implements com.atlas.engine.expr.EvalContext {
    private final DefaultEvalContext baseContext;
    private final Map<String, String> componentToGroup; // component name -> group name
    private final Set<String> groupNames; // all valid group names
    
    public GroupAwareEvalContext(EvalContext modelContext, Map<String, String> componentToGroup, Set<String> groupNames) {
        this.baseContext = new DefaultEvalContext(modelContext);
        this.componentToGroup = componentToGroup;
        this.groupNames = groupNames;
    }
    
    @Override
    public Value getComponent(String componentName) {
        // Check if this is a group name (lowercase and in groupNames)
        String normalizedName = componentName.toLowerCase();
        if (groupNames.contains(normalizedName)) {
            // Sum all components in this group
            BigDecimal sum = BigDecimal.ZERO;
            for (Map.Entry<String, String> entry : componentToGroup.entrySet()) {
                if (normalizedName.equals(entry.getValue().toLowerCase())) {
                    Value componentValue = baseContext.getComponent(entry.getKey());
                    if (componentValue.getType() == ValueType.NUMBER) {
                        sum = sum.add(componentValue.asNumber());
                    }
                }
            }
            return Value.ofNumber(sum);
        }
        
        // Otherwise, treat as regular component
        return baseContext.getComponent(componentName);
    }
    
    @Override
    public Set<String> getComponentNames() {
        // Include both component names and group names
        Set<String> names = baseContext.getComponentNames();
        // Add group names to the set
        names.addAll(groupNames);
        return names;
    }
    
    @Override
    public Map<String, Object> getValues() {
        return baseContext.getValues();
    }
}

