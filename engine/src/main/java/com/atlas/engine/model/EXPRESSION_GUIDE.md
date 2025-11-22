# Expression System Guide

## Overview

The engine supports a powerful expression evaluation system with full operator and function support. This guide demonstrates how to use the expression syntax in rule definitions.

## Component and Function Naming

- **Components**: Use CamelCase (e.g., `BaseSalary`, `PerformanceBonus`, `YearsOfService`)
- **Functions**: Use ALL_CAPS (e.g., `IF`, `MIN`, `MAX`, `ROUND`, `TBL`)

## Quick Start

### Using RuleBuilder

```java
Rule rule = RuleBuilder.create()
    .target("PerformanceBonus")
    .expression("IF BaseSalary > 50000 THEN BaseSalary * 0.15 ELSE BaseSalary * 0.10")
    .dependsOn("BaseSalary")
    .group("bonus")
    .taxable(true)
    .build();
```

### Using RuleSetBuilder

```java
RuleSet ruleSet = RuleSetBuilder.create()
    .id("2024-rules")
    .rule(RuleBuilder.create()
        .target("BaseSalary")
        .expression("BaseSalary")
        .dependsOn("BaseSalary")
        .build())
    .rule(RuleBuilder.create()
        .target("Bonus")
        .expression("IF BaseSalary > 50000 THEN BaseSalary * 0.15 ELSE BaseSalary * 0.10")
        .dependsOn("BaseSalary")
        .build())
    .build();
```

## Expression Examples

### Arithmetic Operations

```java
// Addition
"BaseSalary + Bonus"

// Subtraction
"BaseSalary - Deduction"

// Multiplication
"BaseSalary * 0.15"

// Division
"TotalCompensation / 12"

// Complex
"(BaseSalary + Bonus) * 1.05 - Deduction"
```

### Conditional Expressions

#### IF Function
```java
"IF(BaseSalary > 50000, BaseSalary * 0.10, BaseSalary * 0.05)"
```

#### IF-THEN-ELSE Syntax
```java
"IF BaseSalary > 50000 THEN BaseSalary * 0.10 ELSE BaseSalary * 0.05"
```

#### Nested Conditionals
```java
"IF YearsOfService >= 5 THEN IF BaseSalary > 100000 THEN 5000 ELSE 3000 ELSE 1000"
```

#### Multiple Conditions
```java
"IF BaseSalary > 50000 AND PerformanceRating > 80 THEN BaseSalary * 0.15 ELSE BaseSalary * 0.10"
```

### Min/Max Functions

```java
// Minimum
"MIN(BaseSalary, Cap)"

// Maximum
"MAX(BaseSalary, Minimum)"

// Clamp between min and max
"MIN(MAX(BaseSalary, Minimum), Maximum)"

// Multiple values
"MAX(BaseSalary, Bonus, Commission)"
```

### Rounding Functions

```java
// Round to nearest integer
"ROUND(Amount)"

// Round to 2 decimal places
"ROUND(Amount, 2)"

// Round percentage
"ROUND(BaseSalary * 0.0825, 2)"
```

### Table Lookups

```java
// Simple lookup
"TBL(\"bonus_table\", YearsOfService)"

// Multiple keys
"TBL(\"salary_bands\", Grade, Level)"

// With date
"TBL(\"tax_rates\", Income, \"2024-01-01\")"

// In expression
"BaseSalary + TBL(\"bonus_table\", PerformanceRating)"
```

### Logical Operators

```java
// AND
"IF BaseSalary > 50000 AND PerformanceRating > 80 THEN BaseSalary * 0.15 ELSE 0"

// OR
"IF BaseSalary > 100000 OR YearsOfService >= 10 THEN 5000 ELSE 0"

// NOT
"IF NOT IsExempt THEN BaseSalary * 0.10 ELSE 0"

// Complex
"IF (BaseSalary > 50000 AND PerformanceRating > 80) OR IsManager = 1 THEN BaseSalary * 0.20 ELSE BaseSalary * 0.10"
```

### Comparison Operators

```java
// Greater than
"IF BaseSalary > 50000 THEN BaseSalary * 0.10 ELSE BaseSalary * 0.05"

// Less than
"IF BaseSalary < 30000 THEN BaseSalary * 0.15 ELSE BaseSalary * 0.10"

// Greater than or equal
"IF YearsOfService >= 5 THEN 5000 ELSE 0"

// Less than or equal
"IF Age <= 30 THEN BaseSalary * 0.05 ELSE BaseSalary * 0.08"

// Equals
"IF Department = \"Engineering\" THEN BaseSalary * 0.12 ELSE BaseSalary * 0.10"

// Not equals
"IF Status != \"Inactive\" THEN BaseSalary * 0.10 ELSE 0"
```

## Real-World Examples

### Performance Bonus with Cap
```java
"MIN(MAX(BaseSalary * PerformanceRating / 100, 0), BaseSalary * 0.25)"
```

### Pension Contribution with Minimum
```java
"MAX(BaseSalary * 0.08, 2000)"
```

### Health Insurance (Conditional)
```java
"IF HasFamily = 1 THEN 1500 ELSE 800"
```

### Overtime Calculation
```java
"IF Hours > 40 THEN (Hours - 40) * Rate * 1.5 ELSE 0"
```

### Commission with Tiers
```java
"IF Sales >= 100000 THEN Sales * 0.10 ELSE IF Sales >= 50000 THEN Sales * 0.07 ELSE Sales * 0.05"
```

### Stock Options (Table Lookup)
```java
"TBL(\"stock_options\", Level, YearsOfService)"
```

### Tax Calculation with Brackets
```java
"IF Income > 100000 THEN Income * 0.30 ELSE IF Income > 50000 THEN Income * 0.25 ELSE Income * 0.20"
```

## Using ExpressionExamples

The `ExpressionExamples` class provides pre-defined examples organized by category:

```java
// Get all examples by category
Map<String, List<String>> examples = ExpressionExamples.getAllExamples();

// Access specific examples
String addExample = ExpressionExamples.Arithmetic.ADD;
String ifExample = ExpressionExamples.Conditional.IF_THEN_ELSE;
String minExample = ExpressionExamples.MinMax.MIN;

// Get complete example rules
List<Rule> exampleRules = ExpressionExamples.getExampleRules();
```

## Validation

Rules can be validated before building:

```java
Set<String> availableComponents = Set.of("BaseSalary", "Bonus", "Commission");

Rule rule = RuleBuilder.create()
    .target("Total")
    .expression("BaseSalary + Bonus")
    .availableComponents(availableComponents)
    .buildAndValidate(availableComponents);
```

## Best Practices

1. **Always specify dependencies** - Use `dependsOn()` or let the builder auto-extract them
2. **Use groups** - Organize rules with `group()` for better management
3. **Add metadata** - Use `meta()` for additional rule information
4. **Set effective dates** - Use `effectiveBetween()` for time-bound rules
5. **Validate expressions** - Use `buildAndValidate()` when possible
6. **Use meaningful names** - Component and rule names should be descriptive
7. **Use CamelCase for components** - Component names must be CamelCase (e.g., `BaseSalary`, not `base_salary` or `Base_Salary`)
8. **Use ALL_CAPS for functions** - Function names must be ALL_CAPS (e.g., `IF`, `MIN`, not `if`, `min`)

## Component References

Components are referenced using CamelCase identifiers:
- `BaseSalary` - References the "BaseSalary" component
- `PerformanceBonus` - References the "PerformanceBonus" component
- `TotalCompensation` - References the "TotalCompensation" component

**Important**: Component names must:
- Start with an uppercase letter
- Contain at least one lowercase letter
- Not be ALL_CAPS (which are reserved for functions)

## Function Calls

Functions must be called with parentheses:
- `IF(condition, trueValue, falseValue)` - Correct
- `IF condition THEN trueValue ELSE falseValue` - Also correct (converted to IF function)
- `IF` - Error: Functions must be called with parentheses

**Important**: Function names must be ALL_CAPS:
- `IF`, `MIN`, `MAX`, `ROUND`, `TBL` - Correct
- `if`, `min`, `max` - Error: Functions must be ALL_CAPS

## Operator Precedence

Operators are evaluated in this order (highest to lowest):
1. Parentheses `()`
2. Unary operators: `NOT`, `-`
3. Multiplicative: `*`, `/`
4. Additive: `+`, `-`
5. Comparison: `>`, `>=`, `<`, `<=`, `=`, `!=`
6. Logical AND: `AND`
7. Logical OR: `OR`

## Error Handling

Invalid expressions will throw `IllegalArgumentException` with descriptive messages:

```java
try {
    Rule rule = RuleBuilder.create()
        .target("Test")
        .expression("INVALID SYNTAX")
        .buildAndValidate(components);
} catch (IllegalArgumentException e) {
    // Handle validation error
    System.err.println("Invalid expression: " + e.getMessage());
}
```

Common errors:
- `Unknown component: ComponentName` - Component not found in available components
- `Function 'FUNCTION' must be called with parentheses` - Function used without parentheses
- `Component names must be CamelCase` - Component name doesn't follow CamelCase convention
- `Function names must be ALL_CAPS` - Function name not in ALL_CAPS
