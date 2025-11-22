package com.atlas.api.controller;

import com.atlas.api.model.dto.*;
import com.atlas.api.service.RequiredInputsService;
import com.atlas.api.service.SimulationService;
import com.atlas.api.service.RulesService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/simulate")
public class SimulationController {

    private final SimulationService sim;
    private final RequiredInputsService requiredInputsService;
    private final RulesService rulesService;

    public SimulationController(SimulationService sim, 
                               RequiredInputsService requiredInputsService,
                               RulesService rulesService) {
        this.sim = sim;
        this.requiredInputsService = requiredInputsService;
        this.rulesService = rulesService;
    }

    @PostMapping("/employee")
    public ResponseEntity<SimEmployeeResponse> employee(@RequestBody SimEmployeeRequest req) {
        return ResponseEntity.ok(sim.simulateEmployee(req));
    }

    @PostMapping("/bulk")
    public ResponseEntity<SimBulkResponse> bulk(@RequestBody SimBulkRequest req) {
        return ResponseEntity.ok(sim.simulateBulk(req));
    }

    /**
     * Get required input parameters for a ruleset.
     * @param tenantId The tenant ID
     * @param rulesetId The ruleset ID (optional, uses active if not provided)
     * @param payDay The pay day (optional, uses today if not provided)
     * @return Map of input name to metadata
     */
    @GetMapping("/required-inputs")
    public ResponseEntity<Map<String, RequiredInputsService.InputMetadata>> getRequiredInputs(
            @RequestParam String tenantId,
            @RequestParam(required = false) String rulesetId,
            @RequestParam(required = false) String payDay) {
        
        LocalDate date = payDay != null ? LocalDate.parse(payDay) : LocalDate.now();
        
        var ruleset = rulesetId != null 
            ? rulesService.getById(tenantId, rulesetId)
            : rulesService.getActive(tenantId, date);
        
        Map<String, RequiredInputsService.InputMetadata> inputs = 
            requiredInputsService.getRequiredInputsWithMetadata(ruleset, date, tenantId);
        
        return ResponseEntity.ok(inputs);
    }
}
