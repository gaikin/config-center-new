package com.configcenter.backend.module.runtime.snapshot;

import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface RuntimeSnapshotMapper {

    Map<String, Object> selectRuntimeBundle(@Param("pageId") Long pageId);
}
