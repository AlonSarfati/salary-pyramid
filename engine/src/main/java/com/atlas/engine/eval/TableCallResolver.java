package com.atlas.engine.eval;

import com.atlas.engine.model.Trace;

import java.time.LocalDate;
import java.util.Map;

@FunctionalInterface
public interface TableCallResolver {

    /**
     * Rewrites an expression, replacing any TBL("...", ...) calls with numeric literals
     * based on the current variables / date / tenant / component.
     */
    String resolve(String expression,
                   Map<String, Object> vars,
                   LocalDate defaultDate,
                   String tenantId,
                   String componentTarget,
                   Trace trace);
}
