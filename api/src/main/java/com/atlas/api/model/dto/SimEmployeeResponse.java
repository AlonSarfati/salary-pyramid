package com.atlas.api.model.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record SimEmployeeResponse(Map<String, BigDecimal> components,
                                  BigDecimal total,
                                  Map<String, ComponentTrace> traces) {
    public record ComponentTrace(String component, List<String> steps, String finalLine) {}
}
