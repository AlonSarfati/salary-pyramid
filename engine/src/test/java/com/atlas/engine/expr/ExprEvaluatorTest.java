package com.atlas.engine.expr;

import com.atlas.engine.model.EvalContext;
import com.atlas.engine.spi.TableService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class ExprEvaluatorTest {

    private ExprEvaluator evaluator;
    private com.atlas.engine.expr.EvalContext context;

    @BeforeEach
    void setUp() {
        evaluator = new ExprEvaluator();
        
        // Create a test context with some components (CamelCase names)
        Map<String, Object> inputs = Map.of(
                "BaseSalary", new BigDecimal("10000"),
                "Bonus", new BigDecimal("500"),
                "Age", 30,
                "Name", "John"
        );
        EvalContext modelContext = new EvalContext(inputs, LocalDate.now());
        context = new DefaultEvalContext(modelContext);
    }

    @Test
    void testBasicArithmetic() {
        assertEquals(new BigDecimal("15"), evaluator.evaluateAsNumber("10 + 5", context));
        assertEquals(new BigDecimal("5"), evaluator.evaluateAsNumber("10 - 5", context));
        assertEquals(new BigDecimal("50"), evaluator.evaluateAsNumber("10 * 5", context));
        assertEquals(new BigDecimal("2"), evaluator.evaluateAsNumber("10 / 5", context));
    }

    @Test
    void testComponentReferences() {
        assertEquals(new BigDecimal("10000"), evaluator.evaluateAsNumber("BaseSalary", context));
        assertEquals(new BigDecimal("500"), evaluator.evaluateAsNumber("Bonus", context));
        assertEquals(new BigDecimal("10500"), evaluator.evaluateAsNumber("BaseSalary + Bonus", context));
    }

    @Test
    void testIfFunction() {
        // Business DSL only uses IF condition THEN expr ELSE expr (no IF() function form)
        assertEquals(new BigDecimal("100"), evaluator.evaluateAsNumber("IF 10 > 5 THEN 100 ELSE 200", context));
        assertEquals(new BigDecimal("200"), evaluator.evaluateAsNumber("IF 10 < 5 THEN 100 ELSE 200", context));
        assertEquals(new BigDecimal("100"), evaluator.evaluateAsNumber("IF 10 = 10 THEN 100 ELSE 200", context));
    }

    @Test
    void testIfThenElseSyntax() {
        // IF condition THEN expr ELSE expr
        assertEquals(new BigDecimal("100"), evaluator.evaluateAsNumber("IF 10 > 5 THEN 100 ELSE 200", context));
        assertEquals(new BigDecimal("200"), evaluator.evaluateAsNumber("IF 10 < 5 THEN 100 ELSE 200", context));
        assertEquals(new BigDecimal("15000"), evaluator.evaluateAsNumber("IF BaseSalary > 5000 THEN BaseSalary * 1.5 ELSE BaseSalary", context));
    }

    @Test
    void testMinFunction() {
        assertEquals(new BigDecimal("5"), evaluator.evaluateAsNumber("MIN(10, 5, 8)", context));
        assertEquals(new BigDecimal("3"), evaluator.evaluateAsNumber("MIN(10, 5, 3, 8)", context));
        assertEquals(new BigDecimal("10000"), evaluator.evaluateAsNumber("MIN(BaseSalary, 20000)", context));
    }

    @Test
    void testMaxFunction() {
        assertEquals(new BigDecimal("10"), evaluator.evaluateAsNumber("MAX(10, 5, 8)", context));
        assertEquals(new BigDecimal("20"), evaluator.evaluateAsNumber("MAX(10, 5, 20, 8)", context));
        assertEquals(new BigDecimal("20000"), evaluator.evaluateAsNumber("MAX(BaseSalary, 20000)", context));
    }

    @Test
    void testRoundFunction() {
        assertEquals(new BigDecimal("10"), evaluator.evaluateAsNumber("ROUND(10.6)", context));
        assertEquals(new BigDecimal("11"), evaluator.evaluateAsNumber("ROUND(10.5)", context));
        assertEquals(new BigDecimal("10.5"), evaluator.evaluateAsNumber("ROUND(10.55, 1)", context));
        assertEquals(new BigDecimal("10.56"), evaluator.evaluateAsNumber("ROUND(10.555, 2)", context));
    }

    @Test
    void testComparisonOperators() {
        assertTrue(evaluator.evaluate("10 > 5", context).asBoolean());
        assertFalse(evaluator.evaluate("10 < 5", context).asBoolean());
        assertTrue(evaluator.evaluate("10 >= 10", context).asBoolean());
        assertTrue(evaluator.evaluate("10 <= 10", context).asBoolean());
        assertTrue(evaluator.evaluate("10 = 10", context).asBoolean());
        assertTrue(evaluator.evaluate("10 != 5", context).asBoolean());
    }

    @Test
    void testLogicalOperators() {
        assertTrue(evaluator.evaluate("TRUE AND TRUE", context).asBoolean());
        assertFalse(evaluator.evaluate("TRUE AND FALSE", context).asBoolean());
        assertTrue(evaluator.evaluate("TRUE OR FALSE", context).asBoolean());
        assertFalse(evaluator.evaluate("FALSE OR FALSE", context).asBoolean());
        assertFalse(evaluator.evaluate("NOT TRUE", context).asBoolean());
        assertTrue(evaluator.evaluate("NOT FALSE", context).asBoolean());
    }

    @Test
    void testComplexExpressions() {
        assertEquals(new BigDecimal("15750"), evaluator.evaluateAsNumber("(BaseSalary + Bonus) * 1.5", context));
        assertEquals(new BigDecimal("500"), evaluator.evaluateAsNumber("IF BaseSalary > 5000 THEN Bonus ELSE 0", context));
        assertEquals(new BigDecimal("0"), evaluator.evaluateAsNumber("IF BaseSalary < 5000 THEN Bonus ELSE 0", context));
    }

    @Test
    void testOperatorPrecedence() {
        assertEquals(new BigDecimal("25"), evaluator.evaluateAsNumber("10 + 5 * 3", context)); // 10 + 15 = 25
        assertEquals(new BigDecimal("45"), evaluator.evaluateAsNumber("(10 + 5) * 3", context)); // 15 * 3 = 45
        assertTrue(evaluator.evaluate("10 > 5 AND 5 < 10", context).asBoolean());
    }

    @Test
    void testTblFunction() {
        // Create a mock TableService
        TableService mockTableService = new TableService() {
            @Override
            public BigDecimal lookup(String tenantId, String componentTarget, String tableName,
                                     List<Object> keys, LocalDate onDate) {
                if ("testTable".equals(tableName) && keys.size() == 1) {
                    Object key = keys.get(0);
                    if (key instanceof Number && ((Number) key).intValue() == 1) {
                        return new BigDecimal("100");
                    }
                }
                throw new IllegalArgumentException("Table lookup failed");
            }
        };

        // Register TBL function
        TableLookupService tableLookupService = new TableLookupServiceAdapter(
                mockTableService, "default", "TestComponent", LocalDate.now());
        Functions.registerTbl(tableLookupService);

        // Test TBL function
        assertEquals(new BigDecimal("100"), evaluator.evaluateAsNumber("TBL(\"testTable\", 1)", context));
    }
    
    @Test
    void testTblWithArithmetic() {
        // Create a mock TableService that returns 1500
        TableService mockTableService = new TableService() {
            @Override
            public BigDecimal lookup(String tenantId, String componentTarget, String tableName,
                                     List<Object> keys, LocalDate onDate) {
                if ("TzhLevels".equals(tableName)) {
                    return new BigDecimal("1500");
                }
                return BigDecimal.ZERO;
            }
        };

        // Register TBL function
        TableLookupService tableLookupService = new TableLookupServiceAdapter(
                mockTableService, "default", "TestComponent", LocalDate.now());
        Functions.registerTbl(tableLookupService);
        
        // Add RoleStipend to context
        Map<String, Object> inputs = new java.util.HashMap<>(context.getValues());
        inputs.put("RoleStipend", new BigDecimal("1000"));
        EvalContext newContext = new EvalContext(inputs, java.time.LocalDate.now());
        com.atlas.engine.expr.EvalContext exprContext = new DefaultEvalContext(newContext);

        // Test the exact expression the user is trying: (TBL("TzhLevels", Role) / 100) * RoleStipend
        // TBL returns 1500, so (1500 / 100) * 1000 = 15 * 1000 = 15000
        BigDecimal result = evaluator.evaluate("(TBL(\"TzhLevels\", 1) / 100) * RoleStipend", exprContext).asNumber();
        assertEquals(new BigDecimal("15000"), result);
    }

    @Test
    void testUnknownComponent() {
        // Unknown components now evaluate to 0 instead of throwing an exception.
        // This is more resilient: if a component doesn't exist (e.g., was deleted but still referenced),
        // it will evaluate to 0 instead of breaking the entire calculation.
        BigDecimal result = evaluator.evaluateAsNumber("UnknownComponent", context);
        assertEquals(BigDecimal.ZERO, result);
    }

    @Test
    void testUnknownFunction() {
        assertThrows(IllegalArgumentException.class, () -> {
            evaluator.evaluateAsNumber("UNKNOWN(1, 2)", context);
        });
    }

    @Test
    void testStringLiterals() {
        Value result = evaluator.evaluate("\"Hello\"", context);
        assertEquals("Hello", result.asString());
    }

    @Test
    void testBooleanLiterals() {
        assertTrue(evaluator.evaluate("TRUE", context).asBoolean());
        assertFalse(evaluator.evaluate("FALSE", context).asBoolean());
    }

    @Test
    void testNestedFunctions() {
        assertEquals(new BigDecimal("5"), evaluator.evaluateAsNumber("MIN(MAX(1, 5), MAX(3, 10))", context));
        assertEquals(new BigDecimal("100"), evaluator.evaluateAsNumber("IF MIN(10, 5) < 10 THEN 100 ELSE 200", context));
    }
}

