package com.atlas.engine.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

public record EvalContext(Map<String, BigDecimal> inputs, LocalDate periodDate) {}
