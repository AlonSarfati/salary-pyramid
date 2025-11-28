package com.atlas.api.service;

import com.atlas.engine.model.Rule;
import com.atlas.engine.model.RuleSet;
import com.atlas.engine.model.RuleExpression;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Service to extract required input parameters from a ruleset.
 * Required inputs are variables referenced in expressions that are not calculated by any rule.
 */
@Service
public class RequiredInputsService {
    private final NamedParameterJdbcTemplate jdbc;
    private final com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();

    public RequiredInputsService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Extract all required input parameters for a ruleset.
     * @param ruleset The ruleset to analyze
     * @param onDate The date to use for active rules
     * @return Set of required input parameter names (in CamelCase)
     */
    public Set<String> getRequiredInputs(RuleSet ruleset, LocalDate onDate) {
        // Get all active rules
        Map<String, Rule> activeRules = ruleset.activeRuleIndex(onDate);
        Set<String> calculatedComponents = new HashSet<>(activeRules.keySet());
        
        // Build normalized lookup maps for efficient matching
        // This handles variations like "Role Seniority" vs "RoleSeniority", case differences, etc.
        Map<String, String> calculatedComponentsLowerMap = new HashMap<>();
        Map<String, String> calculatedComponentsNormalizedMap = new HashMap<>();
        
        for (String comp : calculatedComponents) {
            calculatedComponentsLowerMap.put(comp.toLowerCase(), comp);
            calculatedComponentsNormalizedMap.put(normalizeComponentName(comp), comp);
        }
        
        // Collect all referenced variables from all expressions
        Set<String> allReferenced = new HashSet<>();
        
        for (Rule rule : activeRules.values()) {
            RuleExpression ruleExpr = new RuleExpression(rule.getExpression());
            // Extract ALL component references (including those not in calculatedComponents)
            Set<String> refs = ruleExpr.extractAllComponentReferences();
            allReferenced.addAll(refs);
        }
        
        // Required inputs = referenced variables that are NOT calculated by any rule
        Set<String> requiredInputs = new HashSet<>();
        for (String ref : allReferenced) {
            // Check if this component is calculated by any rule
            // Try exact match first
            if (calculatedComponents.contains(ref)) {
                continue; // Skip - it's calculated
            }
            
            // Try case-insensitive match
            String refLower = ref.toLowerCase();
            if (calculatedComponentsLowerMap.containsKey(refLower)) {
                continue; // Skip - it's calculated (case variation)
            }
            
            // Try normalized match (handles spaces, case differences)
            // This handles variations like "Role Seniority" vs "RoleSeniority"
            String refNormalized = normalizeComponentName(ref);
            if (calculatedComponentsNormalizedMap.containsKey(refNormalized)) {
                continue; // Skip - it's calculated (normalized match)
            }
            
            // Double-check: if any calculated component normalizes to the same as this ref
            // This catches edge cases where normalization might have missed something
            boolean isCalculated = false;
            for (String calculated : calculatedComponents) {
                String calculatedNormalized = normalizeComponentName(calculated);
                if (refNormalized.equals(calculatedNormalized)) {
                    // Found a match via normalization - skip this ref
                    isCalculated = true;
                    break;
                }
            }
            
            if (!isCalculated) {
                // Not calculated - it's a required input
                requiredInputs.add(ref);
            }
        }
        
        return requiredInputs;
    }
    
    /**
     * Normalize component name for comparison (remove spaces, convert to lowercase).
     * This helps match "Role Seniority" with "RoleSeniority", etc.
     */
    private String normalizeComponentName(String name) {
        if (name == null) return "";
        return name.replaceAll("\\s+", "").toLowerCase();
    }
    
    /**
     * Get required inputs with metadata (type hints, descriptions, etc.)
     * @param ruleset The ruleset to analyze
     * @param onDate The date to use for active rules
     * @param tenantId The tenant ID for table lookups
     * @return Map of input name to metadata
     */
    public Map<String, InputMetadata> getRequiredInputsWithMetadata(RuleSet ruleset, LocalDate onDate, String tenantId) {
        Set<String> inputs = getRequiredInputs(ruleset, onDate);
        // Always require WorkPercent as a numeric input (0-100)
        inputs.add("WorkPercent");
        Map<String, Rule> activeRules = ruleset.activeRuleIndex(onDate);
        Map<String, InputMetadata> result = new LinkedHashMap<>();
        
        for (String input : inputs) {
            // Infer type and default value by analyzing how the component is used in expressions
            InputMetadata metadata = inferMetadata(input, activeRules, tenantId, onDate);
            result.put(input, metadata);
        }
        
        return result;
    }
    
    /**
     * Infer metadata for an input parameter by analyzing its usage in expressions.
     * This is dynamic - it looks at how the component is actually used in rules and queries tables if needed.
     */
    private InputMetadata inferMetadata(String inputName, Map<String, Rule> activeRules, String tenantId, LocalDate onDate) {
        String label = formatLabel(inputName);
        String type = "number";
        Object defaultValue = 0;
        List<String> options = null;
        Set<String> stringValues = new HashSet<>();
        boolean usedInArithmetic = false;
        boolean usedInStringComparison = false;
        boolean usedInBooleanContext = false;
        boolean usedInTbl = false;
        String tblTableName = null;
        int tblParamIndex = -1;
        String tblComponentTarget = null;
        
        // Special handling for WorkPercent (always numeric 0-100)
        if ("WorkPercent".equals(inputName)) {
            return new InputMetadata(
                    "WorkPercent",
                    "Work %",
                    "number",
                    100,
                    null,
                    0
            );
        }

        // Collect ALL TBL usages to get values from all tables
        List<TblUsageInfo> tblUsages = new ArrayList<>();
        
        // FIRST: Check if used in TBL - this takes priority
        for (Rule rule : activeRules.values()) {
            String expression = rule.getExpression();
            if (expression == null) continue;
            
            if (!expression.contains(inputName)) {
                continue;
            }
            
            // Quick check: if expression contains TBL and the component name, likely used in TBL
            String lowerExpr = expression.toLowerCase();
            if (lowerExpr.contains("tbl") && expression.contains(inputName)) {
                // Check if used in TBL function: TBL("tableName", ComponentName, ...)
                // Use a more flexible pattern that handles nested parentheses
                Pattern tblPattern = Pattern.compile(
                    "TBL\\s*\\(\\s*\"([^\"]+)\"\\s*,\\s*([^)]+)\\)",
                    Pattern.CASE_INSENSITIVE
                );
                java.util.regex.Matcher tblMatcher = tblPattern.matcher(expression);
                while (tblMatcher.find()) {
                    String tableName = tblMatcher.group(1);
                    String params = tblMatcher.group(2);
                    // Check if params string contains the component name (simple check first)
                    // Use word boundary to avoid partial matches
                    Pattern paramPattern = Pattern.compile("\\b" + Pattern.quote(inputName) + "\\b");
                    if (paramPattern.matcher(params).find()) {
                        usedInTbl = true;
                        // Try to parse parameters to get exact index
                        int paramIndex = -1;
                        try {
                            List<String> paramList = parseTblParameters(params);
                            for (int i = 0; i < paramList.size(); i++) {
                                String param = paramList.get(i).trim();
                                // Remove quotes if present
                                if (param.startsWith("\"") && param.endsWith("\"")) {
                                    param = param.substring(1, param.length() - 1);
                                }
                                if (param.equals(inputName)) {
                                    paramIndex = i;
                                    break;
                                }
                            }
                            // If parsing failed but we know it's in TBL, use index 0 as fallback
                            if (paramIndex < 0 && !paramList.isEmpty()) {
                                paramIndex = 0;
                            }
                        } catch (Exception e) {
                            // If parameter parsing fails, assume it's the first parameter
                            paramIndex = 0;
                        }
                        
                        // Store this TBL usage
                        tblUsages.add(new TblUsageInfo(rule.getTarget(), tableName, paramIndex));
                        
                        // Keep first one for backward compatibility
                        if (tblTableName == null) {
                            tblTableName = tableName;
                            tblComponentTarget = rule.getTarget();
                            tblParamIndex = paramIndex;
                        }
                    }
                }
            }
        }
        
        // If used in TBL, check table FIRST before other pattern detection
        boolean isNumericFromTbl = false;
        if (usedInTbl && tblTableName != null && tblComponentTarget != null && tblParamIndex >= 0) {
            try {
                TableColumnInfo columnInfo = getTableColumnInfo(tenantId, tblComponentTarget, tblTableName, tblParamIndex);
                if (columnInfo != null) {
                    if ("number".equalsIgnoreCase(columnInfo.type()) || columnInfo.isRange()) {
                        // Column is numeric or uses ranges - treat as number input
                        isNumericFromTbl = true;
                        usedInArithmetic = true;
                        usedInStringComparison = false;
                        stringValues.clear();
                    } else {
                        // Column is string - get distinct values for select from ALL tables that use this input
                        Set<String> allTableValues = new HashSet<>();
                        Set<String> columnNamesToSearch = new HashSet<>();
                        
                        // First, collect column names from TBL usages
                        for (TblUsageInfo usage : tblUsages) {
                            try {
                                TableColumnInfo usageColumnInfo = getTableColumnInfo(tenantId, usage.componentTarget, usage.tableName, usage.paramIndex);
                                if (usageColumnInfo != null) {
                                    // Only get values if it's a string column (not number, not range)
                                    if (!"number".equalsIgnoreCase(usageColumnInfo.type()) && !usageColumnInfo.isRange()) {
                                        columnNamesToSearch.add(usageColumnInfo.name());
                                        Set<String> tableValues = getDistinctTableValues(tenantId, usage.componentTarget, usage.tableName, usage.paramIndex, onDate);
                                        if (tableValues != null && !tableValues.isEmpty()) {
                                            allTableValues.addAll(tableValues);
                                        }
                                    }
                                } else {
                                    // Table or column not found - this might be okay if table doesn't exist yet
                                    // But log it for debugging
                                    System.err.println("Warning: Could not find column info for table " + usage.tableName + 
                                        " component " + usage.componentTarget + " paramIndex " + usage.paramIndex);
                                }
                            } catch (Exception e) {
                                // Log error but continue with other tables
                                System.err.println("Error getting values from table " + usage.tableName + 
                                    " for component " + usage.componentTarget + " paramIndex " + usage.paramIndex + ": " + e.getMessage());
                                e.printStackTrace();
                            }
                        }
                        
                        // Also search for ALL tables that have a column matching the input name (case-insensitive)
                        // This finds tables even if they're not explicitly used in TBL calls, or if column name differs
                        if (inputName != null) {
                            Set<String> allValuesFromAllTables = getAllValuesFromAllTablesWithColumn(tenantId, inputName, onDate);
                            allTableValues.addAll(allValuesFromAllTables);
                        }
                        
                        if (!allTableValues.isEmpty()) {
                            usedInStringComparison = true;
                            stringValues.addAll(allTableValues);
                        }
                    }
                } else {
                    // Table info not found - use heuristics
                    String lower = inputName.toLowerCase();
                    if (lower.contains("year") || lower.contains("age") || lower.contains("month") || 
                        lower.contains("day") || lower.contains("count") || lower.contains("amount") ||
                        lower.contains("value") || lower.contains("number") || lower.contains("quantity")) {
                        isNumericFromTbl = true;
                        usedInArithmetic = true;
                        usedInStringComparison = false;
                        stringValues.clear();
                    }
                }
            } catch (Exception e) {
                // If table lookup fails, use heuristics
                String lower = inputName.toLowerCase();
                if (lower.contains("year") || lower.contains("age") || lower.contains("month") || 
                    lower.contains("day") || lower.contains("count") || lower.contains("amount") ||
                    lower.contains("value") || lower.contains("number") || lower.contains("quantity")) {
                    isNumericFromTbl = true;
                    usedInArithmetic = true;
                    usedInStringComparison = false;
                    stringValues.clear();
                }
            }
        }
        
        // Only analyze other patterns if NOT determined as numeric from TBL
        if (!isNumericFromTbl) {
            for (Rule rule : activeRules.values()) {
                String expression = rule.getExpression();
                if (expression == null) continue;
                
                if (!expression.contains(inputName)) {
                    continue;
                }
                
                // Skip if this expression contains TBL with this component (already handled)
                if (expression.contains("TBL") && expression.contains(inputName)) {
                    // Check if it's in a TBL call
                    Pattern tblCheckPattern = Pattern.compile(
                        "TBL\\s*\\([^)]*\\)"
                    );
                    java.util.regex.Matcher tblCheckMatcher = tblCheckPattern.matcher(expression);
                    boolean inTbl = false;
                    while (tblCheckMatcher.find()) {
                        String tblCall = tblCheckMatcher.group(0);
                        if (tblCall.contains(inputName)) {
                            inTbl = true;
                            break;
                        }
                    }
                    if (inTbl) continue; // Skip this expression, already handled by TBL detection
                }
                
                // Analyze usage patterns using regex
                // Look for string comparisons: ComponentName = "value" or ComponentName != "value"
                Pattern stringComparisonPattern1 = Pattern.compile(
                    "\\b" + Pattern.quote(inputName) + "\\s*[=!]=\\s*\"([^\"]*)\""
                );
                Pattern stringComparisonPattern2 = Pattern.compile(
                    "\"([^\"]*)\"\\s*[=!]=\\s*\\b" + Pattern.quote(inputName) + "\\b"
                );
                
                java.util.regex.Matcher stringMatcher1 = stringComparisonPattern1.matcher(expression);
                while (stringMatcher1.find()) {
                    usedInStringComparison = true;
                    String value = stringMatcher1.group(1);
                    stringValues.add(value);
                }
                
                java.util.regex.Matcher stringMatcher2 = stringComparisonPattern2.matcher(expression);
                while (stringMatcher2.find()) {
                    usedInStringComparison = true;
                    String value = stringMatcher2.group(1);
                    stringValues.add(value);
                }
                
                // Also check for IF-THEN-ELSE syntax: IF ComponentName = "value" THEN ...
                Pattern ifStringPattern = Pattern.compile(
                    "IF\\s+\\b" + Pattern.quote(inputName) + "\\s*[=!]=\\s*\"([^\"]*)\""
                );
                java.util.regex.Matcher ifMatcher = ifStringPattern.matcher(expression);
                while (ifMatcher.find()) {
                    usedInStringComparison = true;
                    String value = ifMatcher.group(1);
                    stringValues.add(value);
                }
                
                // Look for arithmetic operations: ComponentName +, -, *, /
                Pattern arithmeticPattern = Pattern.compile(
                    "\\b" + Pattern.quote(inputName) + "\\s*[+\\-*/]"
                );
                if (arithmeticPattern.matcher(expression).find()) {
                    usedInArithmetic = true;
                }
                
                // Look for boolean context: ComponentName = 0 or ComponentName = 1
                Pattern booleanPattern = Pattern.compile(
                    "\\b" + Pattern.quote(inputName) + "\\s*[=!]=\\s*[01]\\b"
                );
                if (booleanPattern.matcher(expression).find()) {
                    usedInBooleanContext = true;
                }
            }
        }
        
        // Determine type based on usage
        // If TBL detected it as numeric, prioritize that
        // Also check if component name suggests numeric and it's used in TBL
        String lowerInputName = inputName.toLowerCase();
        boolean isLikelyNumeric = lowerInputName.contains("year") || lowerInputName.contains("age") || 
                                  lowerInputName.contains("month") || lowerInputName.contains("day") ||
                                  lowerInputName.contains("count") || lowerInputName.contains("amount") ||
                                  lowerInputName.contains("value") || lowerInputName.contains("number") ||
                                  lowerInputName.contains("quantity");
        
        Integer minValue = null;
        
        if (isNumericFromTbl || (usedInTbl && isLikelyNumeric)) {
            type = "number";
            defaultValue = 0;
            // For years, ages, counts, amounts, etc., don't allow negative values
            // Also for any numeric input used in TBL (typically represents counts, years, etc.)
            minValue = 0;
        } else if (usedInStringComparison && !stringValues.isEmpty()) {
            // Used in string comparisons with specific values - it's a select/enum
            type = "select";
            defaultValue = "";
            options = new ArrayList<>(stringValues);
            // Sort options for consistency, empty string last
            options.sort((a, b) -> {
                if (a.isEmpty()) return 1;
                if (b.isEmpty()) return -1;
                return a.compareTo(b);
            });
        } else if (usedInStringComparison) {
            // Used in string comparisons but no specific values found - it's a string
            type = "string";
            defaultValue = "";
        } else if (usedInBooleanContext && !usedInArithmetic) {
            // Used in boolean context (0/1) but not in arithmetic - it's a boolean
            type = "boolean";
            defaultValue = 0;
        } else {
            // Default to number
            type = "number";
            defaultValue = 0;
            // For numeric inputs, check if name suggests non-negative
            if (isLikelyNumeric) {
                minValue = 0;
            }
        }
        
        return new InputMetadata(inputName, label, type, defaultValue, options, minValue);
    }
    
    /**
     * Parse TBL function parameters, handling quoted strings and nested structures.
     */
    private List<String> parseTblParameters(String params) {
        List<String> result = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;
        int parenDepth = 0;
        
        for (int i = 0; i < params.length(); i++) {
            char c = params.charAt(i);
            if (c == '"' && (i == 0 || params.charAt(i - 1) != '\\')) {
                inQuotes = !inQuotes;
                current.append(c);
            } else if (!inQuotes) {
                if (c == '(') {
                    parenDepth++;
                    current.append(c);
                } else if (c == ')') {
                    parenDepth--;
                    current.append(c);
                } else if (c == ',' && parenDepth == 0) {
                    result.add(current.toString().trim());
                    current = new StringBuilder();
                } else {
                    current.append(c);
                }
            } else {
                current.append(c);
            }
        }
        if (current.length() > 0) {
            result.add(current.toString().trim());
        }
        return result;
    }
    
    /**
     * Get table column information (name, type, whether it uses ranges).
     */
    private TableColumnInfo getTableColumnInfo(String tenantId, String componentTarget, String tableName, int paramIndex) {
        try {
            // Get table column definition
            String columnsJson = jdbc.query("""
                SELECT columns_json
                  FROM comp_table
                 WHERE tenant_id=:t AND component_target=:c AND table_name=:n
                """,
                Map.of("t", tenantId, "c", componentTarget, "n", tableName),
                rs -> rs.next() ? rs.getString(1) : null);
            
            if (columnsJson == null) {
                return null;
            }
            
            // Parse column order and types
            var arr = mapper.readTree(columnsJson);
            List<com.fasterxml.jackson.databind.JsonNode> cols = new ArrayList<>();
            arr.forEach(cols::add);
            
            if (paramIndex >= cols.size()) {
                return null;
            }
            
            var colNode = cols.get(paramIndex);
            String columnName = colNode.get("name").asText();
            String columnType = colNode.has("type") ? colNode.get("type").asText() : "string";
            
            // Check if any table rows use min/max for this column (indicating it's a range)
            boolean isRange = checkIfColumnUsesRanges(tenantId, componentTarget, tableName, columnName);
            
            return new TableColumnInfo(columnName, columnType, isRange);
        } catch (Exception e) {
            return null;
        }
    }
    
    /**
     * Check if a table column uses min/max ranges (numeric ranges) instead of exact string values.
     */
    private boolean checkIfColumnUsesRanges(String tenantId, String componentTarget, String tableName, String columnName) {
        try {
            String escapedColumnName = columnName.replace("'", "''");
            // Check if any row has this column as an object with min/max properties
            // Also check if ALL rows use ranges (more reliable indicator)
            String sql = String.format("""
                SELECT 
                    COUNT(*) FILTER (WHERE keys_json->'%s' IS NOT NULL 
                                      AND jsonb_typeof(keys_json->'%s') = 'object'
                                      AND keys_json->'%s' ? 'min'
                                      AND keys_json->'%s' ? 'max') AS range_count,
                    COUNT(*) FILTER (WHERE keys_json->'%s' IS NOT NULL) AS total_count
                  FROM comp_table_row
                 WHERE tenant_id=:t AND component_target=:c AND table_name=:n
            """, escapedColumnName, escapedColumnName, escapedColumnName, escapedColumnName, escapedColumnName);
            
            var result = jdbc.query(sql,
                Map.of("t", tenantId, "c", componentTarget, "n", tableName),
                rs -> {
                    if (rs.next()) {
                        long rangeCount = rs.getLong("range_count");
                        long totalCount = rs.getLong("total_count");
                        // If any row uses ranges, consider it a range column
                        return rangeCount > 0;
                    }
                    return false;
                });
            
            return Boolean.TRUE.equals(result);
        } catch (Exception e) {
            // On error, return false (assume not a range)
            return false;
        }
    }
    
    /**
     * Get distinct values from a table column for a given parameter index.
     * This is used when a component is used in a TBL function call and the column is a string type.
     */
    private Set<String> getDistinctTableValues(String tenantId, String componentTarget, String tableName, 
                                                int paramIndex, LocalDate onDate) {
        try {
            TableColumnInfo columnInfo = getTableColumnInfo(tenantId, componentTarget, tableName, paramIndex);
            if (columnInfo == null) {
                return Set.of();
            }
            
            String columnName = columnInfo.name();
            
            // Get all distinct values for this column from table rows
            // Use JSON extraction: keys_json->>'columnName' for text extraction
            // Note: We need to escape the column name for SQL injection safety
            String escapedColumnName = columnName.replace("'", "''");
            String sql = String.format("""
                SELECT DISTINCT keys_json->>'%s' AS value
                  FROM comp_table_row
                 WHERE tenant_id=:t AND component_target=:c AND table_name=:n
                   AND effective_from <= :d AND :d <= effective_to
                   AND keys_json->>'%s' IS NOT NULL
                """, escapedColumnName, escapedColumnName);
            
            List<String> distinctValues = jdbc.query(sql,
                Map.of("t", tenantId, "c", componentTarget, "n", tableName, "d", onDate),
                (rs, i) -> rs.getString("value"));
            
            Set<String> result = new HashSet<>();
            for (String val : distinctValues) {
                if (val != null && !val.isEmpty()) {
                    result.add(val);
                }
            }
            // Also add empty string as an option
            result.add("");
            
            return result;
        } catch (Exception e) {
            // Return empty set on any error
            return Set.of();
        }
    }
    
    /**
     * Get all distinct values from ALL tables that have a column matching the given name (case-insensitive).
     * This is used to find values from tables even if they're not explicitly referenced in TBL calls.
     */
    private Set<String> getAllValuesFromAllTablesWithColumn(String tenantId, String columnName, LocalDate onDate) {
        Set<String> allValues = new HashSet<>();
        try {
            // First, find all tables that have a column with this name (case-insensitive)
            // We need to parse the columns_json to find matching column names
            String sql = """
                SELECT component_target, table_name, columns_json
                  FROM comp_table
                 WHERE tenant_id=:t
                """;
            
            List<Map<String, String>> matchingTables = jdbc.query(sql,
                Map.of("t", tenantId),
                (rs, i) -> {
                    try {
                        String columnsJson = rs.getString("columns_json");
                        if (columnsJson == null) return null;
                        
                        var arr = mapper.readTree(columnsJson);
                        // Check if any column name matches (case-insensitive)
                        for (var colNode : arr) {
                            String colName = colNode.get("name").asText();
                            if (colName.equalsIgnoreCase(columnName)) {
                                // Found a matching column - return table info
                                return Map.of(
                                    "component", rs.getString("component_target"),
                                    "table", rs.getString("table_name"),
                                    "column", colName
                                );
                            }
                        }
                        return null;
                    } catch (Exception e) {
                        return null;
                    }
                });
            
            // Now get distinct values from all matching tables
            for (Map<String, String> tableInfo : matchingTables) {
                if (tableInfo == null) continue;
                
                String component = tableInfo.get("component");
                String table = tableInfo.get("table");
                String col = tableInfo.get("column");
                
                try {
                    String escapedColumnName = col.replace("'", "''");
                    String valueSql = String.format("""
                        SELECT DISTINCT keys_json->>'%s' AS value
                          FROM comp_table_row
                         WHERE tenant_id=:t AND component_target=:c AND table_name=:n
                           AND effective_from <= :d AND :d <= effective_to
                           AND keys_json->>'%s' IS NOT NULL
                        """, escapedColumnName, escapedColumnName);
                    
                    List<String> values = jdbc.query(valueSql,
                        Map.of("t", tenantId, "c", component, "n", table, "d", onDate),
                        (rs, i) -> rs.getString("value"));
                    
                    for (String val : values) {
                        if (val != null && !val.isEmpty()) {
                            allValues.add(val);
                        }
                    }
                } catch (Exception e) {
                    // Skip this table if there's an error
                    System.err.println("Error getting values from table " + table + " component " + component + " column " + col + ": " + e.getMessage());
                }
            }
            
            // Also add empty string as an option
            allValues.add("");
            
        } catch (Exception e) {
            System.err.println("Error searching for tables with column " + columnName + ": " + e.getMessage());
        }
        
        return allValues;
    }
    
    /**
     * Format a CamelCase name into a readable label.
     * Example: "BaseSalary" -> "Base Salary"
     */
    private String formatLabel(String camelCase) {
        return camelCase.replaceAll("([a-z])([A-Z])", "$1 $2");
    }
    
    /**
     * Table column information.
     */
    private record TableColumnInfo(
        String name,
        String type, // "number", "string", etc.
        boolean isRange // true if column uses min/max ranges
    ) {}
    
    /**
     * Information about a TBL function usage.
     */
    private record TblUsageInfo(
        String componentTarget,
        String tableName,
        int paramIndex
    ) {}
    
    /**
     * Metadata for an input parameter.
     */
    public record InputMetadata(
        String name,
        String label,
        String type, // "number", "boolean", "string", "select"
        Object defaultValue,
        List<String> options, // For select/enum types
        Integer min // For number types: minimum allowed value (null = no minimum)
    ) {
        public InputMetadata(String name, String label, String type, Object defaultValue) {
            this(name, label, type, defaultValue, null, null);
        }
        
        public InputMetadata(String name, String label, String type, Object defaultValue, List<String> options) {
            this(name, label, type, defaultValue, options, null);
        }
    }
}

