package com.atlas.api.model.dto;

import java.time.LocalDate;

public record SimEmployeeRequest(String tenantId,
                                 String rulesetId,      // optional: if null, use active
                                 LocalDate payDay,
                                 EmployeeInput employee) {}
