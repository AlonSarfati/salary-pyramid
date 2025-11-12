package com.atlas.engine.dsl;

import java.math.BigDecimal;
import java.math.MathContext;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Minimal, safe evaluator: supports + - * / ( ), variables ${X}, min(), max(), if(cond,a,b).
 *  cond: a>b, a>=b, a<b, a<=b, a==b, a!=b (numbers only).
 */
public class ExpressionEvaluator {
    private static final Pattern VAR = Pattern.compile("\\$\\{([^}]+)}");
    private static final MathContext MC = MathContext.DECIMAL64;

    public Set<String> variables(String expr) {
        Matcher m = VAR.matcher(expr);
        Set<String> vars = new LinkedHashSet<>();
        while (m.find()) vars.add(m.group(1));
        return vars;
    }

    public BigDecimal eval(String expr, Map<String, Object> vars) {
        String replaced = replaceVars(expr, vars);
        return evalArithmetic(replaced);
    }

    private String replaceVars(String expr, Map<String, Object> vars) {
        Matcher m = VAR.matcher(expr);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            String key = m.group(1);
            Object v = vars.getOrDefault(key, BigDecimal.ZERO);
            m.appendReplacement(sb, v.toString());
        }
        m.appendTail(sb);
        return sb.toString();
    }

    // Very small shunting-yard with functions min,max,if
    private BigDecimal evalArithmetic(String s) {
        return new ShuntingYard().evaluate(s);
    }

    // --- Inner class for brevity ---
    static class ShuntingYard {
        private static final Set<String> OPS = Set.of("+","-","*","/");

        BigDecimal evaluate(String in) {
            List<String> rpn = toRPN(tokenize(in));
            Deque<BigDecimal> st = new ArrayDeque<>();
            for (String t : rpn) {
                if (OPS.contains(t)) {
                    BigDecimal b = st.pop(), a = st.pop();
                    st.push(applyOp(a,b,t));
                } else if ("min".equals(t) || "max".equals(t)) {
                    BigDecimal b = st.pop(), a = st.pop();
                    st.push("min".equals(t) ? a.min(b) : a.max(b));
                } else if (t.startsWith("if[")) { // encoded if[cond]; see toRPN
                    String cond = t.substring(3, t.length()-1);
                    BigDecimal falseV = st.pop(), trueV = st.pop();
                    st.push(evalCond(cond) ? trueV : falseV);
                } else {
                    st.push(new BigDecimal(t));
                }
            }
            return st.pop();
        }

        private boolean evalCond(String cond) {
            String[] ops = {">=", "<=", "==", "!=", ">", "<"};
            for (String op : ops) {
                int i = cond.indexOf(op);
                if (i>0) {
                    BigDecimal a = new BigDecimal(cond.substring(0,i).trim());
                    BigDecimal b = new BigDecimal(cond.substring(i+op.length()).trim());
                    return switch (op) {
                        case ">" -> a.compareTo(b)>0;
                        case "<" -> a.compareTo(b)<0;
                        case ">=" -> a.compareTo(b)>=0;
                        case "<=" -> a.compareTo(b)<=0;
                        case "==" -> a.compareTo(b)==0;
                        default -> a.compareTo(b)!=0; // "!="
                    };
                }
            }
            throw new IllegalArgumentException("Bad condition: "+cond);
        }

        private BigDecimal applyOp(BigDecimal a, BigDecimal b, String op) {
            return switch (op) {
                case "+" -> a.add(b, MC);
                case "-" -> a.subtract(b, MC);
                case "*" -> a.multiply(b, MC);
                case "/" -> a.divide(b, MC);
                default -> throw new IllegalArgumentException("op "+op);
            };
        }

        // Tokenize numbers, ops, parentheses, functions
        private List<String> tokenize(String s) {
            s = s.replaceAll("\\s+","");
            List<String> out = new ArrayList<>();
            for (int i=0;i<s.length();) {
                char c = s.charAt(i);
                if (Character.isDigit(c) || c=='.') {
                    int j=i+1; while (j<s.length() && (Character.isDigit(s.charAt(j))||s.charAt(j)=='.')) j++;
                    out.add(s.substring(i,j)); i=j;
                } else if ("+-*/()".indexOf(c)>=0) {
                    out.add(String.valueOf(c)); i++;
                } else if (s.startsWith("min(", i) || s.startsWith("max(", i)) {
                    out.add(s.substring(i, i+3)); i+=3;
                } else if (s.startsWith("if(", i)) { // special parse: if(cond,a,b)
                    int end = findMatchingParen(s, i+2);
                    String inside = s.substring(i+3, end); // cond,a,b
                    String[] parts = splitTopLevel(inside);
                    out.add("("); // push true expr
                    out.addAll(tokenize(parts[1]));
                    out.add(")");
                    out.add("("); // push false expr
                    out.addAll(tokenize(parts[2]));
                    out.add(")");
                    // condition stored as a single token
                    out.add("if[" + parts[0] + "]");
                    i = end+1;
                } else if (s.charAt(i)==',') { out.add(","); i++; }
                else { throw new IllegalArgumentException("Bad char: "+c); }
            }
            return out;
        }

        private int findMatchingParen(String s, int startIdx) {
            int depth=1;
            for (int i=startIdx+1;i<s.length();i++){
                char c=s.charAt(i);
                if (c=='(') depth++; else if (c==')') depth--;
                if (depth==0) return i;
            }
            throw new IllegalArgumentException("Unbalanced if()");
        }

        private String[] splitTopLevel(String s) {
            int depth=0; List<Integer> commas=new ArrayList<>();
            for (int i=0;i<s.length();i++){
                char c=s.charAt(i);
                if (c=='(') depth++; else if (c==')') depth--;
                else if (c==',' && depth==0) commas.add(i);
            }
            if (commas.size()!=2) throw new IllegalArgumentException("if() expects cond,a,b");
            return new String[]{
                    s.substring(0,commas.get(0)),
                    s.substring(commas.get(0)+1, commas.get(1)),
                    s.substring(commas.get(1)+1)
            };
        }

        private List<String> toRPN(List<String> tks) {
            List<String> out=new ArrayList<>(); Deque<String> ops=new ArrayDeque<>();
            Map<String,Integer> prec=Map.of("+",1,"-",1,"*",2,"/",2);
            for (int i=0;i<tks.size();i++){
                String t=tks.get(i);
                if (t.matches("\\d+(\\.\\d+)?")) out.add(t);
                else if ("min".equals(t)||"max".equals(t)) ops.push(t);
                else if (t.equals(",")) { while(!ops.isEmpty() && !ops.peek().equals("(")) out.add(ops.pop()); }
                else if (t.equals("(")) ops.push(t);
                else if (t.equals(")")) { while(!ops.isEmpty() && !ops.peek().equals("(")) out.add(ops.pop()); ops.pop(); if(!ops.isEmpty()&&("min".equals(ops.peek())||"max".equals(ops.peek()))) out.add(ops.pop()); }
                else if (prec.containsKey(t)) {
                    while(!ops.isEmpty() && prec.containsKey(ops.peek()) && prec.get(ops.peek())>=prec.get(t)) out.add(ops.pop());
                    ops.push(t);
                } else if (t.startsWith("if[")) { out.add(t); }
                else throw new IllegalArgumentException("Token "+t);
            }
            while(!ops.isEmpty()) out.add(ops.pop());
            return out;
        }
    }
}
