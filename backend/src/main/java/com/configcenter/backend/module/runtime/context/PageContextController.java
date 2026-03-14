package com.configcenter.backend.module.runtime.context;

import com.configcenter.backend.common.api.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/runtime/page-context")
public class PageContextController {

    private final PageContextService pageContextService;

    public PageContextController(PageContextService pageContextService) {
        this.pageContextService = pageContextService;
    }

    @PostMapping("/resolve")
    public ApiResponse<Map<String, Object>> resolve(@RequestBody Map<String, Object> body) {
        return ApiResponse.success(pageContextService.resolve(body));
    }
}
