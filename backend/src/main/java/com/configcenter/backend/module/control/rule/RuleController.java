package com.configcenter.backend.module.control.rule;

import com.configcenter.backend.common.api.ApiResponse;
import com.configcenter.backend.common.api.PageResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/control/rules")
public class RuleController {

    private final RuleService ruleService;

    public RuleController(RuleService ruleService) {
        this.ruleService = ruleService;
    }

    @GetMapping
    public ApiResponse<PageResponse<Map<String, Object>>> listRules(
            @RequestParam(defaultValue = "1") Long pageNo,
            @RequestParam(defaultValue = "20") Long pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String ownerOrgId
    ) {
        return ApiResponse.success(ruleService.listRules(pageNo, pageSize, keyword, status, ownerOrgId));
    }

    @GetMapping("/{ruleId}")
    public ApiResponse<Map<String, Object>> getRuleDetail(@PathVariable Long ruleId) {
        return ApiResponse.success(ruleService.getRuleDetail(ruleId));
    }

    @PostMapping
    public ApiResponse<Map<String, Object>> createRule(@RequestBody Map<String, Object> body) {
        return ApiResponse.success(ruleService.createRule(body));
    }

    @PostMapping("/{ruleId}/versions")
    public ApiResponse<Map<String, Object>> createRuleVersion(@PathVariable Long ruleId) {
        return ApiResponse.success(ruleService.createRuleVersion(ruleId));
    }

    @PutMapping("/{ruleId}/versions/{versionId}")
    public ApiResponse<Map<String, Object>> updateRuleVersion(
            @PathVariable Long ruleId,
            @PathVariable Long versionId,
            @RequestBody Map<String, Object> body
    ) {
        return ApiResponse.success(ruleService.updateRuleVersion(ruleId, versionId, body));
    }

    @PostMapping("/{ruleId}/versions/{versionId}/preview")
    public ApiResponse<Map<String, Object>> previewRule(
            @PathVariable Long ruleId,
            @PathVariable Long versionId,
            @RequestBody Map<String, Object> body
    ) {
        return ApiResponse.success(ruleService.previewRule(ruleId, versionId, body));
    }
}
