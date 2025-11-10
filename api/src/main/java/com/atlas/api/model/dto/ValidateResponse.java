package com.atlas.api.model.dto;

import java.util.List;

public record ValidateResponse(
        boolean ok,
        List<Issue> issues,          // errors + warnings
        List<List<String>> cycles,   // list of cycles (each as path of targets)
        List<String> unreferencedInputs
) {
    public record Issue(String target, String severity, String message) {}
}
