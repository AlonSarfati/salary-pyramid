package com.obol.salarysimulator.repository;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.obol.salarysimulator.model.SalaryComponent;
import com.obol.salarysimulator.repository.SalaryComponentRepository;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.List;

@Component
@Slf4j
public class SalaryStructureLoader {

    @Autowired
    private SalaryComponentRepository repository;

    @PostConstruct
    public void loadFromFile() {
        try (InputStream is = getClass().getClassLoader().getResourceAsStream("components.json")) {
            if (is != null) {
                ObjectMapper mapper = new ObjectMapper();
                List<SalaryComponent> components = mapper.readValue(is, new TypeReference<>() {});
                repository.clear();
                repository.saveAll(components);
                log.info("✔ Loaded salary structure from components.json");
            } else {
                log.info("⚠ components.json not found in resources.");
            }
        } catch (Exception e) {
            log.info("❌ Failed to load salary structure: " + e.getMessage());
        }
    }
}
