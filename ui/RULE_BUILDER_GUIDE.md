# Rule Builder Guide Feature

## Overview

A comprehensive, user-friendly guide has been added to the Rule Builder page to help users understand how to build rules effectively.

## Location

The guide is accessible as the first tab in the Rule Builder page:
- **Tab Name:** "How to Build Rules"
- **Icon:** CheckCircle
- **Default Tab:** Yes (opens by default)

## Features

### 1. Basics Tab
- **Understanding Rules:** Explains what rules are and their components
- **Quick Start:** Step-by-step guide (4 steps) for creating your first rule
- Visual examples with clear explanations

### 2. Expressions Tab
- **Component References:** How to reference other components using `${ComponentName}`
- **Arithmetic Operators:** +, -, *, / with examples
- **Comparison Operators:** >, >=, <, <=, =, != with examples
- **Logical Operators:** AND, OR, NOT with examples

### 3. Functions Tab
- **IF Function:** Conditional logic with both syntaxes
  - Function syntax: `IF(condition, trueValue, falseValue)`
  - Natural language: `IF condition THEN expr ELSE expr`
- **MIN Function:** Finding minimum values, clamping examples
- **MAX Function:** Finding maximum values, minimum guarantees
- **ROUND Function:** Rounding to integers and decimal places
- **TBL Function:** Table lookups with single and multiple keys

### 4. Examples Tab
Real-world salary calculation examples:
- Performance Bonus with Cap
- Pension with Minimum
- Conditional Health Insurance
- Overtime Calculation
- Tiered Commission
- Complex Conditional Logic

### 5. Best Practices Tab
7 key best practices:
- Use Clear Component Names
- Always Specify Dependencies
- Use Groups to Organize
- Validate Before Publishing
- Use Effective Dates
- Test with Sample Data
- Keep Expressions Simple

### 6. Troubleshooting Tab
Common issues and solutions:
- Circular Dependency errors
- Unknown Variable errors
- Parse Errors
- Expression Returns Zero
- Help section for additional support

## Design Features

- **Visual Hierarchy:** Clear headings, icons, and color coding
- **Code Examples:** Syntax-highlighted code blocks
- **Color-Coded Badges:** Different colors for different function types
- **Step-by-Step Instructions:** Numbered steps for quick start
- **Error Examples:** Shows both correct (✓) and incorrect (✗) syntax
- **Real-World Context:** Examples based on actual salary calculations

## User Experience

1. **Default View:** Guide opens by default when entering Rule Builder
2. **Easy Navigation:** 6 organized tabs for different topics
3. **Copy-Paste Ready:** Code examples can be directly copied
4. **Visual Learning:** Icons and colors help visual learners
5. **Progressive Disclosure:** From basics to advanced topics

## Integration

The guide is fully integrated into the Rule Builder:
- Accessible from the main tabs
- Maintains consistent styling with the rest of the app
- Uses the same UI components (Card, Badge, Tabs)
- Responsive design for all screen sizes

## Benefits

1. **Reduces Learning Curve:** New users can quickly understand the system
2. **Self-Service Support:** Users can find answers without asking for help
3. **Consistency:** Ensures all users follow best practices
4. **Error Prevention:** Troubleshooting section helps avoid common mistakes
5. **Productivity:** Examples provide templates for common scenarios

