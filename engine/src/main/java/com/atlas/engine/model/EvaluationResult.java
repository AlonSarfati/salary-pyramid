package com.atlas.engine.model;

import java.math.BigDecimal;
import java.util.Map;

public record EvaluationResult(Map<String, ComponentResult> components, BigDecimal total) {}
