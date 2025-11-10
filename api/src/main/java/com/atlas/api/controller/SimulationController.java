package com.atlas.api.controller;

import com.atlas.api.model.dto.*;
import com.atlas.api.service.SimulationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/simulate")
public class SimulationController {

    private final SimulationService sim;

    public SimulationController(SimulationService sim) { this.sim = sim; }

    @PostMapping("/employee")
    public ResponseEntity<SimEmployeeResponse> employee(@RequestBody SimEmployeeRequest req) {
        return ResponseEntity.ok(sim.simulateEmployee(req));
    }

    @PostMapping("/bulk")
    public ResponseEntity<SimBulkResponse> bulk(@RequestBody SimBulkRequest req) {
        return ResponseEntity.ok(sim.simulateBulk(req));
    }
}
