package com.atlas.api.controller;

import com.atlas.api.service.EmployeeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/employees")
public class EmployeeController {
    private final EmployeeService employeeService;

    public EmployeeController(EmployeeService employeeService) {
        this.employeeService = employeeService;
    }

    /**
     * List all employees for a tenant
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listEmployees(
            @RequestParam String tenantId) {
        List<EmployeeService.EmployeeDto> employees = employeeService.listEmployees(tenantId);
        List<Map<String, Object>> response = employees.stream()
            .map(EmployeeService.EmployeeDto::toMap)
            .toList();
        return ResponseEntity.ok(response);
    }

    /**
     * Get a specific employee
     */
    @GetMapping("/{employeeId}")
    public ResponseEntity<Map<String, Object>> getEmployee(
            @RequestParam String tenantId,
            @PathVariable String employeeId) {
        return employeeService.getEmployee(tenantId, employeeId)
            .map(employee -> ResponseEntity.ok(employee.toMap()))
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Create a new employee
     */
    @PostMapping
    public ResponseEntity<?> createEmployee(@RequestBody Map<String, Object> body) {
        try {
            String tenantId = (String) body.get("tenantId");
            String employeeId = (String) body.get("employeeId");
            String name = (String) body.get("name");
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) body.getOrDefault("data", Map.of());
            
            if (tenantId == null || tenantId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "tenantId is required"));
            }
            if (employeeId == null || employeeId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "employeeId is required"));
            }
            
            EmployeeService.EmployeeDto employee = employeeService.createEmployee(tenantId, employeeId, name, data);
            return ResponseEntity.ok(employee.toMap());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            String errorMessage = e.getMessage();
            if (e.getCause() != null) {
                errorMessage += " (Cause: " + e.getCause().getMessage() + ")";
            }
            e.printStackTrace(); // Log to console for debugging
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to create employee: " + errorMessage));
        }
    }

    /**
     * Update an employee
     */
    @PutMapping("/{employeeId}")
    public ResponseEntity<?> updateEmployee(
            @RequestParam String tenantId,
            @PathVariable String employeeId,
            @RequestBody Map<String, Object> body) {
        try {
            String name = (String) body.get("name");
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) body.get("data");
            
            return employeeService.updateEmployee(tenantId, employeeId, name, data)
                .map(employee -> ResponseEntity.ok(employee.toMap()))
                .orElse(ResponseEntity.notFound().build());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to update employee: " + e.getMessage()));
        }
    }

    /**
     * Delete an employee
     */
    @DeleteMapping("/{employeeId}")
    public ResponseEntity<Map<String, String>> deleteEmployee(
            @RequestParam String tenantId,
            @PathVariable String employeeId) {
        boolean deleted = employeeService.deleteEmployee(tenantId, employeeId);
        
        if (!deleted) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(Map.of("status", "deleted", "employeeId", employeeId));
    }
}

