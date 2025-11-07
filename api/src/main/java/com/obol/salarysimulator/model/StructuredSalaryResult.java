package com.obol.salarysimulator.model;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.Map;

@Data
@AllArgsConstructor
public class StructuredSalaryResult {
    private double originalTotalSalary;
    private double simulatedTotalSalary;
    private Map<String, Double> originalBreakdown;
    private Map<String, Double> simulatedBreakdown;
    private Map<String, Double> deltaBreakdown;
    private Map<String, Double> contributionTotals; // e.g., "pension_13_5" → 1100.0
    private double originalTaxableSalary;
    private double simulatedTaxableSalary;
    private double originalTotalTax;
    private double simulatedTotalTax;
}
