package com.obol.salarysimulator.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Map;

@Data
@ConfigurationProperties(prefix = "contributions")
public class ContributionGroupProperties {
    private Map<String, Double> groupRates;
}
