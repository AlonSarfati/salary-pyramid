package com.atlas.api.model.dto;

import java.util.List;

public record SimBulkRequest(String tenantId,
                             String rulesetId,
                             PeriodDto period,
                             List<EmployeeInput> employees) {}
