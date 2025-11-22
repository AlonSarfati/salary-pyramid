package com.atlas.engine.eval;

import com.atlas.engine.model.Trace;
import com.atlas.engine.spi.TableService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class RegexTableCallResolver implements TableCallResolver {

    // Matches: TBL("Name", arg1, arg2, ..., [date])
    private static final Pattern TBL_CALL =
            Pattern.compile("TBL\\(\\s*\"([^\"]+)\"\\s*(,\\s*[^\\)]*)?\\)");

    private final TableService tables;

    public RegexTableCallResolver(TableService tables) {
        this.tables = tables;
    }

    @Override
    public String resolve(String expression,
                          Map<String, Object> vars,
                          LocalDate defaultDate,
                          String tenantId,
                          String componentTarget,
                          Trace trace) {

        StringBuffer out = new StringBuffer();
        Matcher m = TBL_CALL.matcher(expression);

        while (m.find()) {
            String tableName = m.group(1);
            String argsStr = m.group(2); // includes leading comma or null

            List<Object> args = parseArgs(argsStr, vars);

            // last arg may be a date literal / variable
            LocalDate date = defaultDate;
            if (!args.isEmpty() && args.get(args.size() - 1) instanceof LocalDate ld) {
                date = ld;
                args = args.subList(0, args.size() - 1);
            }

            // lookup in TableService
            var val = tables.lookup(tenantId, componentTarget, tableName, args, date);

            // trace
            trace.step("TBL(\"" + tableName + "\"," + prettyArgs(args)
                    + (date != null ? "," + date : "") + ") = " + val);

            // replace call with numeric literal
            m.appendReplacement(out, Matcher.quoteReplacement(val.toPlainString()));
        }

        m.appendTail(out);
        return out.toString();
    }

    // ---------- helpers (same logic you already had) ----------

    private static List<Object> parseArgs(String argsStr, Map<String, Object> vars) {
        List<Object> out = new ArrayList<>();
        if (argsStr == null || argsStr.isBlank()) return out;

        // drop leading comma
        String s = argsStr.substring(argsStr.indexOf(',') + 1).trim();

        int n = s.length();
        int depth = 0;
        boolean inStr = false;
        StringBuilder tok = new StringBuilder();

        for (int i = 0; i < n; i++) {
            char c = s.charAt(i);
            if (c == '"') {
                inStr = !inStr;
                tok.append(c);
                continue;
            }
            if (!inStr) {
                if (c == '{' || c == '[') depth++;
                else if (c == '}' || c == ']') depth--;
                else if (c == ',' && depth == 0) {
                    addArg(out, tok.toString().trim(), vars);
                    tok.setLength(0);
                    continue;
                }
            }
            tok.append(c);
        }
        if (tok.length() > 0) addArg(out, tok.toString().trim(), vars);
        return out;
    }

    private static void addArg(List<Object> out, String token, Map<String, Object> vars) {
        if (token.isEmpty()) return;

        // string literal
        if (token.startsWith("\"") && token.endsWith("\"")) {
            out.add(token.substring(1, token.length() - 1));
            return;
        }
        // LocalDate literal: ISO yyyy-MM-dd
        if (token.matches("\\d{4}-\\d{2}-\\d{2}")) {
            out.add(LocalDate.parse(token));
            return;
        }
        // number literal
        if (token.matches("[-+]?\\d+(\\.\\d+)?")) {
            out.add(new BigDecimal(token));
            return;
        }
        // variable name -> look up in vars
        // If variable not found, default to BigDecimal.ZERO (for numeric) or empty string (for string)
        Object v = vars.get(token);
        if (v == null) {
            // Default to zero for missing variables
            out.add(BigDecimal.ZERO);
            return;
        }

        // allow "2025-11-01" string as LocalDate
        if (v instanceof String s && s.matches("\\d{4}-\\d{2}-\\d{2}")) {
            out.add(LocalDate.parse(s));
        } else {
            out.add(v);
        }
    }

    private static String prettyArgs(List<Object> args) {
        return String.join(",", args.stream().map(String::valueOf).toList());
    }
}
