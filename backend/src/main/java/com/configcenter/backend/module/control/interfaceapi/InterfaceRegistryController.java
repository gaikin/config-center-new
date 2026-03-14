package com.configcenter.backend.module.control.interfaceapi;

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
@RequestMapping("/api/control/interfaces")
public class InterfaceRegistryController {

    private final InterfaceRegistryService interfaceRegistryService;

    public InterfaceRegistryController(InterfaceRegistryService interfaceRegistryService) {
        this.interfaceRegistryService = interfaceRegistryService;
    }

    @GetMapping
    public ApiResponse<PageResponse<Map<String, Object>>> listInterfaces(
            @RequestParam(defaultValue = "1") Long pageNo,
            @RequestParam(defaultValue = "20") Long pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String ownerOrgId
    ) {
        return ApiResponse.success(interfaceRegistryService.listInterfaces(pageNo, pageSize, keyword, status, ownerOrgId));
    }

    @GetMapping("/{interfaceId}")
    public ApiResponse<Map<String, Object>> getInterfaceDetail(@PathVariable Long interfaceId) {
        return ApiResponse.success(interfaceRegistryService.getInterfaceDetail(interfaceId));
    }

    @PostMapping
    public ApiResponse<Map<String, Object>> createInterface(@RequestBody Map<String, Object> body) {
        return ApiResponse.success(interfaceRegistryService.createInterface(body));
    }

    @PostMapping("/{interfaceId}/versions")
    public ApiResponse<Map<String, Object>> createVersion(@PathVariable Long interfaceId) {
        return ApiResponse.success(interfaceRegistryService.createVersion(interfaceId));
    }

    @PutMapping("/{interfaceId}/versions/{versionId}")
    public ApiResponse<Map<String, Object>> updateVersion(
            @PathVariable Long interfaceId,
            @PathVariable Long versionId,
            @RequestBody Map<String, Object> body
    ) {
        return ApiResponse.success(interfaceRegistryService.updateVersion(interfaceId, versionId, body));
    }
}
