package com.configcenter.backend.module.governance;

import com.configcenter.backend.common.api.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/governance")
public class GovernanceController {

    private final GovernanceService governanceService;

    public GovernanceController(GovernanceService governanceService) {
        this.governanceService = governanceService;
    }

    @GetMapping("/pending-summary")
    public ApiResponse<Map<String, Object>> pendingSummary() {
        return ApiResponse.success(governanceService.pendingSummary());
    }

    @GetMapping("/audit-logs")
    public ApiResponse<Map<String, Object>> auditLogs() {
        return ApiResponse.success(governanceService.auditLogs());
    }

    @GetMapping("/trigger-logs")
    public ApiResponse<Map<String, Object>> triggerLogs() {
        return ApiResponse.success(governanceService.triggerLogs());
    }

    @GetMapping("/execution-logs")
    public ApiResponse<Map<String, Object>> executionLogs() {
        return ApiResponse.success(governanceService.executionLogs());
    }

    @GetMapping("/metrics/overview")
    public ApiResponse<Map<String, Object>> metricsOverview() {
        return ApiResponse.success(governanceService.metricsOverview());
    }
}
