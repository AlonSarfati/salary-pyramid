package com.obol.salarysimulator.model;

import lombok.Data;
import java.util.List;

@Data
public class SalaryComponent {
    private String name;
    private List<String> dependsOn;
    private Double percentage;
    private Double fixedAmount;
    private String contributionGroup;
    private Boolean taxable;
}

