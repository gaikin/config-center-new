package com.configcenter.backend.module.control.rule;

import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface RuleMapper {

    List<Map<String, Object>> selectRules(
            @Param("keyword") String keyword,
            @Param("status") String status,
            @Param("ownerOrgId") String ownerOrgId
    );

    Map<String, Object> selectRuleById(@Param("ruleId") Long ruleId);
}
