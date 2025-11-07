package com.obol.salarysimulator.service;

import com.obol.salarysimulator.config.ContributionGroupProperties;
import com.obol.salarysimulator.model.SalaryComponent;
import com.obol.salarysimulator.model.StructuredSalaryResult;
import com.obol.salarysimulator.repository.SalaryComponentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class StructuredSalaryService {
    @Autowired
    private ContributionGroupProperties contributionProps;
    private static final double TAX_RATE = 0.07;


    public StructuredSalaryResult simulateWithOverrides(
            double baseSalary,
            Map<String, Double> adjustedPercentages,
            SalaryComponentRepository repo
    ) {
        Map<String, SalaryComponent> allComponents = repo.getAll().stream()
                .collect(Collectors.toMap(SalaryComponent::getName, c -> c));

        Map<String, Double> originalBreakdown = calculateComponentBreakdown(allComponents, baseSalary, Map.of());
        Map<String, Double> simulatedBreakdown = calculateComponentBreakdown(allComponents, baseSalary, adjustedPercentages);

        double originalTotalTax = calculateTotalTax(allComponents, originalBreakdown);
        double simulatedTotalTax = calculateTotalTax(allComponents, simulatedBreakdown);

        double originalTaxable = calculateTaxableSalary(allComponents, originalBreakdown);
        double simulatedTaxable = calculateTaxableSalary(allComponents, simulatedBreakdown);

        double originalTotal = calculateTotal(originalBreakdown);
        double simulatedTotal = calculateTotal(simulatedBreakdown);

        Map<String, Double> delta = calculateDelta(originalBreakdown, simulatedBreakdown);
        Map<String, Double> contributionGroups = calculateContributionGroups(allComponents, simulatedBreakdown);

        return new StructuredSalaryResult(
                originalTotal,
                simulatedTotal,
                originalBreakdown,
                simulatedBreakdown,
                delta,
                contributionGroups,
                originalTaxable,
                simulatedTaxable,
                originalTotalTax,
                simulatedTotalTax
        );
    }

    private double calculateTotalTax(
            Map<String, SalaryComponent> components,
            Map<String, Double> breakdown
    ) {
        double taxableSum = breakdown.entrySet().stream()
                .filter(entry -> {
                    SalaryComponent comp = components.get(entry.getKey());
                    return comp != null && Boolean.TRUE.equals(comp.getTaxable());
                })
                .mapToDouble(Map.Entry::getValue)
                .sum();

        return Math.round(taxableSum * TAX_RATE * 100.0) / 100.0;
    }

    private Map<String, Double> calculateComponentBreakdown(
            Map<String, SalaryComponent> all,
            double baseSalary,
            Map<String, Double> overrides
    ) {
        Map<String, Double> breakdown = new HashMap<>();
        breakdown.put("Base", baseSalary);

        for (String name : all.keySet()) {
            calculateComponentWithOverrides(name, breakdown, all, overrides);
        }

        return breakdown;
    }
    private double calculateTotal(Map<String, Double> breakdown) {
        return breakdown.values().stream()
                .mapToDouble(Double::doubleValue)
                .sum();
    }
    private Map<String, Double> calculateDelta(
            Map<String, Double> original,
            Map<String, Double> simulated
    ) {
        Map<String, Double> delta = new HashMap<>();

        for (String key : simulated.keySet()) {
            double sim = simulated.getOrDefault(key, 0.0);
            double orig = original.getOrDefault(key, 0.0);
            double diff = Math.round((sim - orig) * 100.0) / 100.0;
            delta.put(key, diff);
        }

        return delta;
    }
    private Map<String, Double> calculateContributionGroups(
            Map<String, SalaryComponent> components,
            Map<String, Double> breakdown
    ) {
        Map<String, Double> rawTotals = new HashMap<>();
        Map<String, Double> finalContributions = new HashMap<>();

        for (Map.Entry<String, Double> entry : breakdown.entrySet()) {
            String name = entry.getKey();
            double value = entry.getValue();

            SalaryComponent component = components.get(name);
            if (component != null && component.getContributionGroup() != null) {
                String group = component.getContributionGroup();
                rawTotals.put(group, rawTotals.getOrDefault(group, 0.0) + value);
            }
        }

        for (Map.Entry<String, Double> entry : rawTotals.entrySet()) {
            String group = entry.getKey();
            double groupTotal = entry.getValue();
            double rate = contributionProps.getGroupRates().getOrDefault(group, 0.0);
            finalContributions.put(group, Math.round(groupTotal * rate * 100.0) / 100.0);
        }

        return finalContributions;
    }


    private double calculateComponentWithOverrides(
            String name,
            Map<String, Double> calculated,
            Map<String, SalaryComponent> all,
            Map<String, Double> overridePercentages
    ) {
        if (calculated.containsKey(name)) return calculated.get(name);

        SalaryComponent comp = all.get(name);

        // 🟡 Fixed amount: skip dependency calculation
        if (comp.getFixedAmount() != null) {
            calculated.put(name, comp.getFixedAmount());
            return comp.getFixedAmount();
        }

        // Sum dependencies
        double base = 0;
        for (String dep : comp.getDependsOn()) {
            base += calculateComponentWithOverrides(dep, calculated, all, overridePercentages);
        }

        double percentage = overridePercentages.getOrDefault(name, comp.getPercentage());
        double result = base * (percentage / 100.0);
        calculated.put(name, result);
        return result;
    }
    private double calculateTaxableSalary(
            Map<String, SalaryComponent> components,
            Map<String, Double> breakdown
    ) {
        return breakdown.entrySet().stream()
                .filter(entry -> {
                    SalaryComponent comp = components.get(entry.getKey());
                    return comp != null && Boolean.TRUE.equals(comp.getTaxable());
                })
                .mapToDouble(Map.Entry::getValue)
                .sum();
    }

}
