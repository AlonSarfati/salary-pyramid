package com.atlas.api.service;

import com.atlas.api.model.dto.*;
import com.atlas.api.model.mapper.Mappers;
import com.atlas.api.repo.RulesetJdbcRepo;
import com.atlas.engine.eval.Evaluator;
import com.atlas.engine.model.EvalContext;
import com.atlas.engine.model.EvaluationResult;
import com.atlas.engine.model.ComponentResult;
import com.atlas.engine.model.RuleSet;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class BaselineService {
    private final Evaluator evaluator;
    private final RulesService rules;
    private final EmployeeService employeeService;
    private final ScenarioService scenarioService;
    private final NamedParameterJdbcTemplate jdbc;
    private final RulesetJdbcRepo rulesetRepo;
    private final ComponentGroupsService componentGroupsService;

    public BaselineService(Evaluator evaluator, RulesService rules, 
                           EmployeeService employeeService, ScenarioService scenarioService,
                           NamedParameterJdbcTemplate jdbc, RulesetJdbcRepo rulesetRepo,
                           ComponentGroupsService componentGroupsService) {
        this.evaluator = evaluator;
        this.rules = rules;
        this.employeeService = employeeService;
        this.scenarioService = scenarioService;
        this.jdbc = jdbc;
        this.rulesetRepo = rulesetRepo;
        this.componentGroupsService = componentGroupsService;
    }

    /**
     * Calculate baseline payroll summary for all employees using a specific ruleset
     */
    public BaselineSummaryDto calculateBaselineSummary(String tenantId, LocalDate asOfDate, String rulesetId) {
        RuleSet ruleset = rulesetId != null ? rules.getById(tenantId, rulesetId) : rules.getActive(tenantId, asOfDate);
        List<EmployeeService.EmployeeDto> employees = employeeService.listEmployees(tenantId);
        
        // Get group ordering once for all employees
        Map<String, Integer> groupOrdering = getGroupOrdering();
        
        BigDecimal totalPayroll = BigDecimal.ZERO;
        Map<String, BigDecimal> componentTotals = new LinkedHashMap<>();
        int employeeCount = employees.size();
        
        // Calculate payroll for each employee
        for (EmployeeService.EmployeeDto emp : employees) {
            try {
                // Convert employee data to EmployeeInput
                EmployeeInput empInput = Mappers.toEmployeeInput(emp.employeeId(), emp.data());
                
                // Evaluate using selected ruleset
                EvalContext ctx = addGroupOrdering(Mappers.toEvalContext(asOfDate, empInput), groupOrdering);
                EvaluationResult result = evaluator.evaluateAll(ruleset, ctx);
                
                totalPayroll = totalPayroll.add(result.total());
                
                // Aggregate component totals in deterministic order (alphabetical)
                List<String> componentNames = new ArrayList<>(result.components().keySet());
                Collections.sort(componentNames);
                for (String component : componentNames) {
                    ComponentResult value = result.components().get(component);
                    componentTotals.merge(component, value.amount(), BigDecimal::add);
                }
            } catch (Exception e) {
                // Log error but continue with other employees
                System.err.println("Error calculating payroll for employee " + emp.employeeId() + ": " + e.getMessage());
            }
        }
        
        BigDecimal avgPerEmployee = employeeCount > 0 
            ? totalPayroll.divide(BigDecimal.valueOf(employeeCount), 2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
        
        // Get ruleset name from database
        String rulesetName = rulesetRepo.findById(tenantId, ruleset.getId())
            .map(row -> row.name() != null ? row.name() : ruleset.getId())
            .orElse(ruleset.getId());
        
        return new BaselineSummaryDto(
            totalPayroll,
            avgPerEmployee,
            employeeCount,
            rulesetName,
            ruleset.getId(),
            asOfDate,
            new Date()
        );
    }

    /**
     * Get payroll trend data (last 12 months)
     * For now, returns empty list as we don't have historical baseline snapshots yet
     */
    public List<BaselineTrendPointDto> getPayrollTrend(String tenantId) {
        // TODO: Implement when baseline snapshot system is added
        // For now, return empty list
        return new ArrayList<>();
    }

    /**
     * Get payroll composition breakdown by component groups
     */
    public BaselineBreakdownDto getPayrollBreakdown(String tenantId, LocalDate asOfDate, String rulesetId) {
        RuleSet ruleset = rulesetId != null ? rules.getById(tenantId, rulesetId) : rules.getActive(tenantId, asOfDate);
        List<EmployeeService.EmployeeDto> employees = employeeService.listEmployees(tenantId);
        
        // Get component groups from database
        List<ComponentGroupsService.GroupDto> groups = componentGroupsService.getAllGroups();
        Map<String, String> groupNameToDisplayName = new LinkedHashMap<>();
        Map<String, Integer> groupDisplayOrder = new LinkedHashMap<>();
        // Use LinkedHashMap to preserve insertion order from database (deterministic)
        Map<String, Integer> groupOrdering = new LinkedHashMap<>(); // For evaluator (lowercase keys)
        for (ComponentGroupsService.GroupDto group : groups) {
            groupNameToDisplayName.put(group.groupName(), group.displayName());
            groupDisplayOrder.put(group.groupName(), group.displayOrder());
            groupOrdering.put(group.groupName().toLowerCase(), group.displayOrder());
        }
        
        // Build component name -> group name mapping from ruleset rules
        // Use LinkedHashMap to preserve rule order (deterministic)
        Map<String, String> componentToGroup = new LinkedHashMap<>();
        for (com.atlas.engine.model.Rule rule : ruleset.getRules()) {
            String componentName = rule.getTarget();
            Map<String, String> meta = rule.getMeta();
            String groupName = meta != null ? meta.get("group") : null;
            if (groupName == null || groupName.isEmpty()) {
                groupName = "core"; // Default to "core" if no group specified
            }
            // Normalize group name to lowercase to match database
            groupName = groupName.toLowerCase();
            componentToGroup.put(componentName, groupName);
        }
        
        // Initialize category totals with all groups from database, ordered by display_order
        Map<String, BigDecimal> categoryTotals = new LinkedHashMap<>();
        groups.stream()
            .sorted(Comparator.comparingInt(ComponentGroupsService.GroupDto::displayOrder))
            .forEach(group -> {
                categoryTotals.put(group.displayName(), BigDecimal.ZERO);
            });
        
        // Calculate for each employee and group components by their actual groups
        for (EmployeeService.EmployeeDto emp : employees) {
            try {
                EmployeeInput empInput = Mappers.toEmployeeInput(emp.employeeId(), emp.data());
                EvalContext ctx = addGroupOrdering(Mappers.toEvalContext(asOfDate, empInput), groupOrdering);
                EvaluationResult result = evaluator.evaluateAll(ruleset, ctx);
                
                // Group components by their actual component groups
                // Process in deterministic order (alphabetical)
                List<String> componentNames = new ArrayList<>(result.components().keySet());
                Collections.sort(componentNames);
                for (String component : componentNames) {
                    ComponentResult value = result.components().get(component);
                    String groupName = componentToGroup.getOrDefault(component, "core");
                    String displayName = groupNameToDisplayName.getOrDefault(groupName, groupName);
                    // If group doesn't exist in database, use the group name as-is
                    if (!categoryTotals.containsKey(displayName)) {
                        categoryTotals.put(displayName, BigDecimal.ZERO);
                    }
                    categoryTotals.merge(displayName, value.amount(), BigDecimal::add);
                }
            } catch (Exception e) {
                System.err.println("Error calculating breakdown for employee " + emp.employeeId() + ": " + e.getMessage());
            }
        }
        
        return new BaselineBreakdownDto(categoryTotals, new Date());
    }

    /**
     * Get count of total simulations
     */
    public long getSimulationCount(String tenantId) {
        String sql = """
            SELECT COUNT(*) 
            FROM scenario 
            WHERE tenant_id = :tenantId
            """;
        Long count = jdbc.queryForObject(sql, Map.of("tenantId", tenantId), Long.class);
        return count != null ? count : 0L;
    }

    /**
     * Calculate growth rate compared to previous baseline
     * Returns null if no previous baseline exists
     */
    public Double calculateGrowthRate(String tenantId, BigDecimal currentBaseline) {
        // TODO: Implement when baseline snapshot system is added
        // For now, return null (N/A)
        return null;
    }

    /**
     * Get full simulation results for all employees using a specific ruleset
     * Returns detailed breakdown per employee and per component
     */
    public FullSimulationResultDto runFullSimulation(String tenantId, String rulesetId, LocalDate asOfDate) {
        RuleSet ruleset = rules.getById(tenantId, rulesetId);
        List<EmployeeService.EmployeeDto> employees = employeeService.listEmployees(tenantId);
        
        List<EmployeeSimulationResult> employeeResults = new ArrayList<>();
        Map<String, BigDecimal> componentTotals = new LinkedHashMap<>();
        BigDecimal grandTotal = BigDecimal.ZERO;
        
        // Get group ordering once for all employees
        Map<String, Integer> groupOrdering = getGroupOrdering();
        
        // Calculate for each employee
        for (EmployeeService.EmployeeDto emp : employees) {
            try {
                EmployeeInput empInput = Mappers.toEmployeeInput(emp.employeeId(), emp.data());
                EvalContext ctx = addGroupOrdering(Mappers.toEvalContext(asOfDate, empInput), groupOrdering);
                EvaluationResult result = evaluator.evaluateAll(ruleset, ctx);
                
                // Build component map in deterministic order (alphabetical)
                Map<String, BigDecimal> components = new LinkedHashMap<>();
                List<String> componentNames = new ArrayList<>(result.components().keySet());
                Collections.sort(componentNames);
                for (String component : componentNames) {
                    ComponentResult value = result.components().get(component);
                    components.put(component, value.amount());
                    componentTotals.merge(component, value.amount(), BigDecimal::add);
                }
                
                employeeResults.add(new EmployeeSimulationResult(
                    emp.employeeId(),
                    emp.name(),
                    result.total(),
                    components
                ));
                
                grandTotal = grandTotal.add(result.total());
            } catch (Exception e) {
                System.err.println("Error calculating payroll for employee " + emp.employeeId() + ": " + e.getMessage());
                // Add employee with zero total on error
                employeeResults.add(new EmployeeSimulationResult(
                    emp.employeeId(),
                    emp.name(),
                    BigDecimal.ZERO,
                    new LinkedHashMap<>()
                ));
            }
        }
        
        // Get ruleset name
        String rulesetName = rulesetRepo.findById(tenantId, rulesetId)
            .map(row -> row.name() != null ? row.name() : rulesetId)
            .orElse(rulesetId);
        
        return new FullSimulationResultDto(
            rulesetId,
            rulesetName,
            asOfDate,
            employeeResults,
            componentTotals,
            grandTotal,
            employees.size(),
            new Date()
        );
    }
    
    private Map<String, Integer> getGroupOrdering() {
        // Use LinkedHashMap to preserve insertion order from database (deterministic)
        Map<String, Integer> ordering = new LinkedHashMap<>();
        for (ComponentGroupsService.GroupDto group : componentGroupsService.getAllGroups()) {
            ordering.put(group.groupName().toLowerCase(), group.displayOrder());
        }
        return ordering;
    }
    
    private EvalContext addGroupOrdering(EvalContext ctx, Map<String, Integer> groupOrdering) {
        // Use LinkedHashMap to preserve input order (deterministic)
        Map<String, Object> inputs = new LinkedHashMap<>(ctx.inputs());
        inputs.put("_groupOrdering", groupOrdering);
        return new EvalContext(inputs, ctx.periodDate());
    }

    // DTOs
    public record BaselineSummaryDto(
        BigDecimal totalPayroll,
        BigDecimal avgPerEmployee,
        int employeeCount,
        String activeRulesetName,
        String activeRulesetId,
        LocalDate asOfDate,
        Date calculatedAt
    ) {}

    public record BaselineTrendPointDto(
        String month, // YYYY-MM format
        BigDecimal totalPayroll
    ) {}

    public record BaselineBreakdownDto(
        Map<String, BigDecimal> categoryTotals,
        Date calculatedAt
    ) {}

    public record EmployeeSimulationResult(
        String employeeId,
        String employeeName,
        BigDecimal total,
        Map<String, BigDecimal> components
    ) {}

    public record FullSimulationResultDto(
        String rulesetId,
        String rulesetName,
        LocalDate asOfDate,
        List<EmployeeSimulationResult> employeeResults,
        Map<String, BigDecimal> componentTotals,
        BigDecimal grandTotal,
        int employeeCount,
        Date calculatedAt
    ) {}
}

