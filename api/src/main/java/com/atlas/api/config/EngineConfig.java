package com.atlas.api.config;

import com.atlas.engine.eval.DefaultEvaluator;
import com.atlas.engine.eval.Evaluator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class EngineConfig {
    @Bean
    public Evaluator evaluator() {
        return new DefaultEvaluator(); // from engine module
    }
}
