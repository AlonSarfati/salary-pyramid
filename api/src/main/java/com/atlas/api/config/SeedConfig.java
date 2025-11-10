package com.atlas.api.config;

import com.atlas.api.model.dto.RuleDto;
import com.atlas.api.model.dto.RuleSetRequest;
import com.atlas.api.service.RulesService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PostConstruct;
import java.util.List;

@Configuration
@Slf4j
public class SeedConfig {
    private final RulesService rules;

    public SeedConfig(RulesService rules) { this.rules = rules; }

    @PostConstruct
    public void seed() {
        try {
            // if already active, skip
            rules.getActive("default", java.time.LocalDate.now());
        } catch (Exception e) {
            var req = new RuleSetRequest(
                    "default-2025",
                    "default",
                    List.of(
                            new RuleDto("Expert Bonus",        "${Base} * 0.06", List.of("Base"), null, null, null),
                            new RuleDto("Responsibility Bonus","(${Base}+${Expert Bonus})*0.04", List.of("Base","Expert Bonus"), null, null, null),
                            new RuleDto("Full Bonus",          "(${Base}+${Expert Bonus}+${Responsibility Bonus})*0.05", List.of("Base","Expert Bonus","Responsibility Bonus"), null, null, null),
                            new RuleDto("Fixed Travel",        "200", List.of(), null, null, null)
                    )
            );
            String id = rules.saveDraft(req);
            rules.publish("default", id); // make active
            log.info("added the base rules");
        }
    }
}
