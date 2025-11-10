package com.atlas.api.model.dto;

import java.util.List;

public record RuleSetRequest(String name, String tenantId, List<RuleDto> rules) {}
