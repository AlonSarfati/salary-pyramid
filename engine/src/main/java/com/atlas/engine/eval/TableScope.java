package com.atlas.engine.eval;

public final class TableScope {
    private TableScope() {}
    public record Scope(String tenantId, String componentTarget) {}
    private static final ThreadLocal<Scope> TL = new ThreadLocal<>();

    public static void enter(String tenantId, String componentTarget) { TL.set(new Scope(tenantId, componentTarget)); }
    public static void exit() { TL.remove(); }
    public static Scope current() {
        Scope s = TL.get();
        if (s == null) throw new IllegalStateException("No TableScope active");
        return s;
    }
}
