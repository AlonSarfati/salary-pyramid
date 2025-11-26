package com.atlas.api.service;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Service to provide the "How to Build Rules" guide content.
 */
@Service
public class RuleGuideService {
    
    private String cachedGuide = null;
    
    /**
     * Get the full rule builder guide text.
     */
    public String getRuleBuilderGuide() {
        if (cachedGuide != null) {
            return cachedGuide;
        }
        
        try {
            ClassPathResource resource = new ClassPathResource("rule-builder-guide.txt");
            cachedGuide = resource.getContentAsString(StandardCharsets.UTF_8);
            return cachedGuide;
        } catch (IOException e) {
            // Fallback to a basic guide if file cannot be read
            return getDefaultGuide();
        }
    }
    
    private String getDefaultGuide() {
        return """
            HOW TO BUILD SALARY RULES
            
            A rule defines how to calculate a salary component. Each rule has:
            - Target: The name of the component being calculated
            - Expression: The formula that calculates the value
            - Dependencies: Other components this rule depends on
            
            EXPRESSION SYNTAX:
            - Components: CamelCase (e.g., BaseSalary, PerformanceBonus)
            - Functions: ALL_CAPS (e.g., IF, MIN, MAX, ROUND, TBL)
            - Operators: +, -, *, /, =, !=, >, >=, <, <=, AND, OR, NOT
            
            FUNCTIONS:
            - IF(condition, trueValue, falseValue)
            - MIN(value1, value2)
            - MAX(value1, value2)
            - ROUND(value, decimals)
            - TBL("table_name", key1, key2)
            """;
    }
}

