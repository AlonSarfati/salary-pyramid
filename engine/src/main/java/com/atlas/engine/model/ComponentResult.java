package com.atlas.engine.model;

import java.math.BigDecimal;

public record ComponentResult(String name, BigDecimal amount, Trace trace) {}
