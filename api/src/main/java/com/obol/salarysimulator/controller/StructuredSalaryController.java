package com.obol.salarysimulator.controller;

import com.obol.salarysimulator.model.SalaryComponent;
import com.obol.salarysimulator.model.SimulationOverrideRequest;
import com.obol.salarysimulator.model.StructuredSalaryResult;
import com.obol.salarysimulator.repository.SalaryComponentRepository;
import com.obol.salarysimulator.service.ComponentManagementService;
import com.obol.salarysimulator.service.StructuredSalaryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pyramid")
public class StructuredSalaryController {

    @Autowired
    private SalaryComponentRepository componentRepository;
    @Autowired
    private StructuredSalaryService salaryService;
    @Autowired
    private ComponentManagementService componentService;

    // 🔹 Save or update structure
    @PostMapping("/components")
    public ResponseEntity<String> saveOrUpdateComponents(@RequestBody List<SalaryComponent> components) {
        try {
            componentService.mergeAndSave(components);
            return ResponseEntity.ok("Components merged and saved successfully.");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Failed to merge/save components: " + e.getMessage());
        }
    }

    // 🔹 View saved structure
    @GetMapping("/components")
    public List<SalaryComponent> getComponents() {
        return componentRepository.getAll();
    }

    // 🔹 Simulate with only base + overrides
    @PostMapping("/simulate")
    public StructuredSalaryResult simulate(@RequestBody SimulationOverrideRequest request) {
        return salaryService.simulateWithOverrides(
                request.getBaseSalary(),
                request.getAdjustedPercentages(),
                componentRepository
        );
    }
}
