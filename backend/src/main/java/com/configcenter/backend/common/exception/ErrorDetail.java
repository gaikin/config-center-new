package com.configcenter.backend.common.exception;

public record ErrorDetail(String type, String target, String reason) {
}
