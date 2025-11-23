package com.atlas.api.model.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record SimBulkResponse(List<Map<String, Object>> results, // [{employeeId, total, components}]
                              Map<String, BigDecimal> totalsByComponent,
                              BigDecimal grandTotal) {}
