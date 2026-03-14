package com.configcenter.backend.module.runtime.snapshot;

import com.configcenter.backend.common.api.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/runtime/pages")
public class SnapshotController {

    private final SnapshotService snapshotService;

    public SnapshotController(SnapshotService snapshotService) {
        this.snapshotService = snapshotService;
    }

    @GetMapping("/{pageId}/bundle")
    public ApiResponse<Map<String, Object>> getBundle(@PathVariable Long pageId) {
        return ApiResponse.success(snapshotService.getBundle(pageId));
    }
}
