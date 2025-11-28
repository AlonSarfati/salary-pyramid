package com.atlas.engine.model;

import com.atlas.engine.expr.ExprEvaluator;
import com.atlas.engine.expr.ExprParser;
import com.atlas.engine.expr.Value;
import com.atlas.engine.expr.DefaultEvalContext;
import com.atlas.engine.expr.ExprNode;
import com.atlas.engine.expr.ComponentRefNode;
import com.atlas.engine.expr.TracingExprEvaluator;

import java.math.BigDecimal;
import java.util.Set;
import java.util.HashSet;
import java.util.regex.Pattern;
import java.util.regex.Matcher;

/**
 * Represents a rule expression using the modern expression system.
 * Components are referenced using CamelCase (e.g., BaseSalary, PerformanceBonus).
 * Functions are ALL_CAPS (e.g., IF, MIN, MAX, ROUND, TBL).
 */
public class RuleExpression {
    private final String expression;
    private final ExprEvaluator evaluator;

    public RuleExpression(String expression) {
        this.expression = expression;
        this.evaluator = new ExprEvaluator();
    }

    public String getExpression() {
        return expression;
    }

    /**
     * Extract component dependencies from the expression.
     * Components are CamelCase identifiers that are not functions.
     */
    public Set<String> extractDependencies(Set<String> availableComponents) {
        try {
            // Parse the expression to build AST
            ExprParser tempParser = new ExprParser(expression, availableComponents);
            ExprNode root = tempParser.parse();
            
            // Extract component references from AST
            Set<String> deps = new HashSet<>();
            extractComponentRefs(root, deps);
            return deps;
        } catch (Exception e) {
            // Fall back to regex extraction if parsing fails
            return extractDependenciesRegex(availableComponents);
        }
    }
    
    /**
     * Extract ALL component references from the expression, including those not in availableComponents.
     * This is useful for finding required inputs.
     * Uses AST parsing to correctly exclude quoted strings (like table names in TBL functions).
     */
    public Set<String> extractAllComponentReferences() {
        try {
            // Parse the expression to build AST (use empty set for componentNames to allow all references)
            ExprParser tempParser = new ExprParser(expression, Set.of());
            ExprNode root = tempParser.parse();
            
            // Extract component references from AST (this automatically excludes quoted strings)
            Set<String> allRefs = new HashSet<>();
            extractComponentRefs(root, allRefs);
            return allRefs;
        } catch (Exception e) {
            // Fall back to regex extraction if parsing fails, but exclude quoted strings
            Set<String> allRefs = new HashSet<>();
            // Pattern to match TBL("tableName", ...) and exclude the quoted table name
            // First, remove all quoted strings to avoid matching table names
            String withoutQuotes = expression.replaceAll("\"[^\"]*\"", "");
            // Use regex to find all CamelCase identifiers that are not functions
            Pattern pattern = Pattern.compile("\\b([A-Z][a-zA-Z0-9]*[a-z][a-zA-Z0-9]*)\\b");
            Matcher matcher = pattern.matcher(withoutQuotes);
            while (matcher.find()) {
                String name = matcher.group(1);
                // Skip if it's a function
                if (!com.atlas.engine.expr.Functions.has(name)) {
                    allRefs.add(name);
                }
            }
            return allRefs;
        }
    }
    
    /**
     * Recursively extract component references from AST nodes.
     */
    private void extractComponentRefs(ExprNode node, Set<String> deps) {
        if (node instanceof ComponentRefNode) {
            deps.add(((ComponentRefNode) node).getComponentName());
        } else if (node instanceof com.atlas.engine.expr.BinaryOpNode) {
            com.atlas.engine.expr.BinaryOpNode binOp = (com.atlas.engine.expr.BinaryOpNode) node;
            extractComponentRefs(binOp.getLeft(), deps);
            extractComponentRefs(binOp.getRight(), deps);
        } else if (node instanceof com.atlas.engine.expr.UnaryOpNode) {
            com.atlas.engine.expr.UnaryOpNode unOp = (com.atlas.engine.expr.UnaryOpNode) node;
            extractComponentRefs(unOp.getOperand(), deps);
        } else if (node instanceof com.atlas.engine.expr.FunctionCallNode) {
            com.atlas.engine.expr.FunctionCallNode funcCall = (com.atlas.engine.expr.FunctionCallNode) node;
            for (ExprNode arg : funcCall.getArguments()) {
                extractComponentRefs(arg, deps);
            }
        }
    }
    
    /**
     * Fallback regex extraction for CamelCase component names.
     * Matches identifiers that start with uppercase and contain lowercase letters.
     */
    private Set<String> extractDependenciesRegex(Set<String> availableComponents) {
        Set<String> deps = new HashSet<>();
        // Pattern for CamelCase: starts with uppercase, contains lowercase
        Pattern pattern = Pattern.compile("\\b([A-Z][a-zA-Z0-9]*[a-z][a-zA-Z0-9]*)\\b");
        Matcher matcher = pattern.matcher(expression);
        while (matcher.find()) {
            String name = matcher.group(1);
            // Only add if it's not a function and is in available components
            if (!com.atlas.engine.expr.Functions.has(name) && availableComponents.contains(name)) {
                deps.add(name);
            }
        }
        return deps;
    }

    /**
     * Validate the expression syntax.
     */
    public ValidationResult validate(Set<String> availableComponents) {
        if (expression == null || expression.trim().isEmpty()) {
            return ValidationResult.error("Expression cannot be empty");
        }

        try {
            ExprParser parser = new ExprParser(expression, availableComponents);
            parser.parse();
            return ValidationResult.success();
        } catch (Exception e) {
            return ValidationResult.error("Parse error: " + e.getMessage());
        }
    }

    /**
     * Evaluate the expression in the given context.
     * @param context The model EvalContext (from com.atlas.engine.model.EvalContext)
     * @param componentNames Set of available component names
     * @return The evaluated result as BigDecimal
     */
    public BigDecimal evaluate(EvalContext context, Set<String> componentNames) {
        com.atlas.engine.expr.EvalContext exprContext = new DefaultEvalContext(context);
        Value result = evaluator.evaluate(expression, exprContext);
        return result.asNumber();
    }
    
    /**
     * Evaluate the expression with detailed tracing of intermediate steps.
     * @param context The model EvalContext
     * @param componentNames Set of available component names
     * @return A result containing both the value and the trace steps
     */
    public EvaluationTraceResult evaluateWithTrace(EvalContext context, Set<String> componentNames) {
        com.atlas.engine.expr.EvalContext exprContext = new DefaultEvalContext(context);
        TracingExprEvaluator tracingEvaluator = new TracingExprEvaluator();
        Value result = tracingEvaluator.evaluate(expression, exprContext);
        return new EvaluationTraceResult(result.asNumber(), tracingEvaluator.getTraceSteps());
    }
    
    public static class EvaluationTraceResult {
        private final BigDecimal value;
        private final java.util.List<String> traceSteps;
        
        public EvaluationTraceResult(BigDecimal value, java.util.List<String> traceSteps) {
            this.value = value;
            this.traceSteps = traceSteps;
        }
        
        public BigDecimal getValue() {
            return value;
        }
        
        public java.util.List<String> getTraceSteps() {
            return traceSteps;
        }
    }

    public static class ValidationResult {
        private final boolean valid;
        private final String errorMessage;

        private ValidationResult(boolean valid, String errorMessage) {
            this.valid = valid;
            this.errorMessage = errorMessage;
        }

        public static ValidationResult success() {
            return new ValidationResult(true, null);
        }

        public static ValidationResult error(String message) {
            return new ValidationResult(false, message);
        }

        public boolean isValid() {
            return valid;
        }

        public String getErrorMessage() {
            return errorMessage;
        }
    }
}

