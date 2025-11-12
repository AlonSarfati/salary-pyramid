package com.atlas.api.model.dto;

import java.time.LocalDate;
import java.util.List;

public record SimBulkRequest(String tenantId,
                             String rulesetId,
                             LocalDate payDay,
                             List<EmployeeInput> employees) {}
