package com.configcenter.backend.module.runtime.context;

import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface PageContextMapper {

    Map<String, Object> selectPageContext(
            @Param("siteCode") String siteCode,
            @Param("menuCode") String menuCode,
            @Param("url") String url
    );
}
