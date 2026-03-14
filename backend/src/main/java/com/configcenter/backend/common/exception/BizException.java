package com.configcenter.backend.common.exception;

import java.util.List;

public class BizException extends RuntimeException {

    private final String code;
    private final int status;
    private final List<ErrorDetail> details;

    public BizException(String code, String message, int status) {
        this(code, message, status, List.of());
    }

    public BizException(String code, String message, int status, List<ErrorDetail> details) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details;
    }

    public String getCode() {
        return code;
    }

    public int getStatus() {
        return status;
    }

    public List<ErrorDetail> getDetails() {
        return details;
    }
}
