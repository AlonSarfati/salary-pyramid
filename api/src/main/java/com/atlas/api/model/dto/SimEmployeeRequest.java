package com.atlas.api.model.dto;

public record SimEmployeeRequest(String tenantId,
                                 String rulesetId,      // optional: if null, use active
                                 PeriodDto period,
                                 EmployeeInput employee) {}
