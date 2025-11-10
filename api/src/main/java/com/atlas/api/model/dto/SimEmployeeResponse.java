package com.atlas.api.model.dto;

import java.math.BigDecimal;
import java.util.Map;

public record SimEmployeeResponse(Map<String, BigDecimal> components,
                                  BigDecimal total) {}
