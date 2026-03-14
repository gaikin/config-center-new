package com.configcenter.backend.common.support;

import com.configcenter.backend.common.api.PageResponse;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class DemoDataFactory {

    private DemoDataFactory() {
    }

    public static List<Map<String, Object>> pageSites() {
        return List.of(linkedMap(
                "id", 1L,
                "siteCode", "crm",
                "name", "CRM",
                "status", "ACTIVE"
        ));
    }

    public static List<Map<String, Object>> pageMenus() {
        return List.of(linkedMap(
                "id", 1L,
                "siteId", 1L,
                "menuCode", "loan-apply",
                "menuName", "Loan Apply",
                "status", "ACTIVE",
                "urlPattern", "/loan/apply"
        ));
    }

    public static PageResponse<Map<String, Object>> pageResources() {
        return new PageResponse<>(1, 1, 20, List.of(linkedMap(
                "id", 100L,
                "pageName", "Loan Apply Page",
                "pageCode", "loan.apply.page",
                "ownerOrgId", "org.demo",
                "status", "ACTIVE",
                "currentVersionId", 1000L
        )));
    }

    public static Map<String, Object> pageResourceDetail(Long pageId) {
        return linkedMap(
                "id", pageId,
                "pageName", "Loan Apply Page",
                "pageCode", "loan.apply.page",
                "ownerOrgId", "org.demo",
                "status", "ACTIVE",
                "currentVersionId", 1000L,
                "versions", List.of(linkedMap(
                        "id", 1000L,
                        "versionNo", 1,
                        "status", "ACTIVE"
                ))
        );
    }

    public static Map<String, Object> createdPageResource(Map<String, Object> body) {
        return linkedMap(
                "id", 101L,
                "pageName", body.getOrDefault("pageName", "New Page"),
                "pageCode", body.getOrDefault("pageCode", "page.101"),
                "status", "DRAFT",
                "currentVersionId", 1001L
        );
    }

    public static Map<String, Object> createdVersion(Long resourceId) {
        return linkedMap(
                "id", 1001L,
                "pageResourceId", resourceId,
                "versionNo", 2,
                "status", "DRAFT"
        );
    }

    public static Map<String, Object> updatedVersion(Long resourceId, Long versionId, Map<String, Object> body) {
        return linkedMap(
                "id", versionId,
                "pageResourceId", resourceId,
                "status", "DRAFT",
                "content", body
        );
    }

    public static PageResponse<Map<String, Object>> interfaceDefinitions() {
        return new PageResponse<>(1, 1, 20, List.of(linkedMap(
                "id", 200L,
                "name", "Customer Profile API",
                "method", "POST",
                "path", "/internal/customer/profile",
                "ownerOrgId", "org.demo",
                "status", "ACTIVE",
                "currentVersionId", 2000L
        )));
    }

    public static Map<String, Object> interfaceDetail(Long interfaceId) {
        return linkedMap(
                "id", interfaceId,
                "name", "Customer Profile API",
                "method", "POST",
                "path", "/internal/customer/profile",
                "ownerOrgId", "org.demo",
                "status", "ACTIVE",
                "versions", List.of(linkedMap(
                        "id", 2000L,
                        "versionNo", 1,
                        "status", "ACTIVE"
                ))
        );
    }

    public static Map<String, Object> createdInterface(Map<String, Object> body) {
        return linkedMap(
                "id", 201L,
                "name", body.getOrDefault("name", "New Interface"),
                "method", body.getOrDefault("method", "POST"),
                "path", body.getOrDefault("path", "/api/demo"),
                "status", "DRAFT",
                "currentVersionId", 2001L
        );
    }

    public static Map<String, Object> updatedInterfaceVersion(Long interfaceId, Long versionId, Map<String, Object> body) {
        return linkedMap(
                "id", versionId,
                "interfaceId", interfaceId,
                "status", "DRAFT",
                "content", body
        );
    }

    public static PageResponse<Map<String, Object>> rules() {
        return new PageResponse<>(1, 1, 20, List.of(linkedMap(
                "id", 300L,
                "ruleName", "Large Amount Prompt",
                "pageResourceId", 100L,
                "ownerOrgId", "org.demo",
                "status", "ACTIVE",
                "currentVersionId", 3000L
        )));
    }

    public static Map<String, Object> ruleDetail(Long ruleId) {
        return linkedMap(
                "id", ruleId,
                "ruleName", "Large Amount Prompt",
                "pageResourceId", 100L,
                "ownerOrgId", "org.demo",
                "status", "ACTIVE",
                "versions", List.of(linkedMap(
                        "id", 3000L,
                        "versionNo", 1,
                        "status", "ACTIVE"
                ))
        );
    }

    public static Map<String, Object> createdRule(Map<String, Object> body) {
        return linkedMap(
                "id", 301L,
                "ruleName", body.getOrDefault("ruleName", "New Rule"),
                "status", "DRAFT",
                "currentVersionId", 3001L
        );
    }

    public static Map<String, Object> updatedRuleVersion(Long ruleId, Long versionId, Map<String, Object> body) {
        return linkedMap(
                "id", versionId,
                "ruleId", ruleId,
                "status", "DRAFT",
                "content", body
        );
    }

    public static Map<String, Object> previewRule(Long ruleId, Long versionId, Map<String, Object> body) {
        Map<String, Object> fieldValues = castMap(body.get("fieldValues"));
        Object amountValue = fieldValues.getOrDefault("loanAmount", 0);
        long amount = Long.parseLong(String.valueOf(amountValue));
        return linkedMap(
                "ruleId", ruleId,
                "versionId", versionId,
                "parsedConditionCount", 1,
                "matchedConditionCount", amount > 500000 ? 1 : 0,
                "matched", amount > 500000,
                "linkedSceneId", 9001L
        );
    }

    public static Map<String, Object> publishValidation(Map<String, Object> body) {
        List<Map<String, Object>> items = new ArrayList<>();
        if (!body.containsKey("resourceId")) {
            items.add(linkedMap(
                    "type", "RESOURCE_ID_MISSING",
                    "target", "resourceId",
                    "reason", "resourceId is required"
            ));
        }
        if (!body.containsKey("versionId")) {
            items.add(linkedMap(
                    "type", "VERSION_ID_MISSING",
                    "target", "versionId",
                    "reason", "versionId is required"
            ));
        }
        return linkedMap(
                "pass", items.isEmpty(),
                "items", items
        );
    }

    public static Map<String, Object> publishTask(Map<String, Object> body) {
        return linkedMap(
                "id", 4001L,
                "resourceType", body.getOrDefault("resourceType", "PAGE_RESOURCE"),
                "resourceId", body.getOrDefault("resourceId", 100L),
                "versionId", body.getOrDefault("versionId", 1000L),
                "status", "SUCCEEDED",
                "publishType", body.getOrDefault("publishType", "IMMEDIATE")
        );
    }

    public static Map<String, Object> publishTaskDetail(Long taskId) {
        return linkedMap(
                "id", taskId,
                "resourceType", "PAGE_RESOURCE",
                "resourceId", 100L,
                "versionId", 1000L,
                "status", "SUCCEEDED"
        );
    }

    public static Map<String, Object> resolvedPageContext(Map<String, Object> body) {
        return linkedMap(
                "pageId", 100L,
                "pageVersionId", 1000L,
                "matchedBy", body.containsKey("menuCode") ? "MENU" : "URL",
                "bundleVersion", "1000-" + OffsetDateTime.now()
        );
    }

    public static Map<String, Object> runtimeBundle(Long pageId) {
        return linkedMap(
                "manifest", linkedMap(
                        "pageId", pageId,
                        "pageVersionId", 1000L,
                        "snapshotVersion", "snapshot-1"
                ),
                "pageConfig", linkedMap(
                        "pageTitle", "Loan Apply",
                        "urlPattern", "/loan/apply"
                ),
                "ruleConfigs", List.of(linkedMap(
                        "ruleId", 300L,
                        "ruleName", "Large Amount Prompt"
                )),
                "interfaceConfigs", List.of(linkedMap(
                        "interfaceId", 200L,
                        "name", "Customer Profile API"
                ))
        );
    }

    public static Map<String, Object> pendingSummary() {
        return linkedMap(
                "draftCount", 3,
                "expiringSoonCount", 0,
                "validationFailedCount", 1,
                "conflictCount", 0,
                "riskConfirmPendingCount", 0
        );
    }

    public static Map<String, Object> auditLogs() {
        return linkedMap(
                "total", 1,
                "records", List.of(linkedMap(
                        "id", 1L,
                        "action", "PUBLISH",
                        "resourceType", "PAGE_RESOURCE",
                        "operator", "system.demo"
                ))
        );
    }

    public static Map<String, Object> triggerLogs() {
        return linkedMap(
                "total", 1,
                "records", List.of(linkedMap(
                        "id", 1L,
                        "traceId", "trace-demo",
                        "eventType", "PAGE_RESOLVED"
                ))
        );
    }

    public static Map<String, Object> executionLogs() {
        return linkedMap(
                "total", 1,
                "records", List.of(linkedMap(
                        "executionId", 1L,
                        "sceneId", 9001L,
                        "status", "SUCCEEDED"
                ))
        );
    }

    public static Map<String, Object> metricsOverview() {
        return linkedMap(
                "executionSuccessRate", 1.0,
                "avgSavedSeconds", 0,
                "failureReasonTopN", List.of(),
                "expiredResourceCount", 0,
                "expiringSoonResourceCount", 0
        );
    }

    private static Map<String, Object> castMap(Object value) {
        if (value instanceof Map<?, ?> rawMap) {
            Map<String, Object> result = new LinkedHashMap<>();
            rawMap.forEach((key, mapValue) -> result.put(String.valueOf(key), mapValue));
            return result;
        }
        return Map.of();
    }

    private static Map<String, Object> linkedMap(Object... input) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int index = 0; index < input.length; index += 2) {
            map.put(String.valueOf(input[index]), input[index + 1]);
        }
        return map;
    }
}
