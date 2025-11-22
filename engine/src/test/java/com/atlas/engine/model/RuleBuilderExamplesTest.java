package com.atlas.engine.model;

import com.atlas.engine.expr.Functions;
import com.atlas.engine.expr.TableLookupService;
import com.atlas.engine.spi.TableService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test demonstrating how to use the new RuleBuilder and expression system.
 */
public class RuleBuilderExamplesTest {

    private TableService mockTableService;

    @BeforeEach
    void setUp() {
        // Setup mock table service for TBL function
        mockTableService = new TableService() {
            @Override
            public BigDecimal lookup(String tenantId, String componentTarget, String tableName,
                                     List<Object> keys, LocalDate onDate) {
                if ("bonus_table".equals(tableName) && keys.size() == 1) {
                    int years = ((Number) keys.get(0)).intValue();
                    if (years >= 10) return new BigDecimal("5000");
                    if (years >= 5) return new BigDecimal("3000");
                    return new BigDecimal("1000");
                }
                throw new IllegalArgumentException("Table not found: " + tableName);
            }
        };

        // Register TBL function
        TableLookupService tableLookupService = new com.atlas.engine.expr.TableLookupServiceAdapter(
                mockTableService, "default", "TestComponent", LocalDate.now());
        Functions.registerTbl(tableLookupService);
    }

    @Test
    void testBasicRuleBuilder() {
        Rule rule = RuleBuilder.create()
                .target("PerformanceBonus")
                .expression("IF BaseSalary > 50000 THEN BaseSalary * 0.15 ELSE BaseSalary * 0.10")
                .dependsOn("BaseSalary")
                .group("bonus")
                .taxable(true)
                .build();

        assertEquals("PerformanceBonus", rule.getTarget());
        assertTrue(rule.getExpression().contains("IF"));
        assertTrue(rule.getDependsOn().contains("BaseSalary"));
        assertEquals("bonus", rule.getMeta().get("group"));
        assertEquals("true", rule.getMeta().get("taxable"));
    }

    @Test
    void testAutoDependencyExtraction() {
        Set<String> availableComponents = Set.of("BaseSalary", "Bonus", "Commission");

        Rule rule = RuleBuilder.create()
                .target("TotalCompensation")
                .expression("BaseSalary + Bonus + Commission")
                .availableComponents(availableComponents)
                .build();

        assertTrue(rule.getDependsOn().contains("BaseSalary"));
        assertTrue(rule.getDependsOn().contains("Bonus"));
        assertTrue(rule.getDependsOn().contains("Commission"));
    }

    @Test
    void testRuleWithMinMax() {
        Rule rule = RuleBuilder.create()
                .target("CappedBonus")
                .expression("MIN(MAX(BaseSalary * 0.20, 5000), 10000)")
                .dependsOn("BaseSalary")
                .build();

        assertNotNull(rule);
        assertTrue(rule.getExpression().contains("MIN"));
        assertTrue(rule.getExpression().contains("MAX"));
    }

    @Test
    void testRuleWithTableLookup() {
        Rule rule = RuleBuilder.create()
                .target("ServiceBonus")
                .expression("TBL(\"bonus_table\", YearsOfService)")
                .dependsOn("YearsOfService")
                .build();

        assertNotNull(rule);
        assertTrue(rule.getExpression().contains("TBL"));
    }

    @Test
    void testRuleSetBuilder() {
        RuleSet ruleSet = RuleSetBuilder.create()
                .id("test-ruleset")
                .rule(RuleBuilder.create()
                        .target("BaseSalary")
                        .expression("BaseSalary")
                        .dependsOn("BaseSalary")
                        .build())
                .rule(RuleBuilder.create()
                        .target("PerformanceBonus")
                        .expression("IF BaseSalary > 50000 THEN BaseSalary * 0.15 ELSE BaseSalary * 0.10")
                        .dependsOn("BaseSalary")
                        .build())
                .build();

        assertEquals("test-ruleset", ruleSet.getId());
        assertEquals(2, ruleSet.getRules().size());
    }

    @Test
    void testExpressionValidation() {
        Set<String> components = Set.of("BaseSalary", "Bonus");

        RuleExpression expr1 = new RuleExpression("IF BaseSalary > 50000 THEN 1000 ELSE 500");
        RuleExpression.ValidationResult result1 = expr1.validate(components);
        assertTrue(result1.isValid());

        RuleExpression expr2 = new RuleExpression("UnknownComponent + 100");
        RuleExpression.ValidationResult result2 = expr2.validate(components);
        // This should fail validation since UnknownComponent is not in available components
        assertFalse(result2.isValid());
    }

    @Test
    void testExpressionExamples() {
        // Test that all example expressions are accessible
        Map<String, List<String>> examples = ExpressionExamples.getAllExamples();

        assertTrue(examples.containsKey("Arithmetic"));
        assertTrue(examples.containsKey("Conditional"));
        assertTrue(examples.containsKey("Min/Max"));
        assertTrue(examples.containsKey("Table Lookup"));
        assertTrue(examples.containsKey("Salary Calculations"));

        // Verify some specific examples
        assertNotNull(ExpressionExamples.Arithmetic.ADD);
        assertNotNull(ExpressionExamples.Conditional.IF_THEN_ELSE);
        assertNotNull(ExpressionExamples.SalaryCalculations.PERFORMANCE_BONUS);
    }

    @Test
    void testCompleteRuleSetExample() {
        RuleSet exampleSet = RuleSetBuilder.buildExample();
        assertNotNull(exampleSet);
        assertFalse(exampleSet.getRules().isEmpty());

        // Verify all rules have valid structure
        for (Rule rule : exampleSet.getRules()) {
            assertNotNull(rule.getTarget());
            assertNotNull(rule.getExpression());
            assertNotNull(rule.getDependsOn());
        }
    }

    @Test
    void testRuleWithEffectiveDates() {
        LocalDate from = LocalDate.of(2024, 1, 1);
        LocalDate to = LocalDate.of(2024, 12, 31);

        Rule rule = RuleBuilder.create()
                .target("TemporaryBonus")
                .expression("BaseSalary * 0.05")
                .dependsOn("BaseSalary")
                .effectiveBetween(from, to)
                .build();

        assertTrue(rule.isActiveOn(LocalDate.of(2024, 6, 15)));
        assertFalse(rule.isActiveOn(LocalDate.of(2025, 1, 1)));
    }

    @Test
    void testComplexExpression() {
        Rule rule = RuleBuilder.create()
                .target("ComplexCalculation")
                .expression("IF (BaseSalary > 50000 AND PerformanceRating > 80) OR IsManager = 1 THEN MIN(MAX(BaseSalary * 0.20, 5000), 10000) ELSE BaseSalary * 0.10")
                .dependsOn("BaseSalary", "PerformanceRating", "IsManager")
                .build();

        assertNotNull(rule);
        assertTrue(rule.getExpression().contains("IF"));
        assertTrue(rule.getExpression().contains("AND"));
        assertTrue(rule.getExpression().contains("OR"));
        assertTrue(rule.getExpression().contains("MIN"));
        assertTrue(rule.getExpression().contains("MAX"));
    }
}

