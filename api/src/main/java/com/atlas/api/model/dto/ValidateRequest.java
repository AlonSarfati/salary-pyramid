package com.atlas.api.model.dto;

import java.util.Map;

public record ValidateRequest(
        Map<String, Number> sampleInputs // optional (used to check unknown vars)
) {}
