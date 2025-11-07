package com.obol.salarysimulator.model;

import lombok.Data;
import java.util.Map;

@Data
public class SimulationOverrideRequest {
    private double baseSalary;
    private Map<String, Double> adjustedPercentages; // optional overrides
}
