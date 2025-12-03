package com.atlas.api.service;

import com.atlas.api.model.dto.EmployeeInput;
import com.atlas.api.model.mapper.Mappers;
import com.atlas.api.repo.RulesetJdbcRepo;
import com.atlas.api.tables.TableServiceDb;
import com.atlas.engine.eval.DefaultEvaluator;
import com.atlas.engine.eval.Evaluator;
import com.atlas.engine.model.EvalContext;
import com.atlas.engine.model.EvaluationResult;
import com.atlas.engine.model.Rule;
import com.atlas.engine.model.RuleSet;
import com.atlas.engine.spi.TableService;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.Objects;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Service for budget-based raise optimization.
 * 
 * This service helps plan raises under a fixed extra budget by:
 * 1. Calculating baseline costs for a ruleset
 * 2. Applying raise plans (e.g., uniform % raise on a component, add new component, increase table values) in-memory
 * 3. Finding optimal parameters that fit within the budget
 */
@Service
public class OptimizerService {
    private final Evaluator evaluator;
    private final RulesService rules;
    private final EmployeeService employeeService;
    private final ComponentGroupsService componentGroupsService;
    private final RulesetJdbcRepo rulesetRepo;
    private final NamedParameterJdbcTemplate jdbc;
    private final TableServiceDb tableServiceDb;
    private static final Pattern TBL_PATTERN = Pattern.compile("TBL\\(\"([^\"]+)\"");

    public OptimizerService(Evaluator evaluator, RulesService rules,
                           EmployeeService employeeService,
                           ComponentGroupsService componentGroupsService,
                           RulesetJdbcRepo rulesetRepo,
                           NamedParameterJdbcTemplate jdbc,
                           TableServiceDb tableServiceDb) {
        this.evaluator = evaluator;
        this.rules = rules;
        this.employeeService = employeeService;
        this.componentGroupsService = componentGroupsService;
        this.rulesetRepo = rulesetRepo;
        this.jdbc = jdbc;
        this.tableServiceDb = tableServiceDb;
    }

    /**
     * Run optimization to find parameters that fit within the extra budget.
     * 
     * @param tenantId Tenant ID
     * @param rulesetId Ruleset ID
     * @param extraBudget Extra yearly budget (e.g., 1,300,000)
     * @param strategy Optimization strategy: "FLAT_RAISE_ON_BASE", "ADD_NEW_COMPONENT_IN_GROUP", "INCREASE_TABLE_VALUES"
     * @param targetComponent Component to apply raise to (for FLAT_RAISE_ON_BASE)
     * @param targetGroup Group to add component to (for ADD_NEW_COMPONENT_IN_GROUP)
     * @param newComponentName Name for new component (for ADD_NEW_COMPONENT_IN_GROUP)
     * @param targetTable Table to increase values in (for INCREASE_TABLE_VALUES)
     * @param tableComponent Component that owns the table (for INCREASE_TABLE_VALUES)
     * @param asOfDate Date for calculation
     * @return Optimization result with baseline, optimized summaries, and adjustment plan
     */
    public OptimizationResultDto optimize(String tenantId, String rulesetId, 
                                         BigDecimal extraBudget, 
                                         String strategy,
                                         String targetComponent,
                                         String targetGroup,
                                         String newComponentName,
                                         String targetTable,
                                         String tableComponent,
                                         LocalDate asOfDate) {
        if (asOfDate == null) {
            asOfDate = LocalDate.now();
        }

        // Get the ruleset
        RuleSet originalRuleset = rules.getById(tenantId, rulesetId);
        
        // Calculate baseline
        PayrollSummary baseline = calculatePayrollSummary(tenantId, originalRuleset, asOfDate, null);
        
        // Get ruleset name
        String rulesetName = rulesetRepo.findById(tenantId, rulesetId)
            .map(row -> row.name() != null ? row.name() : rulesetId)
            .orElse(rulesetId);

        AdjustmentPlan adjustmentPlan;
        PayrollSummary optimized;
        
        switch (strategy) {
            case "FLAT_RAISE_ON_BASE":
                // Validate that target component exists
                boolean componentExists = originalRuleset.getRules().stream()
                    .anyMatch(r -> r.getTarget().equals(targetComponent));
                if (!componentExists) {
                    throw new IllegalArgumentException("Component '" + targetComponent + "' not found in ruleset");
                }
                
                // Find optimal raise percentage using binary search
                BigDecimal optimalPercentage = findOptimalRaisePercentage(
                    tenantId, originalRuleset, targetComponent, asOfDate,
                    baseline.totalCost, extraBudget
                );

                // Calculate optimized payroll with the optimal percentage
                RuleSet optimizedRuleset = applyRaisePlan(originalRuleset, targetComponent, optimalPercentage);
                optimized = calculatePayrollSummary(tenantId, optimizedRuleset, asOfDate, null);
                
                adjustmentPlan = new AdjustmentPlan(
                    strategy,
                    targetComponent,
                    null,
                    null,
                    null,
                    null,
                    optimalPercentage,
                    null,
                    "Uniform " + optimalPercentage.setScale(2, RoundingMode.HALF_UP) + "% raise on " + targetComponent
                );
                break;
                
            case "ADD_NEW_COMPONENT_IN_GROUP":
                if (targetGroup == null || targetGroup.isBlank()) {
                    throw new IllegalArgumentException("targetGroup is required for ADD_NEW_COMPONENT_IN_GROUP strategy");
                }
                
                // Validate group exists
                Map<String, Integer> groupOrdering = getGroupOrdering();
                String normalizedGroup = targetGroup.toLowerCase();
                if (!groupOrdering.containsKey(normalizedGroup)) {
                    throw new IllegalArgumentException("Group '" + targetGroup + "' not found");
                }
                
                // Generate component name if not provided
                String finalComponentName = (newComponentName != null && !newComponentName.isBlank())
                    ? newComponentName
                    : "NewComponent_" + targetGroup;
                
                // Find optimal scalar value using binary search
                BigDecimal optimalScalar = findOptimalNewComponentValue(
                    tenantId, originalRuleset, normalizedGroup, finalComponentName, asOfDate,
                    baseline.totalCost, extraBudget
                );
                
                // Calculate optimized payroll with the new component
                RuleSet rulesetWithNewComponent = addNewComponent(originalRuleset, normalizedGroup, finalComponentName, optimalScalar);
                optimized = calculatePayrollSummary(tenantId, rulesetWithNewComponent, asOfDate, null);
                
                adjustmentPlan = new AdjustmentPlan(
                    strategy,
                    null,
                    normalizedGroup,
                    finalComponentName,
                    null,
                    null,
                    null,
                    optimalScalar,
                    "Added new component '" + finalComponentName + "' in " + targetGroup + " with value " + 
                    optimalScalar.setScale(2, RoundingMode.HALF_UP) + " ₪ per employee"
                );
                break;
                
            case "INCREASE_TABLE_VALUES":
                if (targetTable == null || targetTable.isBlank()) {
                    throw new IllegalArgumentException("targetTable is required for INCREASE_TABLE_VALUES strategy");
                }
                if (tableComponent == null || tableComponent.isBlank()) {
                    throw new IllegalArgumentException("tableComponent is required for INCREASE_TABLE_VALUES strategy");
                }
                
                // Validate that the table exists for this component
                String tableCheck = jdbc.query("""
                    SELECT table_name
                      FROM comp_table
                     WHERE tenant_id=:t AND component_target=:c AND table_name=:n
                    """,
                    Map.of("t", tenantId, "c", tableComponent, "n", targetTable),
                    rs -> rs.next() ? rs.getString(1) : null);
                
                if (tableCheck == null) {
                    throw new IllegalArgumentException(
                        "Table '" + targetTable + "' not found for component '" + tableComponent + "'. " +
                        "Please verify the component name matches exactly (case-sensitive)."
                    );
                }
                
                // Check if there are any rows that are effective on the target date
                // (regardless of their effective_from date - we'll split them if needed)
                Integer effectiveRowCount = jdbc.query("""
                    SELECT COUNT(*)
                      FROM comp_table_row
                     WHERE tenant_id=:t AND component_target=:c AND table_name=:n
                       AND effective_from <= :d AND :d <= effective_to
                    """,
                    Map.of("t", tenantId, "c", tableComponent, "n", targetTable, "d", asOfDate),
                    rs -> rs.next() ? rs.getInt(1) : 0);
                
                if (effectiveRowCount == 0) {
                    throw new IllegalArgumentException(
                        "No rows found in table '" + targetTable + "' that are effective on " + asOfDate + ". " +
                        "Please ensure there are rows with effective_from <= " + asOfDate + " and effective_to >= " + asOfDate + "."
                    );
                }
                
                // Find optimal increase factor using binary search
                BigDecimal optimalIncreaseFactor = findOptimalTableIncreaseFactor(
                    tenantId, originalRuleset, tableComponent, targetTable, asOfDate,
                    baseline.totalCost, extraBudget
                );
                
                // Calculate optimized payroll with increased table values
                TableService modifiedTableService = createModifiedTableService(
                    tenantId, tableComponent, targetTable, asOfDate, optimalIncreaseFactor
                );
                optimized = calculatePayrollSummary(tenantId, originalRuleset, asOfDate, modifiedTableService);
                
                adjustmentPlan = new AdjustmentPlan(
                    strategy,
                    null,
                    null,
                    null,
                    targetTable,
                    tableComponent,
                    null,
                    optimalIncreaseFactor,
                    "Increased all values in table '" + targetTable + "' (component: " + tableComponent + 
                    ") effective from " + asOfDate + " by " + 
                    optimalIncreaseFactor.multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP) + "%"
                );
                break;
                
            default:
                throw new IllegalArgumentException("Unknown strategy: " + strategy);
        }

        return new OptimizationResultDto(
            rulesetId,
            rulesetName,
            extraBudget,
            strategy,
            adjustmentPlan,
            baseline,
            optimized,
            asOfDate,
            new Date()
        );
    }

    /**
     * Calculate payroll summary for a ruleset (baseline or optimized).
     * Optionally uses a custom TableService for table modifications.
     */
    private PayrollSummary calculatePayrollSummary(String tenantId, RuleSet ruleset, LocalDate asOfDate, TableService customTableService) {
        List<EmployeeService.EmployeeDto> employees = employeeService.listEmployees(tenantId);
        
        // Get group ordering
        Map<String, Integer> groupOrdering = getGroupOrdering();
        
        // Use custom evaluator if custom table service is provided
        Evaluator eval = customTableService != null 
            ? new DefaultEvaluator(customTableService)
            : evaluator;
        
        BigDecimal totalCost = BigDecimal.ZERO;
        Map<String, BigDecimal> componentTotals = new LinkedHashMap<>();
        int employeeCount = employees.size();
        
        // Calculate for each employee
        for (EmployeeService.EmployeeDto emp : employees) {
            try {
                EmployeeInput empInput = Mappers.toEmployeeInput(emp.employeeId(), emp.data());
                EvalContext ctx = addGroupOrdering(Mappers.toEvalContext(asOfDate, empInput), groupOrdering);
                EvaluationResult result = eval.evaluateAll(ruleset, ctx);
                
                totalCost = totalCost.add(result.total());
                
                // Aggregate component totals in deterministic order (alphabetical)
                List<String> componentNames = new ArrayList<>(result.components().keySet());
                Collections.sort(componentNames);
                for (String component : componentNames) {
                    com.atlas.engine.model.ComponentResult value = result.components().get(component);
                    componentTotals.merge(component, value.amount(), BigDecimal::add);
                }
            } catch (Exception e) {
                System.err.println("Error calculating payroll for employee " + emp.employeeId() + ": " + e.getMessage());
            }
        }
        
        BigDecimal avgPerEmployee = employeeCount > 0 
            ? totalCost.divide(BigDecimal.valueOf(employeeCount), 2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
        
        return new PayrollSummary(
            totalCost,
            avgPerEmployee,
            employeeCount,
            componentTotals
        );
    }

    /**
     * Apply a raise plan to a ruleset in-memory (does not modify database).
     * For FLAT_RAISE_ON_BASE strategy, multiplies the target component by (1 + percentage/100).
     */
    private RuleSet applyRaisePlan(RuleSet originalRuleset, String targetComponent, BigDecimal raisePercentage) {
        List<Rule> modifiedRules = originalRuleset.getRules().stream()
            .map(rule -> {
                if (rule.getTarget().equals(targetComponent)) {
                    // Apply raise: multiply expression by (1 + raisePercentage/100)
                    String originalExpr = rule.getExpression();
                    String multiplier = "(1 + " + raisePercentage.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP) + ")";
                    
                    // Check if expression is just the component name (self-reference)
                    String trimmedExpr = originalExpr.trim();
                    if (trimmedExpr.equals(targetComponent)) {
                        // Simple case: "Base" -> "Base * (1 + 0.05)"
                        String newExpr = targetComponent + " * " + multiplier;
                        return new Rule(
                            rule.getTarget(),
                            newExpr,
                            rule.getDependsOn(),
                            rule.getEffectiveFrom(),
                            rule.getEffectiveTo(),
                            rule.getMeta() != null ? new HashMap<>(rule.getMeta()) : new HashMap<>()
                        );
                    } else {
                        // Complex expression: wrap in parentheses and multiply
                        String newExpr = "(" + originalExpr + ") * " + multiplier;
                        return new Rule(
                            rule.getTarget(),
                            newExpr,
                            rule.getDependsOn(),
                            rule.getEffectiveFrom(),
                            rule.getEffectiveTo(),
                            rule.getMeta() != null ? new HashMap<>(rule.getMeta()) : new HashMap<>()
                        );
                    }
                } else {
                    // Rule unchanged
                    return rule;
                }
            })
            .collect(Collectors.toList());
        
        return new RuleSet(originalRuleset.getId(), modifiedRules);
    }

    /**
     * Add a new component to a ruleset in-memory.
     * The component has a simple scalar expression (value per employee).
     */
    private RuleSet addNewComponent(RuleSet originalRuleset, String targetGroup, String componentName, BigDecimal scalarValue) {
        List<Rule> newRules = new ArrayList<>(originalRuleset.getRules());
        
        // Create new component rule with scalar value
        Map<String, String> meta = new HashMap<>();
        meta.put("group", targetGroup);
        
        Rule newRule = new Rule(
            componentName,
            scalarValue.toPlainString(), // Simple scalar: just the value
            Collections.emptyList(), // No explicit dependencies
            null, // Effective from now
            null, // Effective forever
            meta
        );
        
        newRules.add(newRule);
        return new RuleSet(originalRuleset.getId(), newRules);
    }

    /**
     * Find optimal raise percentage using binary search.
     */
    private BigDecimal findOptimalRaisePercentage(String tenantId, RuleSet originalRuleset,
                                                  String targetComponent, LocalDate asOfDate,
                                                  BigDecimal baselineCost, BigDecimal extraBudget) {
        BigDecimal targetCost = baselineCost.add(extraBudget);
        
        BigDecimal minPercent = BigDecimal.ZERO;
        BigDecimal maxPercent = BigDecimal.valueOf(100);
        BigDecimal tolerance = BigDecimal.valueOf(0.01);
        BigDecimal bestPercent = BigDecimal.ZERO;
        BigDecimal bestDiff = extraBudget.abs();
        
        int maxIterations = 50;
        int iterations = 0;
        
        while (iterations < maxIterations && maxPercent.subtract(minPercent).compareTo(tolerance) > 0) {
            BigDecimal midPercent = minPercent.add(maxPercent).divide(BigDecimal.valueOf(2), 4, RoundingMode.HALF_UP);
            
            RuleSet testRuleset = applyRaisePlan(originalRuleset, targetComponent, midPercent);
            PayrollSummary testSummary = calculatePayrollSummary(tenantId, testRuleset, asOfDate, null);
            BigDecimal testCost = testSummary.totalCost();
            BigDecimal diff = testCost.subtract(targetCost).abs();
            
            if (diff.compareTo(bestDiff) < 0) {
                bestDiff = diff;
                bestPercent = midPercent;
            }
            
            if (testCost.compareTo(targetCost) < 0) {
                minPercent = midPercent;
            } else {
                maxPercent = midPercent;
            }
            
            iterations++;
        }
        
        return bestPercent.setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Find optimal scalar value for new component using binary search.
     */
    private BigDecimal findOptimalNewComponentValue(String tenantId, RuleSet originalRuleset,
                                                    String targetGroup, String componentName, LocalDate asOfDate,
                                                    BigDecimal baselineCost, BigDecimal extraBudget) {
        BigDecimal targetCost = baselineCost.add(extraBudget);
        
        // Binary search bounds: 0 to a reasonable max (e.g., extraBudget / employeeCount * 2)
        int employeeCount = employeeService.listEmployees(tenantId).size();
        BigDecimal maxValue = employeeCount > 0 
            ? extraBudget.divide(BigDecimal.valueOf(employeeCount), 2, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(2))
            : BigDecimal.valueOf(100000);
        
        BigDecimal minValue = BigDecimal.ZERO;
        BigDecimal tolerance = BigDecimal.valueOf(0.01);
        BigDecimal bestValue = BigDecimal.ZERO;
        BigDecimal bestDiff = extraBudget.abs();
        
        int maxIterations = 50;
        int iterations = 0;
        
        while (iterations < maxIterations && maxValue.subtract(minValue).compareTo(tolerance) > 0) {
            BigDecimal midValue = minValue.add(maxValue).divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
            
            RuleSet testRuleset = addNewComponent(originalRuleset, targetGroup, componentName, midValue);
            PayrollSummary testSummary = calculatePayrollSummary(tenantId, testRuleset, asOfDate, null);
            BigDecimal testCost = testSummary.totalCost();
            BigDecimal diff = testCost.subtract(targetCost).abs();
            
            if (diff.compareTo(bestDiff) < 0) {
                bestDiff = diff;
                bestValue = midValue;
            }
            
            if (testCost.compareTo(targetCost) < 0) {
                minValue = midValue;
            } else {
                maxValue = midValue;
            }
            
            iterations++;
        }
        
        return bestValue.setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Find optimal table increase factor using binary search.
     */
    private BigDecimal findOptimalTableIncreaseFactor(String tenantId, RuleSet originalRuleset,
                                                     String tableComponent, String tableName, LocalDate asOfDate,
                                                     BigDecimal baselineCost, BigDecimal extraBudget) {
        BigDecimal targetCost = baselineCost.add(extraBudget);
        
        // Binary search bounds: 0% to 500% increase (5x the original value)
        // This allows for very large increases if needed to meet the budget
        BigDecimal minFactor = BigDecimal.ZERO;
        BigDecimal maxFactor = BigDecimal.valueOf(5); // 500% increase (5x multiplier)
        BigDecimal tolerance = BigDecimal.valueOf(0.0001); // 0.01% tolerance
        BigDecimal bestFactor = BigDecimal.ZERO;
        BigDecimal bestDiff = extraBudget.abs();
        
        int maxIterations = 50;
        int iterations = 0;
        
        while (iterations < maxIterations && maxFactor.subtract(minFactor).compareTo(tolerance) > 0) {
            BigDecimal midFactor = minFactor.add(maxFactor).divide(BigDecimal.valueOf(2), 4, RoundingMode.HALF_UP);
            
            TableService testTableService = createModifiedTableService(tenantId, tableComponent, tableName, asOfDate, midFactor);
            PayrollSummary testSummary = calculatePayrollSummary(tenantId, originalRuleset, asOfDate, testTableService);
            BigDecimal testCost = testSummary.totalCost();
            BigDecimal diff = testCost.subtract(targetCost).abs();
            
            if (diff.compareTo(bestDiff) < 0) {
                bestDiff = diff;
                bestFactor = midFactor;
            }
            
            if (testCost.compareTo(targetCost) < 0) {
                minFactor = midFactor;
            } else {
                maxFactor = midFactor;
            }
            
            iterations++;
        }
        
        return bestFactor.setScale(4, RoundingMode.HALF_UP);
    }

    /**
     * Create a TableService wrapper that applies an increase factor to table values.
     * Only affects rows effective from the given date onward.
     */
    private TableService createModifiedTableService(String tenantId, String componentTarget, 
                                                   String tableName, LocalDate effectiveFrom, 
                                                   BigDecimal increaseFactor) {
        // Load table definition to get column order
        String columnsJson = jdbc.query("""
            SELECT columns_json
              FROM comp_table
             WHERE tenant_id=:t AND component_target=:c AND table_name=:n
            """,
            Map.of("t", tenantId, "c", componentTarget, "n", tableName),
            rs -> rs.next() ? rs.getString(1) : null);
        
        if (columnsJson == null) {
            throw new IllegalArgumentException("Table '" + tableName + "' not found for component '" + componentTarget + "'");
        }
        
        // Parse column order
        List<String> columnOrder = parseColumnOrder(columnsJson);
        
        // Load all rows for this table
        List<TableRow> allRows = jdbc.query("""
            SELECT effective_from, effective_to, keys_json, value
              FROM comp_table_row
             WHERE tenant_id=:t AND component_target=:c AND table_name=:n
             ORDER BY effective_from, keys_json
            """,
            Map.of("t", tenantId, "c", componentTarget, "n", tableName),
            (rs, i) -> new TableRow(
                rs.getDate("effective_from").toLocalDate(),
                rs.getDate("effective_to").toLocalDate(),
                rs.getString("keys_json"),
                rs.getBigDecimal("value")
            ));
        
        // Build a modified row list: split rows that start before effectiveFrom
        // For rows with effective_from < effectiveFrom but effective on effectiveFrom:
        // - Keep original row but truncate effective_to to (effectiveFrom - 1 day)
        // - Add new row starting from effectiveFrom with increased value
        List<TableRow> modifiedRows = new ArrayList<>();
        for (TableRow row : allRows) {
            // Check if this row is effective on the target date
            if (effectiveFrom.compareTo(row.effectiveFrom()) >= 0 && 
                effectiveFrom.compareTo(row.effectiveTo()) <= 0) {
                // This row is effective on the target date
                if (row.effectiveFrom().compareTo(effectiveFrom) < 0) {
                    // Row starts before target date - need to split it
                    // 1. Keep original row but end it the day before target date
                    modifiedRows.add(new TableRow(
                        row.effectiveFrom(),
                        effectiveFrom.minusDays(1),
                        row.keysJson(),
                        row.value() // Original value for period before target date
                    ));
                    // 2. Add new row starting from target date with increased value
                    modifiedRows.add(new TableRow(
                        effectiveFrom,
                        row.effectiveTo(),
                        row.keysJson(),
                        row.value().multiply(BigDecimal.ONE.add(increaseFactor)) // Increased value
                    ));
                } else {
                    // Row starts on or after target date - just increase the value
                    modifiedRows.add(new TableRow(
                        row.effectiveFrom(),
                        row.effectiveTo(),
                        row.keysJson(),
                        row.value().multiply(BigDecimal.ONE.add(increaseFactor)) // Increased value
                    ));
                }
            } else {
                // Row is not effective on target date - keep as-is
                modifiedRows.add(row);
            }
        }
        
        // Return a wrapper TableService that uses modified rows
        return new TableService() {
            @Override
            public BigDecimal lookup(String tId, String cTarget, String tName,
                                   List<Object> keys, LocalDate onDate) {
                // Only modify if this is the target table
                if (tName.equals(tableName) && cTarget.equals(componentTarget)) {
                    // Search in modified rows
                    for (TableRow row : modifiedRows) {
                        // Check if date is in range
                        if (onDate.compareTo(row.effectiveFrom()) >= 0 && 
                            onDate.compareTo(row.effectiveTo()) <= 0) {
                            // Check if keys match
                            if (matchesKeys(columnOrder, keys, row.keysJson())) {
                                return row.value();
                            }
                        }
                    }
                    // No match found in modified rows - delegate to base service
                    return tableServiceDb.lookup(tId, cTarget, tName, keys, onDate);
                } else {
                    // Delegate to base service for other tables
                    return tableServiceDb.lookup(tId, cTarget, tName, keys, onDate);
                }
            }
        };
    }
    
    /**
     * Parse column order from JSON.
     */
    private List<String> parseColumnOrder(String columnsJson) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            var arr = mapper.readTree(columnsJson);
            List<String> names = new ArrayList<>();
            arr.forEach(n -> names.add(n.get("name").asText()));
            return names;
        } catch (Exception e) {
            throw new IllegalArgumentException("Bad columns_json", e);
        }
    }
    
    /**
     * Check if keys match a row's keys_json.
     */
    private boolean matchesKeys(List<String> columnOrder, List<Object> lookupKeys, String keysJson) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            var node = mapper.readTree(keysJson);
            
            if (columnOrder.size() != lookupKeys.size()) {
                return false;
            }
            
            for (int i = 0; i < columnOrder.size(); i++) {
                String col = columnOrder.get(i);
                Object val = lookupKeys.get(i);
                var keyNode = node.get(col);
                if (keyNode == null) return false;

                // Check if this is a range object (has min or max property)
                if (keyNode.isObject() && (keyNode.has("min") || keyNode.has("max")) && val instanceof Number num) {
                    double v = num.doubleValue();
                    boolean matches = true;
                    
                    // Check min bound (if present) - inclusive: v >= min
                    if (keyNode.has("min") && !keyNode.get("min").isNull()) {
                        double min = keyNode.get("min").asDouble();
                        if (v < min) {
                            matches = false;
                        }
                    }
                    
                    // Check max bound (if present) - exclusive: v < max
                    if (matches && keyNode.has("max") && !keyNode.get("max").isNull()) {
                        double max = keyNode.get("max").asDouble();
                        if (v >= max) {
                            matches = false;
                        }
                    }
                    
                    if (!matches) return false;
                } else {
                    // Exact match for non-range values
                    String s = String.valueOf(val);
                    if (!Objects.equals(keyNode.asText(), s)) return false;
                }
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Extract table names used in a ruleset.
     */
    private Set<String> extractTableNames(RuleSet ruleset) {
        Set<String> tableNames = new HashSet<>();
        for (Rule rule : ruleset.getRules()) {
            java.util.regex.Matcher matcher = TBL_PATTERN.matcher(rule.getExpression());
            while (matcher.find()) {
                tableNames.add(matcher.group(1));
            }
        }
        return tableNames;
    }

    private Map<String, Integer> getGroupOrdering() {
        Map<String, Integer> ordering = new HashMap<>();
        for (ComponentGroupsService.GroupDto group : componentGroupsService.getAllGroups()) {
            ordering.put(group.groupName().toLowerCase(), group.displayOrder());
        }
        return ordering;
    }
    
    private EvalContext addGroupOrdering(EvalContext ctx, Map<String, Integer> groupOrdering) {
        Map<String, Object> inputs = new HashMap<>(ctx.inputs());
        inputs.put("_groupOrdering", groupOrdering);
        return new EvalContext(inputs, ctx.periodDate());
    }

    // DTOs
    public record PayrollSummary(
        BigDecimal totalCost,
        BigDecimal avgPerEmployee,
        int employeeCount,
        Map<String, BigDecimal> componentTotals
    ) {}

    public record AdjustmentPlan(
        String strategy,
        String targetComponent,        // For FLAT_RAISE_ON_BASE
        String targetGroup,            // For ADD_NEW_COMPONENT_IN_GROUP
        String newComponentName,        // For ADD_NEW_COMPONENT_IN_GROUP
        String targetTable,            // For INCREASE_TABLE_VALUES
        String tableComponent,         // For INCREASE_TABLE_VALUES
        BigDecimal percentage,        // For FLAT_RAISE_ON_BASE
        BigDecimal scalarOrFactor,     // For ADD_NEW_COMPONENT_IN_GROUP (scalar) or INCREASE_TABLE_VALUES (factor)
        String description
    ) {}

    public record OptimizationResultDto(
        String rulesetId,
        String rulesetName,
        BigDecimal extraBudget,
        String strategy,
        AdjustmentPlan adjustmentPlan,
        PayrollSummary baseline,
        PayrollSummary optimized,
        LocalDate asOfDate,
        Date calculatedAt
    ) {}
    
    private record TableRow(LocalDate effectiveFrom, LocalDate effectiveTo, String keysJson, BigDecimal value) {}
}
