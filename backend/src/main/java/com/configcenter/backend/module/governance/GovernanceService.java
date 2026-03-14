package com.configcenter.backend.module.governance;

import com.configcenter.backend.common.support.DemoDataFactory;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class GovernanceService {

    public Map<String, Object> pendingSummary() {
        return DemoDataFactory.pendingSummary();
    }

    public Map<String, Object> auditLogs() {
        return DemoDataFactory.auditLogs();
    }

    public Map<String, Object> triggerLogs() {
        return DemoDataFactory.triggerLogs();
    }

    public Map<String, Object> executionLogs() {
        return DemoDataFactory.executionLogs();
    }

    public Map<String, Object> metricsOverview() {
        return DemoDataFactory.metricsOverview();
    }
}
