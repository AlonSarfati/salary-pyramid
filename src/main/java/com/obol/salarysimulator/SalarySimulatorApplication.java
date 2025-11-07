package com.obol.salarysimulator;

import com.obol.salarysimulator.config.ContributionGroupProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(ContributionGroupProperties.class) // ✅ required
public class SalarySimulatorApplication {
    public static void main(String[] args) {
        SpringApplication.run(SalarySimulatorApplication.class, args);
    }
}
