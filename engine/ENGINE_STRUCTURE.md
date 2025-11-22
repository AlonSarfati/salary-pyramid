# Engine Module Structure

## Overview

The engine module has been reorganized to support a comprehensive expression evaluation system while maintaining backward compatibility with existing rules.

## Package Structure

```
com.atlas.engine/
├── model/              # Core domain models
│   ├── Rule.java              # Rule entity (existing, unchanged)
│   ├── RuleSet.java           # RuleSet entity (existing, unchanged)
│   ├── RuleExpression.java    # NEW: Expression wrapper with validation
│   ├── RuleBuilder.java       # NEW: Fluent API for building rules
│   ├── RuleSetBuilder.java    # NEW: Fluent API for building rulesets
│   ├── ExpressionExamples.java # NEW: Comprehensive expression examples
│   ├── EvalContext.java       # Evaluation context (existing)
│   ├── EvaluationResult.java  # Evaluation results (existing)
│   ├── ComponentResult.java   # Component results (existing)
│   └── Trace.java             # Execution trace (existing)
│
├── expr/               # NEW: Expression evaluation system
│   ├── Value.java              # Value container (BigDecimal-based)
│   ├── ValueType.java          # Value type enum
│   ├── ExprFunction.java       # Function interface
│   ├── Functions.java          # Function registry
│   ├── ExprNode.java           # AST node interface
│   ├── ExprParser.java         # Expression parser
│   ├── ExprEvaluator.java      # Expression evaluator
│   ├── EvalContext.java        # Expression evaluation context
│   ├── DefaultEvalContext.java # Context implementation
│   ├── TableLookupService.java # Table lookup interface
│   ├── TableLookupServiceAdapter.java # Adapter to TableService SPI
│   │
│   ├── nodes/          # AST node implementations
│   │   ├── NumberNode.java
│   │   ├── BooleanNode.java
│   │   ├── StringNode.java
│   │   ├── ComponentRefNode.java
│   │   ├── FunctionCallNode.java
│   │   ├── BinaryOpNode.java
│   │   └── UnaryOpNode.java
│   │
│   └── functions/      # Built-in functions
│       ├── IfFunction.java
│       ├── MinFunction.java
│       ├── MaxFunction.java
│       ├── RoundFunction.java
│       └── TblFunction.java
│
├── eval/               # Evaluation engine (existing)
│   ├── Evaluator.java          # Evaluator interface
│   ├── DefaultEvaluator.java   # Default implementation
│   ├── DependencyResolver.java # Dependency resolution
│   ├── TableCallResolver.java  # Table call resolution
│   └── RegexTableCallResolver.java # Regex-based table resolver
│
├── dsl/                # Legacy DSL (existing, still supported)
│   └── ExpressionEvaluator.java # Original expression evaluator
│
└── spi/                # Service Provider Interface
    └── TableService.java        # Table service interface
```

## Key Components

### 1. Model Layer (`model/`)

#### RuleExpression
- Wraps expression strings with type detection (Legacy vs Modern)
- Provides validation capabilities
- Extracts component dependencies automatically

#### RuleBuilder
- Fluent API for constructing rules
- Automatic dependency extraction
- Built-in validation
- Support for metadata (groups, taxable flags, caps, etc.)

#### RuleSetBuilder
- Fluent API for constructing rulesets
- Validates all rules in a ruleset
- Manages component availability

#### ExpressionExamples
- Comprehensive collection of example expressions
- Organized by category (Arithmetic, Conditional, Min/Max, etc.)
- Real-world salary calculation examples
- Pre-built example rules

### 2. Expression System (`expr/`)

#### Core Types
- **Value**: Type-safe value container using BigDecimal
- **ValueType**: Enum for NUMBER, BOOLEAN, STRING
- **ExprFunction**: Interface for custom functions

#### Parser & Evaluator
- **ExprParser**: Recursive descent parser supporting:
  - All arithmetic operators
  - Comparison operators
  - Logical operators
  - Function calls
  - IF-THEN-ELSE syntax
- **ExprEvaluator**: Evaluates parsed expressions

#### AST Nodes
- **NumberNode**: Numeric literals
- **BooleanNode**: Boolean literals
- **StringNode**: String literals
- **ComponentRefNode**: Component references (${Name})
- **FunctionCallNode**: Function invocations
- **BinaryOpNode**: Binary operations
- **UnaryOpNode**: Unary operations

#### Built-in Functions
- **IfFunction**: Conditional evaluation
- **MinFunction**: Minimum value
- **MaxFunction**: Maximum value
- **RoundFunction**: Rounding
- **TblFunction**: Table lookups

### 3. Evaluation Layer (`eval/`)

The existing evaluation layer continues to work with both legacy and modern expressions through the `DefaultEvaluator`.

## Usage Patterns

### Pattern 1: Simple Rule Creation

```java
Rule rule = RuleBuilder.create()
    .target("Performance Bonus")
    .expression("IF ${Base} > 50000 THEN ${Base} * 0.15 ELSE ${Base} * 0.10")
    .dependsOn("Base")
    .group("bonus")
    .taxable(true)
    .build();
```

### Pattern 2: RuleSet Creation

```java
RuleSet ruleSet = RuleSetBuilder.create()
    .id("2024-rules")
    .rule(RuleBuilder.create()
        .target("Base Salary")
        .expression("${Base}")
        .dependsOn("Base")
        .build())
    .rule(RuleBuilder.create()
        .target("Bonus")
        .expression("IF ${Base} > 50000 THEN ${Base} * 0.15 ELSE ${Base} * 0.10")
        .dependsOn("Base")
        .build())
    .build();
```

### Pattern 3: Using Examples

```java
// Get example expressions
Map<String, List<String>> examples = ExpressionExamples.getAllExamples();

// Use specific example
String expression = ExpressionExamples.SalaryCalculations.PERFORMANCE_BONUS;

// Get complete example rules
List<Rule> exampleRules = ExpressionExamples.getExampleRules();
```

### Pattern 4: Expression Validation

```java
RuleExpression expr = new RuleExpression("IF ${Base} > 50000 THEN 1000 ELSE 500");
RuleExpression.ValidationResult result = expr.validate(availableComponents);

if (!result.isValid()) {
    System.err.println("Error: " + result.getErrorMessage());
}
```

## Expression Syntax

### Supported Operators

**Arithmetic:**
- `+` Addition
- `-` Subtraction
- `*` Multiplication
- `/` Division

**Comparison:**
- `=` Equals
- `!=` Not equals
- `>` Greater than
- `>=` Greater than or equal
- `<` Less than
- `<=` Less than or equal

**Logical:**
- `AND` Logical AND
- `OR` Logical OR
- `NOT` Logical NOT

### Supported Functions

- `IF(condition, trueValue, falseValue)` - Conditional
- `MIN(value1, value2, ...)` - Minimum
- `MAX(value1, value2, ...)` - Maximum
- `ROUND(value, [precision])` - Rounding
- `TBL(tableName, key1, key2, ...)` - Table lookup

### Alternative Syntax

- `IF condition THEN expr ELSE expr` - Alternative IF syntax (converted to IF function)

## Integration Points

### With Existing System

1. **Backward Compatible**: Legacy expressions continue to work
2. **Gradual Migration**: Can mix legacy and modern expressions
3. **Table Service**: Integrates with existing `TableService` SPI
4. **Evaluation**: Works with existing `DefaultEvaluator`

### With UI

The new expression system provides:
- Rich expression examples for the rule builder
- Validation feedback
- Syntax highlighting support
- Auto-completion opportunities

## Testing

Comprehensive test coverage includes:
- `ExprEvaluatorTest`: Expression evaluation tests
- `RuleBuilderExamplesTest`: Rule builder usage examples
- `EngineSmokeTest`: End-to-end engine tests

## Migration Guide

### From Legacy to Modern Syntax

1. **Conditionals:**
   - Old: `if(cond, a, b)`
   - New: `IF(cond, a, b)` or `IF cond THEN a ELSE b`

2. **Min/Max:**
   - Old: `min(a, b)`, `max(a, b)`
   - New: `MIN(a, b)`, `MAX(a, b)`

3. **Table Lookups:**
   - Old: Regex-based `TBL(...)` resolution
   - New: Function-based `TBL(...)` with proper argument handling

4. **Operators:**
   - Old: Limited operator support
   - New: Full operator support with proper precedence

## Future Enhancements

Potential additions:
- Custom function registration
- Expression optimization
- Caching of parsed expressions
- Expression templates
- Visual expression builder support

