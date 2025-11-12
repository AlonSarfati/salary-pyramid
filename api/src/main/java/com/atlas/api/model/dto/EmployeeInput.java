package com.atlas.api.model.dto;

import java.math.BigDecimal;
import java.util.Map;

public record EmployeeInput(String id,
                            BigDecimal base,
                            BigDecimal hours,
                            BigDecimal rate,
                            Map<String, Object> extra // any additional inputs
) {}
