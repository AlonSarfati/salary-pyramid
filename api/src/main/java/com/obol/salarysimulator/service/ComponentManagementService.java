package com.obol.salarysimulator.service;

import com.obol.salarysimulator.model.SalaryComponent;
import com.obol.salarysimulator.repository.SalaryComponentRepository;
import com.obol.salarysimulator.util.SalaryComponentFileWriter;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ComponentManagementService {

    private final SalaryComponentRepository repository;
    private final SalaryComponentFileWriter fileWriter;

    public ComponentManagementService(SalaryComponentRepository repository, SalaryComponentFileWriter fileWriter) {
        this.repository = repository;
        this.fileWriter = fileWriter;
    }

    public void mergeAndSave(List<SalaryComponent> newComponents) {
        List<SalaryComponent> existing = repository.getAll();
        Map<String, SalaryComponent> mergedMap = new HashMap<>();

        for (SalaryComponent c : existing) {
            mergedMap.put(c.getName(), c);
        }

        for (SalaryComponent c : newComponents) {
            mergedMap.put(c.getName(), c);
        }

        List<SalaryComponent> mergedList = new ArrayList<>(mergedMap.values());

        repository.clear();
        repository.saveAll(mergedList);

        try {
            fileWriter.saveToFile(mergedList);
        } catch (Exception e) {
            throw new RuntimeException("Failed to save components to file", e);
        }
    }
}
