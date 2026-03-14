package com.configcenter.backend.module.control.interfaceapi;

import com.configcenter.backend.common.api.PageResponse;
import com.configcenter.backend.common.support.DemoDataFactory;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class InterfaceRegistryService {

    private final InterfaceRegistryMapper interfaceRegistryMapper;

    public InterfaceRegistryService(InterfaceRegistryMapper interfaceRegistryMapper) {
        this.interfaceRegistryMapper = interfaceRegistryMapper;
    }

    public PageResponse<Map<String, Object>> listInterfaces(
            Long pageNo,
            Long pageSize,
            String keyword,
            String status,
            String ownerOrgId
    ) {
        return DemoDataFactory.interfaceDefinitions();
    }

    public Map<String, Object> getInterfaceDetail(Long interfaceId) {
        return DemoDataFactory.interfaceDetail(interfaceId);
    }

    public Map<String, Object> createInterface(Map<String, Object> body) {
        return DemoDataFactory.createdInterface(body);
    }

    public Map<String, Object> createVersion(Long interfaceId) {
        return Map.of(
                "id", 2001L,
                "interfaceId", interfaceId,
                "versionNo", 2,
                "status", "DRAFT"
        );
    }

    public Map<String, Object> updateVersion(Long interfaceId, Long versionId, Map<String, Object> body) {
        return DemoDataFactory.updatedInterfaceVersion(interfaceId, versionId, body);
    }
}
