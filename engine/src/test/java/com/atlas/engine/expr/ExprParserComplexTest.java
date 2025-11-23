package com.atlas.engine.expr;

import java.util.Set;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class ExprParserComplexTest {

    @Test
    void testTblWithArithmetic() {
        // Test that TBL function can be used in arithmetic expressions
        ExprParser parser1 = new ExprParser("TBL(\"TzhLevels\", Role)", Set.of());
        assertDoesNotThrow(() -> parser1.parse());
        
        ExprParser parser2 = new ExprParser("(TBL(\"TzhLevels\", Role) / 100) * RoleStipend", Set.of());
        assertDoesNotThrow(() -> {
            ExprNode node = parser2.parse();
            assertNotNull(node);
        });
    }
    
    @Test
    void testParenthesizedTblExpression() {
        ExprParser parser = new ExprParser("(TBL(\"test\", Key) / 100) * Multiplier", Set.of());
        ExprNode node = parser.parse();
        assertNotNull(node);
    }
    
    @Test
    void testExactUserExpression() {
        // Test the exact expression the user is trying to use
        String expr = "(TBL(\"TzhLevels\", Role) / 100) * RoleStipend";
        ExprParser parser = new ExprParser(expr, Set.of());
        assertDoesNotThrow(() -> {
            ExprNode node = parser.parse();
            assertNotNull(node);
        }, "Expression should parse: " + expr);
    }
}

