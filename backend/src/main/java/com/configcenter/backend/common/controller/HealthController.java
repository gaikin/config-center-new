package com.configcenter.backend.common.controller;

import com.configcenter.backend.common.api.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    @GetMapping("/healthz")
    public ApiResponse<Map<String, Object>> health() {
        return ApiResponse.success(Map.of(
                "service", "config-center-backend",
                "status", "UP"
        ));
    }
}
