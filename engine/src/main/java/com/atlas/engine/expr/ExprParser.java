package com.atlas.engine.expr;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Parser for expressions.
 * Supports:
 * - Operators: + - * / ^ = != > >= < <= AND OR NOT
 * - Functions: IF(...), MIN(...), MAX(...), ROUND(...), TBL(...) (ALL_CAPS)
 * - Component references: CamelCase identifiers (e.g., BaseSalary, PerformanceBonus)
 * - IF condition THEN expr ELSE expr syntax (converted to IF function)
 * - Exponentiation: ^ operator (e.g., 1.01 ^ Vetek)
 */
public class ExprParser {
    private final String input;
    private int pos;
    private final Set<String> componentNames;

    public ExprParser(String input, Set<String> componentNames) {
        this.input = input;
        this.pos = 0;
        this.componentNames = componentNames;
    }

    public ExprNode parse() {
        ExprNode expr = parseExpression();
        skipWhitespace();
        if (pos < input.length()) {
            throw new IllegalArgumentException("Unexpected character at position " + pos + ": '" + input.charAt(pos) + 
                "'. Remaining input: '" + input.substring(pos) + "'");
        }
        return expr;
    }

    // Expression with lowest precedence (OR)
    private ExprNode parseExpression() {
        ExprNode left = parseAndExpression();
        skipWhitespace();
        while (pos < input.length() && matchToken("OR", true)) {
            skipWhitespace();
            ExprNode right = parseAndExpression();
            left = new BinaryOpNode(left, BinaryOpNode.Operator.OR, right);
            skipWhitespace();
        }
        return left;
    }

    // AND expression
    private ExprNode parseAndExpression() {
        ExprNode left = parseComparison();
        skipWhitespace();
        while (pos < input.length() && matchToken("AND", true)) {
            skipWhitespace();
            ExprNode right = parseComparison();
            left = new BinaryOpNode(left, BinaryOpNode.Operator.AND, right);
            skipWhitespace();
        }
        return left;
    }

    // Comparison operators (= != > >= < <=)
    private ExprNode parseComparison() {
        ExprNode left = parseAdditive();
        skipWhitespace();
        
        if (pos >= input.length()) return left;
        
        if (matchToken(">=", false)) {
            skipWhitespace();
            return new BinaryOpNode(left, BinaryOpNode.Operator.GREATER_THAN_OR_EQUAL, parseAdditive());
        }
        if (matchToken("<=", false)) {
            skipWhitespace();
            return new BinaryOpNode(left, BinaryOpNode.Operator.LESS_THAN_OR_EQUAL, parseAdditive());
        }
        if (matchToken("!=", false)) {
            skipWhitespace();
            return new BinaryOpNode(left, BinaryOpNode.Operator.NOT_EQUALS, parseAdditive());
        }
        if (matchToken("=", false)) {
            skipWhitespace();
            return new BinaryOpNode(left, BinaryOpNode.Operator.EQUALS, parseAdditive());
        }
        if (matchToken(">", false)) {
            skipWhitespace();
            return new BinaryOpNode(left, BinaryOpNode.Operator.GREATER_THAN, parseAdditive());
        }
        if (matchToken("<", false)) {
            skipWhitespace();
            return new BinaryOpNode(left, BinaryOpNode.Operator.LESS_THAN, parseAdditive());
        }
        
        return left;
    }

    // Additive operators (+ -)
    private ExprNode parseAdditive() {
        ExprNode left = parseMultiplicative();
        skipWhitespace();
        while (pos < input.length()) {
            if (matchToken("+", false)) {
                skipWhitespace();
                ExprNode right = parseMultiplicative();
                left = new BinaryOpNode(left, BinaryOpNode.Operator.ADD, right);
                skipWhitespace();
            } else if (matchToken("-", false)) {
                skipWhitespace();
                ExprNode right = parseMultiplicative();
                left = new BinaryOpNode(left, BinaryOpNode.Operator.SUBTRACT, right);
                skipWhitespace();
            } else {
                break;
            }
        }
        return left;
    }

    // Multiplicative operators (* /)
    private ExprNode parseMultiplicative() {
        ExprNode left = parseExponentiation();
        skipWhitespace();
        while (pos < input.length()) {
            if (matchToken("*", false)) {
                skipWhitespace();
                ExprNode right = parseExponentiation();
                left = new BinaryOpNode(left, BinaryOpNode.Operator.MULTIPLY, right);
                skipWhitespace();
            } else if (matchToken("/", false)) {
                skipWhitespace();
                ExprNode right = parseExponentiation();
                left = new BinaryOpNode(left, BinaryOpNode.Operator.DIVIDE, right);
                skipWhitespace();
            } else {
                break;
            }
        }
        return left;
    }

    // Exponentiation operator (^) - higher precedence than multiplication
    private ExprNode parseExponentiation() {
        ExprNode left = parseUnary();
        skipWhitespace();
        while (pos < input.length()) {
            if (matchToken("^", false)) {
                skipWhitespace();
                ExprNode right = parseUnary(); // Right-associative: a^b^c = a^(b^c)
                left = new BinaryOpNode(left, BinaryOpNode.Operator.POWER, right);
                skipWhitespace();
            } else {
                break;
            }
        }
        return left;
    }

    // Unary operators (NOT, -)
    private ExprNode parseUnary() {
        skipWhitespace();
        if (matchToken("NOT", true)) {
            skipWhitespace();
            return new UnaryOpNode(UnaryOpNode.Operator.NOT, parseUnary());
        }
        if (matchToken("-", false)) {
            skipWhitespace();
            return new UnaryOpNode(UnaryOpNode.Operator.NEGATE, parseUnary());
        }
        return parsePrimary();
    }

    // Primary expressions (literals, identifiers, function calls, parentheses, IF-THEN-ELSE)
    private ExprNode parsePrimary() {
        skipWhitespace();
        
        // IF condition THEN expr ELSE expr   OR   IF(...) function call
        if (matchToken("IF", true)) {
            skipWhitespace();
            // Function-style IF(...)
            if (pos < input.length() && input.charAt(pos) == '(') {
                return parseFunctionCall("IF");
            }
            // IF/THEN/ELSE syntax
            return parseIfThenElse();
        }
        
        // Boolean literal (must be checked before identifier parsing)
        // Case-insensitive: matches True, TRUE, true, etc.
        if (matchToken("TRUE", false)) {
            return new BooleanNode(true);
        }
        if (matchToken("FALSE", false)) {
            return new BooleanNode(false);
        }
        
        // Identifier parsing (functions or components)
        if (pos < input.length() && Character.isLetter(input.charAt(pos))) {
            String name = parseIdentifier();
            skipWhitespace();
            
            // Check if followed by '(' - must be a function call
            if (pos < input.length() && input.charAt(pos) == '(') {
                // Functions must be ALL_CAPS
                if (!isAllCaps(name)) {
                    throw new IllegalArgumentException("Function names must be ALL_CAPS. Found: " + name);
                }
                return parseFunctionCall(name);
            }
            
            // Not a function call - check if it's a function name (error) or component
            if (Functions.has(name)) {
                throw new IllegalArgumentException("Function '" + name + "' must be called with parentheses");
            }
            
            // Check if it's ALL_CAPS but not a known function - error
            if (isAllCaps(name)) {
                throw new IllegalArgumentException("Unknown function: " + name + ". Functions must be called with parentheses.");
            }
            
            // Check if it's a lowercase identifier (could be a group name)
            boolean isLowercase = name.chars().allMatch(c -> !Character.isUpperCase(c));
            
            // Must be a component reference (CamelCase) or group name (lowercase)
            if (!isCamelCase(name) && !isLowercase) {
                throw new IllegalArgumentException("Component names must be CamelCase or lowercase (for groups). Found: " + name);
            }
            
            // Validate against available component names (if provided)
            if (componentNames != null && !componentNames.isEmpty() && isCamelCase(name) && !componentNames.contains(name)) {
                throw new IllegalArgumentException("Unknown component: " + name);
            }
            
            // Allow lowercase group references
            return new ComponentRefNode(name);
        }
        
        // String literal
        if (pos < input.length() && input.charAt(pos) == '"') {
            return parseStringLiteral();
        }
        
        // Number literal
        if (pos < input.length() && (Character.isDigit(input.charAt(pos)) || input.charAt(pos) == '.')) {
            return parseNumberLiteral();
        }
        
        // Parenthesized expression
        if (pos < input.length() && input.charAt(pos) == '(') {
            pos++; // Consume the opening parenthesis
            skipWhitespace();
            ExprNode expr = parseExpression();
            skipWhitespace();
            if (pos >= input.length() || input.charAt(pos) != ')') {
                throw new IllegalArgumentException("Expected ')' at position " + pos);
            }
            pos++; // Consume the closing parenthesis
            skipWhitespace();
            return expr;
        }
        
        throw new IllegalArgumentException("Unexpected character at position " + pos + ": " + 
                (pos < input.length() ? input.charAt(pos) : "EOF"));
    }

    private ExprNode parseIfThenElse() {
        skipWhitespace();
        
        // Parse condition
        ExprNode condition = parseExpression();
        
        skipWhitespace();
        if (!matchToken("THEN", true)) {
            throw new IllegalArgumentException("Expected 'THEN' after IF condition at position " + pos);
        }
        
        skipWhitespace();
        ExprNode trueExpr = parseExpression();
        
        skipWhitespace();
        if (!matchToken("ELSE", true)) {
            throw new IllegalArgumentException("Expected 'ELSE' after THEN expression at position " + pos);
        }
        
        skipWhitespace();
        ExprNode falseExpr = parseExpression();
        
        // Convert to IF(condition, trueExpr, falseExpr)
        return new FunctionCallNode("IF", List.of(condition, trueExpr, falseExpr));
    }

    private ExprNode parseFunctionCall(String functionName) {
        if (!matchToken("(", false)) {
            throw new IllegalArgumentException("Expected '(' after function name");
        }
        
        List<ExprNode> args = new ArrayList<>();
        skipWhitespace();
        
        // Check for empty argument list
        if (matchToken(")", false)) {
            return new FunctionCallNode(functionName, args);
        }
        
        // Parse first argument
        args.add(parseExpression());
        skipWhitespace();
        
        // Parse additional arguments
        while (pos < input.length() && input.charAt(pos) == ',') {
            pos++; // Consume comma
            skipWhitespace();
            args.add(parseExpression());
            skipWhitespace();
        }
        
        // Expect closing parenthesis
        if (pos >= input.length() || input.charAt(pos) != ')') {
            throw new IllegalArgumentException("Expected ')' after function arguments at position " + pos + 
                ". Found: " + (pos < input.length() ? "'" + input.charAt(pos) + "'" : "EOF"));
        }
        pos++; // Consume closing parenthesis
        skipWhitespace();
        
        return new FunctionCallNode(functionName, args);
    }

    /**
     * Check if identifier is ALL_CAPS (for functions).
     */
    private boolean isAllCaps(String name) {
        if (name == null || name.isEmpty()) {
            return false;
        }
        for (char c : name.toCharArray()) {
            if (Character.isLetter(c) && !Character.isUpperCase(c)) {
                return false;
            }
        }
        return name.chars().anyMatch(Character::isLetter); // At least one letter
    }
    
    /**
     * Check if identifier is CamelCase (for components).
     * CamelCase: starts with uppercase, contains lowercase letters.
     */
    private boolean isCamelCase(String name) {
        if (name == null || name.isEmpty()) {
            return false;
        }
        if (!Character.isUpperCase(name.charAt(0))) {
            return false;
        }
        // Must contain at least one lowercase letter after the first character
        for (int i = 1; i < name.length(); i++) {
            if (Character.isLowerCase(name.charAt(i))) {
                return true;
            }
        }
        return false;
    }

    private ExprNode parseStringLiteral() {
        pos++; // skip opening quote
        StringBuilder sb = new StringBuilder();
        while (pos < input.length() && input.charAt(pos) != '"') {
            if (input.charAt(pos) == '\\' && pos + 1 < input.length()) {
                char next = input.charAt(pos + 1);
                if (next == '"' || next == '\\') {
                    sb.append(next);
                    pos += 2;
                    continue;
                }
            }
            sb.append(input.charAt(pos));
            pos++;
        }
        if (pos >= input.length()) {
            throw new IllegalArgumentException("Unclosed string literal");
        }
        pos++; // skip closing quote
        return new StringNode(sb.toString());
    }

    private ExprNode parseNumberLiteral() {
        int start = pos;
        StringBuilder sb = new StringBuilder();
        boolean hasDot = false;
        
        if (pos < input.length() && input.charAt(pos) == '-') {
            sb.append('-');
            pos++;
        }
        
        while (pos < input.length() && (Character.isDigit(input.charAt(pos)) || input.charAt(pos) == '.')) {
            if (input.charAt(pos) == '.') {
                if (hasDot) {
                    throw new IllegalArgumentException("Invalid number literal at position " + start);
                }
                hasDot = true;
            }
            sb.append(input.charAt(pos));
            pos++;
        }
        
        try {
            return new NumberNode(new BigDecimal(sb.toString()));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid number literal at position " + start + ": " + sb.toString());
        }
    }

    private String parseIdentifier() {
        StringBuilder sb = new StringBuilder();
        // Allow letters, digits, and underscores for identifiers
        // CamelCase components can have multiple words (e.g., BaseSalary, PerformanceBonus)
        while (pos < input.length() && (Character.isLetterOrDigit(input.charAt(pos)) || input.charAt(pos) == '_')) {
            sb.append(input.charAt(pos));
            pos++;
        }
        return sb.toString();
    }

    private boolean matchToken(String token, boolean caseSensitive) {
        if (pos + token.length() > input.length()) {
            return false;
        }

        String substr = input.substring(pos, pos + token.length());
        boolean matches = caseSensitive ? substr.equals(token) : substr.equalsIgnoreCase(token);

        if (!matches) {
            return false;
        }

        // For word-like tokens (identifiers/keywords such as IF, THEN, AND, OR, TRUE, FALSE)
        // we must ensure we don't match inside a longer identifier, e.g. matching IF in "IFX".
        // For symbolic operators (+, -, *, /, >, >=, etc.) this check must NOT run,
        // otherwise expressions like "100/5" would fail because '5' is a digit.
        boolean isWordToken = token.chars().allMatch(ch -> Character.isLetter(ch));

        if (isWordToken && pos + token.length() < input.length()) {
            char next = input.charAt(pos + token.length());
            if (Character.isLetterOrDigit(next) || next == '_') {
                return false;
            }
        }

        pos += token.length();
        return true;
    }

    private void skipWhitespace() {
        while (pos < input.length() && Character.isWhitespace(input.charAt(pos))) {
            pos++;
        }
    }
}

