package com.atlas.engine;

import com.atlas.engine.eval.DefaultEvaluator;
import com.atlas.engine.eval.Evaluator;
import com.atlas.engine.model.*;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class EngineSmokeTest {

    @Test
    void simpleChain() {
        Rule expert = new Rule("Expert Bonus", "${Base} * 0.06", List.of("Base"), null, null, Map.of());
        Rule resp   = new Rule("Responsibility Bonus", "(${Base}+${Expert Bonus}) * 0.04",
                List.of("Base","Expert Bonus"), null, null, Map.of());
        Rule full   = new Rule("Full Bonus", "(${Base}+${Expert Bonus}+${Responsibility Bonus})*0.05",
                List.of("Base","Expert Bonus","Responsibility Bonus"), null, null, Map.of());
        Rule travel = new Rule("Fixed Travel", "200", List.of(), null, null, Map.of());

        RuleSet rs = new RuleSet("default", List.of(expert, resp, full, travel));

        Evaluator evaluator = new DefaultEvaluator();
        EvalContext ctx = new EvalContext(Map.of("Base", new BigDecimal("10000")), LocalDate.now());

        EvaluationResult result = evaluator.evaluateAll(rs, ctx);

        assertAmountEquals("600.0", result.components().get("Expert Bonus").amount());
        assertAmountEquals("424.0", result.components().get("Responsibility Bonus").amount());
        assertAmountEquals("551.2", result.components().get("Full Bonus").amount());
        assertAmountEquals("200",   result.components().get("Fixed Travel").amount());
        assertAmountEquals("1775.2", result.total());
    }
    private static void assertAmountEquals(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual),
                "Expected " + expected + " but was " + actual.toPlainString());
    }
}
