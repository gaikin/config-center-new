package com.configcenter.backend.common.context;

import java.util.List;

public final class RequestContextHolder {

    private static final ThreadLocal<RequestContext> HOLDER = new ThreadLocal<>();

    private RequestContextHolder() {
    }

    public static void set(RequestContext context) {
        HOLDER.set(context);
    }

    public static RequestContext get() {
        return HOLDER.get();
    }

    public static String currentTraceId() {
        RequestContext context = HOLDER.get();
        return context == null ? "trace-missing" : context.traceId();
    }

    public static List<String> currentRoleIds() {
        RequestContext context = HOLDER.get();
        return context == null ? List.of() : context.roleIds();
    }

    public static void clear() {
        HOLDER.remove();
    }
}
