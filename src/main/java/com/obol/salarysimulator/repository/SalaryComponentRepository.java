package com.obol.salarysimulator.repository;

import com.obol.salarysimulator.model.SalaryComponent;
import org.springframework.stereotype.Repository;

import java.util.*;

@Repository
public class SalaryComponentRepository {

    private final Map<String, SalaryComponent> storedComponents = new HashMap<>();

    public void save(SalaryComponent component) {
        storedComponents.put(component.getName(), component);
    }

    public void saveAll(List<SalaryComponent> components) {
        for (SalaryComponent c : components) {
            save(c);
        }
    }

    public List<SalaryComponent> getAll() {
        return new ArrayList<>(storedComponents.values());
    }

    public Optional<SalaryComponent> findByName(String name) {
        return Optional.ofNullable(storedComponents.get(name));
    }

    public void clear() {
        storedComponents.clear();
    }
}
