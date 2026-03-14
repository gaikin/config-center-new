package com.configcenter.backend.module.control.page;

import com.configcenter.backend.common.api.PageResponse;
import com.configcenter.backend.common.support.DemoDataFactory;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class PageResourceService {

    private final PageResourceMapper pageResourceMapper;

    public PageResourceService(PageResourceMapper pageResourceMapper) {
        this.pageResourceMapper = pageResourceMapper;
    }

    public List<Map<String, Object>> listSites() {
        return DemoDataFactory.pageSites();
    }

    public List<Map<String, Object>> listMenus() {
        return DemoDataFactory.pageMenus();
    }

    public PageResponse<Map<String, Object>> listPageResources(
            Long pageNo,
            Long pageSize,
            String keyword,
            String status,
            String ownerOrgId
    ) {
        return DemoDataFactory.pageResources();
    }

    public Map<String, Object> getPageResourceDetail(Long pageId) {
        return DemoDataFactory.pageResourceDetail(pageId);
    }

    public Map<String, Object> createPageResource(Map<String, Object> body) {
        return DemoDataFactory.createdPageResource(body);
    }

    public Map<String, Object> createPageResourceVersion(Long pageId) {
        return DemoDataFactory.createdVersion(pageId);
    }

    public Map<String, Object> updatePageResourceVersion(Long pageId, Long versionId, Map<String, Object> body) {
        return DemoDataFactory.updatedVersion(pageId, versionId, body);
    }
}
