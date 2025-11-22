package com.atlas.engine.model;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Comprehensive examples of rule expressions using the new expression system.
 * These examples demonstrate all supported features and can be used as
 * templates in the rule builder UI.
 */
public class ExpressionExamples {

    /**
     * Basic arithmetic operations
     */
    public static class Arithmetic {
        // Simple addition
        public static final String ADD = "BaseSalary + Bonus";
        
        // Subtraction
        public static final String SUBTRACT = "BaseSalary - Deduction";
        
        // Multiplication
        public static final String MULTIPLY = "BaseSalary * 0.15";
        
        // Division
        public static final String DIVIDE = "TotalCompensation / 12";
        
        // Complex calculation
        public static final String COMPLEX = "(BaseSalary + Bonus) * 1.05 - Deduction";
        
        // Percentage calculation
        public static final String PERCENTAGE = "BaseSalary * 0.08";
    }

    /**
     * Conditional expressions using IF function
     */
    public static class Conditional {
        // Simple IF function
        public static final String IF_FUNCTION = "IF(BaseSalary > 50000, BaseSalary * 0.10, BaseSalary * 0.05)";
        
        // IF-THEN-ELSE syntax (converted to IF function)
        public static final String IF_THEN_ELSE = "IF BaseSalary > 50000 THEN BaseSalary * 0.10 ELSE BaseSalary * 0.05";
        
        // Nested conditionals
        public static final String NESTED = "IF YearsOfService >= 5 THEN IF BaseSalary > 100000 THEN 5000 ELSE 3000 ELSE 1000";
        
        // Multiple conditions with AND/OR
        public static final String MULTIPLE_CONDITIONS = "IF BaseSalary > 50000 AND PerformanceRating > 80 THEN BaseSalary * 0.15 ELSE BaseSalary * 0.10";
        
        // Tiered bonus structure
        public static final String TIERED_BONUS = "IF BaseSalary >= 100000 THEN 10000 ELSE IF BaseSalary >= 75000 THEN 7500 ELSE IF BaseSalary >= 50000 THEN 5000 ELSE 2500";
    }

    /**
     * Min/Max functions
     */
    public static class MinMax {
        // Minimum value
        public static final String MIN = "MIN(BaseSalary, Cap)";
        
        // Maximum value
        public static final String MAX = "MAX(BaseSalary, Minimum)";
        
        // Clamp between min and max
        public static final String CLAMP = "MIN(MAX(BaseSalary, Minimum), Maximum)";
        
        // Multiple values
        public static final String MULTIPLE = "MAX(BaseSalary, Bonus, Commission)";
        
        // With conditional
        public static final String WITH_CONDITIONAL = "IF BaseSalary > 0 THEN MIN(BaseSalary * 0.20, 10000) ELSE 0";
    }

    /**
     * Rounding functions
     */
    public static class Rounding {
        // Round to nearest integer
        public static final String ROUND_INTEGER = "ROUND(Amount)";
        
        // Round to 2 decimal places
        public static final String ROUND_DECIMALS = "ROUND(Amount, 2)";
        
        // Round percentage calculation
        public static final String ROUND_PERCENTAGE = "ROUND(BaseSalary * 0.0825, 2)";
        
        // Round after complex calculation
        public static final String ROUND_COMPLEX = "ROUND((BaseSalary + Bonus) * 0.15, 2)";
    }

    /**
     * Table lookups using TBL function
     */
    public static class TableLookup {
        // Simple table lookup
        public static final String SIMPLE = "TBL(\"bonus_table\", YearsOfService)";
        
        // Table lookup with multiple keys
        public static final String MULTIPLE_KEYS = "TBL(\"salary_bands\", Grade, Level)";
        
        // Table lookup with date
        public static final String WITH_DATE = "TBL(\"tax_rates\", Income, \"2024-01-01\")";
        
        // Table lookup in expression
        public static final String IN_EXPRESSION = "BaseSalary + TBL(\"bonus_table\", PerformanceRating)";
        
        // Conditional table lookup
        public static final String CONDITIONAL = "IF UseTable = 1 THEN TBL(\"custom_table\", Key) ELSE BaseSalary * 0.10";
    }

    /**
     * Logical operators
     */
    public static class Logical {
        // AND operator
        public static final String AND = "IF BaseSalary > 50000 AND PerformanceRating > 80 THEN BaseSalary * 0.15 ELSE 0";
        
        // OR operator
        public static final String OR = "IF BaseSalary > 100000 OR YearsOfService >= 10 THEN 5000 ELSE 0";
        
        // NOT operator
        public static final String NOT = "IF NOT IsExempt THEN BaseSalary * 0.10 ELSE 0";
        
        // Complex logical expression
        public static final String COMPLEX = "IF (BaseSalary > 50000 AND PerformanceRating > 80) OR IsManager = 1 THEN BaseSalary * 0.20 ELSE BaseSalary * 0.10";
    }

    /**
     * Comparison operators
     */
    public static class Comparison {
        // Greater than
        public static final String GREATER_THAN = "IF BaseSalary > 50000 THEN BaseSalary * 0.10 ELSE BaseSalary * 0.05";
        
        // Less than
        public static final String LESS_THAN = "IF BaseSalary < 30000 THEN BaseSalary * 0.15 ELSE BaseSalary * 0.10";
        
        // Greater than or equal
        public static final String GREATER_EQUAL = "IF YearsOfService >= 5 THEN 5000 ELSE 0";
        
        // Less than or equal
        public static final String LESS_EQUAL = "IF Age <= 30 THEN BaseSalary * 0.05 ELSE BaseSalary * 0.08";
        
        // Equals
        public static final String EQUALS = "IF Department = \"Engineering\" THEN BaseSalary * 0.12 ELSE BaseSalary * 0.10";
        
        // Not equals
        public static final String NOT_EQUALS = "IF Status != \"Inactive\" THEN BaseSalary * 0.10 ELSE 0";
    }

    /**
     * Real-world salary calculation examples
     */
    public static class SalaryCalculations {
        // Performance bonus with cap
        public static final String PERFORMANCE_BONUS = "MIN(MAX(BaseSalary * PerformanceRating / 100, 0), BaseSalary * 0.25)";
        
        // Pension contribution with minimum
        public static final String PENSION = "MAX(BaseSalary * 0.08, 2000)";
        
        // Health insurance (fixed or percentage)
        public static final String HEALTH_INSURANCE = "IF HasFamily = 1 THEN 1500 ELSE 800";
        
        // Overtime calculation
        public static final String OVERTIME = "IF Hours > 40 THEN (Hours - 40) * Rate * 1.5 ELSE 0";
        
        // Commission with tiers
        public static final String COMMISSION = "IF Sales >= 100000 THEN Sales * 0.10 ELSE IF Sales >= 50000 THEN Sales * 0.07 ELSE Sales * 0.05";
        
        // Stock options based on level
        public static final String STOCK_OPTIONS = "TBL(\"stock_options\", Level, YearsOfService)";
        
        // Tax calculation with brackets
        public static final String TAX = "IF Income > 100000 THEN Income * 0.30 ELSE IF Income > 50000 THEN Income * 0.25 ELSE Income * 0.20";
        
        // Total compensation
        public static final String TOTAL = "BaseSalary + Bonus + Commission + StockOptions";
    }

    /**
     * Complete rule examples using RuleBuilder
     */
    public static List<Rule> getExampleRules() {
        return List.of(
            // Base Salary Rule
            RuleBuilder.create()
                .target("BaseSalary")
                .expression("BaseSalary")
                .dependsOn("BaseSalary")
                .group("core")
                .taxable(true)
                .build(),

            // Performance Bonus Rule
            RuleBuilder.create()
                .target("PerformanceBonus")
                .expression("IF BaseSalary > 50000 THEN MIN(BaseSalary * PerformanceRating / 100, BaseSalary * 0.25) ELSE BaseSalary * 0.10")
                .dependsOn("BaseSalary", "PerformanceRating")
                .group("bonus")
                .taxable(true)
                .cap("BaseSalary * 0.25")
                .build(),

            // Pension Contribution Rule
            RuleBuilder.create()
                .target("PensionContribution")
                .expression("MAX(BaseSalary * 0.08, 2000)")
                .dependsOn("BaseSalary")
                .group("pension")
                .taxable(false)
                .build(),

            // Health Insurance Rule
            RuleBuilder.create()
                .target("HealthInsurance")
                .expression("IF HasFamily = 1 THEN 1500 ELSE 800")
                .dependsOn("HasFamily")
                .group("benefits")
                .taxable(false)
                .build(),

            // Commission Rule with Table Lookup
            RuleBuilder.create()
                .target("Commission")
                .expression("TBL(\"commission_table\", Sales, Region)")
                .dependsOn("Sales", "Region")
                .group("bonus")
                .taxable(true)
                .build(),

            // Overtime Pay Rule
            RuleBuilder.create()
                .target("OvertimePay")
                .expression("IF Hours > 40 THEN (Hours - 40) * Rate * 1.5 ELSE 0")
                .dependsOn("Hours", "Rate")
                .group("core")
                .taxable(true)
                .build()
        );
    }

    /**
     * Get all example expressions organized by category
     */
    public static Map<String, List<String>> getAllExamples() {
        return Map.of(
            "Arithmetic", List.of(
                Arithmetic.ADD,
                Arithmetic.SUBTRACT,
                Arithmetic.MULTIPLY,
                Arithmetic.DIVIDE,
                Arithmetic.COMPLEX,
                Arithmetic.PERCENTAGE
            ),
            "Conditional", List.of(
                Conditional.IF_FUNCTION,
                Conditional.IF_THEN_ELSE,
                Conditional.NESTED,
                Conditional.MULTIPLE_CONDITIONS,
                Conditional.TIERED_BONUS
            ),
            "Min/Max", List.of(
                MinMax.MIN,
                MinMax.MAX,
                MinMax.CLAMP,
                MinMax.MULTIPLE,
                MinMax.WITH_CONDITIONAL
            ),
            "Rounding", List.of(
                Rounding.ROUND_INTEGER,
                Rounding.ROUND_DECIMALS,
                Rounding.ROUND_PERCENTAGE,
                Rounding.ROUND_COMPLEX
            ),
            "Table Lookup", List.of(
                TableLookup.SIMPLE,
                TableLookup.MULTIPLE_KEYS,
                TableLookup.WITH_DATE,
                TableLookup.IN_EXPRESSION,
                TableLookup.CONDITIONAL
            ),
            "Logical", List.of(
                Logical.AND,
                Logical.OR,
                Logical.NOT,
                Logical.COMPLEX
            ),
            "Comparison", List.of(
                Comparison.GREATER_THAN,
                Comparison.LESS_THAN,
                Comparison.GREATER_EQUAL,
                Comparison.LESS_EQUAL,
                Comparison.EQUALS,
                Comparison.NOT_EQUALS
            ),
            "Salary Calculations", List.of(
                SalaryCalculations.PERFORMANCE_BONUS,
                SalaryCalculations.PENSION,
                SalaryCalculations.HEALTH_INSURANCE,
                SalaryCalculations.OVERTIME,
                SalaryCalculations.COMMISSION,
                SalaryCalculations.STOCK_OPTIONS,
                SalaryCalculations.TAX,
                SalaryCalculations.TOTAL
            )
        );
    }
}

