package com.configcenter.backend.module.control.page;

import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface PageResourceMapper {

    List<Map<String, Object>> selectPageResources(
            @Param("keyword") String keyword,
            @Param("status") String status,
            @Param("ownerOrgId") String ownerOrgId
    );

    Map<String, Object> selectPageResourceById(@Param("pageId") Long pageId);
}
