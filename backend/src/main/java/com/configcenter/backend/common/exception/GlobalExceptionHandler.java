package com.configcenter.backend.common.exception;

import com.configcenter.backend.common.api.ApiResponse;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BizException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleBizException(BizException exception) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("details", exception.getDetails());
        return ResponseEntity.status(exception.getStatus())
                .body(ApiResponse.failure(exception.getCode(), exception.getMessage(), data));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleValidationException(
            MethodArgumentNotValidException exception
    ) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("details", exception.getBindingResult().getFieldErrors().stream()
                .map(error -> new ErrorDetail("FIELD_ERROR", error.getField(), error.getDefaultMessage()))
                .toList());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.failure("VALIDATION_ERROR", "Request validation failed", data));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleUnexpectedException(Exception exception) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("details", java.util.List.of());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.failure("INTERNAL_SERVER_ERROR", exception.getMessage(), data));
    }
}
