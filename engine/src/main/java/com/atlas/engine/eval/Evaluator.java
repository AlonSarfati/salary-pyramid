package com.atlas.engine.eval;

import com.atlas.engine.model.*;

public interface Evaluator {
    EvaluationResult evaluateAll(RuleSet rules, EvalContext ctx);
}
