package com.configcenter.backend.common.api;

import com.configcenter.backend.common.context.RequestContextHolder;

public record ApiResponse<T>(String code, String message, String traceId, T data) {

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>("OK", "success", RequestContextHolder.currentTraceId(), data);
    }

    public static <T> ApiResponse<T> failure(String code, String message, T data) {
        return new ApiResponse<>(code, message, RequestContextHolder.currentTraceId(), data);
    }
}
