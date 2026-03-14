package com.configcenter.backend.module.control.page;

import com.configcenter.backend.common.api.ApiResponse;
import com.configcenter.backend.common.api.PageResponse;
import java.util.List;
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
@RequestMapping("/api/control")
public class PageResourceController {

    private final PageResourceService pageResourceService;

    public PageResourceController(PageResourceService pageResourceService) {
        this.pageResourceService = pageResourceService;
    }

    @GetMapping("/page-sites")
    public ApiResponse<List<Map<String, Object>>> listSites() {
        return ApiResponse.success(pageResourceService.listSites());
    }

    @GetMapping("/page-menus")
    public ApiResponse<List<Map<String, Object>>> listMenus() {
        return ApiResponse.success(pageResourceService.listMenus());
    }

    @GetMapping("/page-resources")
    public ApiResponse<PageResponse<Map<String, Object>>> listPageResources(
            @RequestParam(defaultValue = "1") Long pageNo,
            @RequestParam(defaultValue = "20") Long pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String ownerOrgId
    ) {
        return ApiResponse.success(pageResourceService.listPageResources(pageNo, pageSize, keyword, status, ownerOrgId));
    }

    @GetMapping("/page-resources/{pageId}")
    public ApiResponse<Map<String, Object>> getPageResourceDetail(@PathVariable Long pageId) {
        return ApiResponse.success(pageResourceService.getPageResourceDetail(pageId));
    }

    @PostMapping("/page-resources")
    public ApiResponse<Map<String, Object>> createPageResource(@RequestBody Map<String, Object> body) {
        return ApiResponse.success(pageResourceService.createPageResource(body));
    }

    @PostMapping("/page-resources/{pageId}/versions")
    public ApiResponse<Map<String, Object>> createPageResourceVersion(@PathVariable Long pageId) {
        return ApiResponse.success(pageResourceService.createPageResourceVersion(pageId));
    }

    @PutMapping("/page-resources/{pageId}/versions/{versionId}")
    public ApiResponse<Map<String, Object>> updatePageResourceVersion(
            @PathVariable Long pageId,
            @PathVariable Long versionId,
            @RequestBody Map<String, Object> body
    ) {
        return ApiResponse.success(pageResourceService.updatePageResourceVersion(pageId, versionId, body));
    }
}
