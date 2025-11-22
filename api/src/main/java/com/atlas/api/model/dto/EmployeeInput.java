package com.atlas.api.model.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public record EmployeeInput(String id,
                            BigDecimal base,
                            BigDecimal hours,
                            BigDecimal rate,
                            BigDecimal sales,
                            BigDecimal performance,
                            BigDecimal yearsOfService,
                            BigDecimal hasFamily,
                            BigDecimal isManager,
                            String department,
                            String status,
                            Map<String, Object> extra // any additional inputs
) {}
