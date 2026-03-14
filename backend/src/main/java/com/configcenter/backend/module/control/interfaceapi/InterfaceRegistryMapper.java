package com.configcenter.backend.module.control.interfaceapi;

import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface InterfaceRegistryMapper {

    List<Map<String, Object>> selectInterfaceDefinitions(
            @Param("keyword") String keyword,
            @Param("status") String status,
            @Param("ownerOrgId") String ownerOrgId
    );

    Map<String, Object> selectInterfaceDefinitionById(@Param("interfaceId") Long interfaceId);
}
