package com.atlas.engine.model;

import java.util.LinkedList;
import java.util.List;

public class Trace {
    private final String component;
    private final List<String> steps = new LinkedList<>();
    private String finalLine;

    public Trace(String component) { this.component = component; }
    public void step(String s) { steps.add(s); }
    public void done(String s) { this.finalLine = s; }
    public String component() { return component; }
    public List<String> steps() { return List.copyOf(steps); }
    public String finalLine() { return finalLine; }

    @Override public String toString() {
        StringBuilder sb = new StringBuilder(component).append(":\n");
        for (String s : steps) sb.append("  ").append(s).append("\n");
        if (finalLine != null) sb.append("  = ").append(finalLine);
        return sb.toString();
    }
}
