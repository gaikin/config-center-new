package com.configcenter.backend.module.control.rule;

import com.configcenter.backend.common.api.PageResponse;
import com.configcenter.backend.common.support.DemoDataFactory;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class RuleService {

    private final RuleMapper ruleMapper;

    public RuleService(RuleMapper ruleMapper) {
        this.ruleMapper = ruleMapper;
    }

    public PageResponse<Map<String, Object>> listRules(
            Long pageNo,
            Long pageSize,
            String keyword,
            String status,
            String ownerOrgId
    ) {
        return DemoDataFactory.rules();
    }

    public Map<String, Object> getRuleDetail(Long ruleId) {
        return DemoDataFactory.ruleDetail(ruleId);
    }

    public Map<String, Object> createRule(Map<String, Object> body) {
        return DemoDataFactory.createdRule(body);
    }

    public Map<String, Object> createRuleVersion(Long ruleId) {
        return Map.of(
                "id", 3001L,
                "ruleId", ruleId,
                "versionNo", 2,
                "status", "DRAFT"
        );
    }

    public Map<String, Object> updateRuleVersion(Long ruleId, Long versionId, Map<String, Object> body) {
        return DemoDataFactory.updatedRuleVersion(ruleId, versionId, body);
    }

    public Map<String, Object> previewRule(Long ruleId, Long versionId, Map<String, Object> body) {
        return DemoDataFactory.previewRule(ruleId, versionId, body);
    }
}
