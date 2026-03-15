# 营小助配置中心 TDSQL DDL 草案（Draft）

> 来源文档：`spec/config-center-product/architecture.md`、`spec/config-center-product/api-design.md`  
> 数据库基线：`TDSQL`（默认按 `TDSQL-MySQL 8.0` 兼容版设计）  
> 文档目标：给出核心表结构、主键策略、索引策略和建库约束，作为后续 DBA/后端评审初稿  
> 更新日期：2026-03-12

## 1. 适用范围与假设

本文默认以下前提：

1. 数据库为 `TDSQL-MySQL` 兼容版。
2. 字符集统一为 `utf8mb4`。
3. 主键统一使用 `BIGINT AUTO_INCREMENT`，简化当前单库或普通集群场景下的建表、排障和运维。
4. 当前按单库或普通集群场景设计；表间关系按标准关系型建模，是否补充外键由建库评审按表稳定性和变更频率确定。
5. 状态值、执行方式、提示方式等枚举采用英文常量存储，前端展示再映射中文。
6. 所有表默认包含审计字段与软删除字段。

若实际数据库为 `TDSQL-PG`，则需要调整 DDL 语法，但对象模型、索引思路和表间关系基本保持不变。

## 2. 建模约定

### 2.1 通用字段约定

所有核心业务表默认包含：

1. `id BIGINT NOT NULL AUTO_INCREMENT`
2. `created_at DATETIME(3) NOT NULL`
3. `created_by VARCHAR(64) NOT NULL`
4. `updated_at DATETIME(3) NOT NULL`
5. `updated_by VARCHAR(64) NOT NULL`
6. `is_deleted TINYINT(1) NOT NULL DEFAULT 0`

### 2.2 状态值约定

1. 生命周期状态：`DRAFT`、`ACTIVE`、`DISABLED`、`EXPIRED`
2. 执行方式：`AUTO_WITHOUT_PROMPT`、`AUTO_AFTER_PROMPT`、`PREVIEW_THEN_EXECUTE`、`FLOATING_BUTTON`
3. 提示方式：`SILENT`、`FLOATING`
4. 提示关闭方式：`AUTO_CLOSE`、`MANUAL_CLOSE`、`TIMER_THEN_MANUAL`

### 2.3 索引约定

1. 逻辑唯一键默认带上 `is_deleted`，便于软删除后重建同名对象。
2. 列表页常用过滤字段优先组合 `status + owner_org_id + updated_at`。
3. 日志表优先保障 `trace_id`、`resource_version_id`、`created_at` 查询性能。
4. 指标表按 `stat_date + org_id + menu_id` 建唯一键。

## 3. 初始化建议

```sql
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
```

## 4. 公共支撑层 DDL

### 4.1 页面资源相关表

```sql
CREATE TABLE page_site (
  id BIGINT NOT NULL AUTO_INCREMENT,
  site_code VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  remark VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_page_site_code_del (site_code, is_deleted),
  KEY idx_page_site_status_updated (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='业务站点定义';

CREATE TABLE page_menu (
  id BIGINT NOT NULL AUTO_INCREMENT,
  site_id BIGINT NOT NULL,
  zone_name VARCHAR(128) NOT NULL,
  menu_name VARCHAR(128) NOT NULL,
  menu_code VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_page_menu_code_del (menu_code, is_deleted),
  KEY idx_page_menu_site_org (site_id, owner_org_id),
  KEY idx_page_menu_status_updated (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='专区与业务菜单';

CREATE TABLE page_resource (
  id BIGINT NOT NULL AUTO_INCREMENT,
  menu_id BIGINT NOT NULL,
  name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  current_version_id BIGINT NULL,
  remark VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_page_resource_name_org_del (name, owner_org_id, is_deleted),
  KEY idx_page_resource_menu (menu_id),
  KEY idx_page_resource_status_org (status, owner_org_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='页面资源主表';

CREATE TABLE page_resource_version (
  id BIGINT NOT NULL AUTO_INCREMENT,
  page_resource_id BIGINT NOT NULL,
  version_no INT NOT NULL,
  state VARCHAR(32) NOT NULL,
  detect_rules JSON NOT NULL,
  effective_start_at DATETIME(3) NULL,
  effective_end_at DATETIME(3) NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  owner_user_id VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_page_resource_ver_del (page_resource_id, version_no, is_deleted),
  KEY idx_page_resource_ver_state (state, owner_org_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='页面资源版本表';

CREATE TABLE page_element (
  id BIGINT NOT NULL AUTO_INCREMENT,
  page_resource_version_id BIGINT NOT NULL,
  logic_name VARCHAR(128) NOT NULL,
  selector_type VARCHAR(32) NOT NULL,
  selector_expr VARCHAR(1024) NOT NULL,
  field_type VARCHAR(32) NULL,
  is_required TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_page_element_logic_del (page_resource_version_id, logic_name, is_deleted),
  KEY idx_page_element_version (page_resource_version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='页面元素与逻辑名映射';
```

### 4.2A 名单数据相关表

```sql
CREATE TABLE list_data (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  current_version_id BIGINT NULL,
  remark VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_list_data_name_org_del (name, owner_org_id, is_deleted),
  KEY idx_list_data_status_org (status, owner_org_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='名单数据主表';

CREATE TABLE list_data_version (
  id BIGINT NOT NULL AUTO_INCREMENT,
  list_data_id BIGINT NOT NULL,
  version_no INT NOT NULL,
  state VARCHAR(32) NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  owner_user_id VARCHAR(64) NOT NULL,
  effective_start_at DATETIME(3) NULL,
  effective_end_at DATETIME(3) NULL,
  import_file_token VARCHAR(255) NOT NULL,
  import_file_name VARCHAR(255) NOT NULL,
  primary_match_column VARCHAR(128) NOT NULL,
  row_count INT NOT NULL DEFAULT 0,
  parse_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  index_build_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  physical_index_name VARCHAR(255) NULL,
  active_alias_name VARCHAR(255) NULL,
  parse_summary JSON NULL,
  index_started_at DATETIME(3) NULL,
  index_finished_at DATETIME(3) NULL,
  current_build_job_id BIGINT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_list_data_ver_del (list_data_id, version_no, is_deleted),
  KEY idx_list_data_ver_state_org (state, owner_org_id, updated_at),
  KEY idx_list_data_ver_build (index_build_status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='名单数据版本表';

CREATE TABLE list_data_index_job (
  id BIGINT NOT NULL AUTO_INCREMENT,
  list_data_version_id BIGINT NOT NULL,
  build_mode VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  physical_index_name VARCHAR(255) NOT NULL,
  source_file_token VARCHAR(255) NOT NULL,
  source_row_count INT NOT NULL DEFAULT 0,
  indexed_row_count INT NOT NULL DEFAULT 0,
  failed_row_count INT NOT NULL DEFAULT 0,
  error_message VARCHAR(1024) NULL,
  started_at DATETIME(3) NULL,
  finished_at DATETIME(3) NULL,
  operator_id VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_list_index_job_ver (list_data_version_id, created_at),
  KEY idx_list_index_job_status (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='名单 ES 建索引任务表';
```

说明：

1. `list_data` 与 `list_data_version` 只保存发布控制元数据，不保存名单明细行。
2. `physical_index_name` 与 `active_alias_name` 作为技术元数据入库，便于发布、回滚和排障。
3. 若后续需要更细的发布补偿记录，可在状态变更日志之外补充单独的别名切换流水表。

### 4.2B 接口与预处理器相关表

```sql
CREATE TABLE interface_definition (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  current_version_id BIGINT NULL,
  remark VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_interface_name_org_del (name, owner_org_id, is_deleted),
  KEY idx_interface_status_org (status, owner_org_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='接口定义主表';

CREATE TABLE interface_version (
  id BIGINT NOT NULL AUTO_INCREMENT,
  interface_definition_id BIGINT NOT NULL,
  version_no INT NOT NULL,
  state VARCHAR(32) NOT NULL,
  http_method VARCHAR(16) NOT NULL,
  request_url VARCHAR(1024) NOT NULL,
  timeout_ms INT NOT NULL DEFAULT 3000,
  retry_times INT NOT NULL DEFAULT 0,
  response_mapping JSON NOT NULL,
  mask_fields JSON NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_interface_ver_del (interface_definition_id, version_no, is_deleted),
  KEY idx_interface_ver_state (state, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='接口版本表';

CREATE TABLE interface_param (
  id BIGINT NOT NULL AUTO_INCREMENT,
  interface_version_id BIGINT NOT NULL,
  param_name VARCHAR(128) NOT NULL,
  source_type VARCHAR(32) NOT NULL,
  source_ref VARCHAR(255) NULL,
  is_required TINYINT(1) NOT NULL DEFAULT 0,
  value_type VARCHAR(32) NOT NULL,
  default_value VARCHAR(1024) NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_interface_param_del (interface_version_id, param_name, is_deleted),
  KEY idx_interface_param_version (interface_version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='接口参数来源配置';

CREATE TABLE preprocessor_definition (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  processor_type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  is_script TINYINT(1) NOT NULL DEFAULT 0,
  config_json JSON NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_preprocessor_name_org_del (name, owner_org_id, is_deleted),
  KEY idx_preprocessor_status_org (status, owner_org_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预处理器定义';

CREATE TABLE resource_share_record (
  id BIGINT NOT NULL AUTO_INCREMENT,
  resource_type VARCHAR(32) NOT NULL,
  resource_id BIGINT NOT NULL,
  share_mode VARCHAR(32) NOT NULL,
  source_org_id VARCHAR(64) NOT NULL,
  target_org_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_share_resource (resource_type, resource_id),
  KEY idx_share_target_status (target_org_id, status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资源共享与复制记录';
```

## 5. 规则与提示层 DDL

```sql
CREATE TABLE rule (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  current_version_id BIGINT NULL,
  page_resource_id BIGINT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_rule_name_del (name, is_deleted),
  KEY idx_rule_org_status (owner_org_id, status, updated_at),
  KEY idx_rule_page (page_resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='规则主表';

CREATE TABLE rule_version (
  id BIGINT NOT NULL AUTO_INCREMENT,
  rule_id BIGINT NOT NULL,
  version_no INT NOT NULL,
  state VARCHAR(32) NOT NULL,
  priority INT NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  owner_user_id VARCHAR(64) NOT NULL,
  effective_start_at DATETIME(3) NULL,
  effective_end_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_rule_ver_del (rule_id, version_no, is_deleted),
  KEY idx_rule_ver_state_org (state, owner_org_id, updated_at),
  KEY idx_rule_ver_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='规则版本表';

CREATE TABLE rule_condition_group (
  id BIGINT NOT NULL AUTO_INCREMENT,
  rule_version_id BIGINT NOT NULL,
  parent_group_id BIGINT NULL,
  logic_type VARCHAR(8) NOT NULL,
  group_level TINYINT NOT NULL,
  sort_no INT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_rule_group_rule (rule_version_id, group_level, sort_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='规则条件组';

CREATE TABLE rule_condition (
  id BIGINT NOT NULL AUTO_INCREMENT,
  group_id BIGINT NOT NULL,
  left_source_type VARCHAR(32) NOT NULL,
  left_source_ref VARCHAR(255) NULL,
  operator VARCHAR(32) NOT NULL,
  right_source_type VARCHAR(32) NOT NULL,
  right_source_ref VARCHAR(255) NULL,
  right_fixed_value VARCHAR(1024) NULL,
  sort_no INT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_rule_condition_group (group_id, sort_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='规则条件';

CREATE TABLE rule_preprocessor_binding (
  id BIGINT NOT NULL AUTO_INCREMENT,
  condition_id BIGINT NOT NULL,
  side_flag VARCHAR(8) NOT NULL,
  preprocessor_id BIGINT NOT NULL,
  order_no INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_rule_processor_order (condition_id, side_flag, order_no, is_deleted),
  KEY idx_rule_processor_pre (preprocessor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='规则预处理器绑定';

CREATE TABLE rule_prompt_config (
  id BIGINT NOT NULL AUTO_INCREMENT,
  rule_version_id BIGINT NOT NULL,
  prompt_mode VARCHAR(32) NOT NULL,
  close_mode VARCHAR(32) NOT NULL,
  prompt_content TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_rule_prompt_ver_del (rule_version_id, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='规则提示配置';

CREATE TABLE rule_scene_binding (
  id BIGINT NOT NULL AUTO_INCREMENT,
  rule_version_id BIGINT NOT NULL,
  job_scene_id BIGINT NOT NULL,
  trigger_mode VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_rule_scene_bind_del (rule_version_id, job_scene_id, is_deleted),
  KEY idx_rule_scene_scene (job_scene_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='规则与作业场景绑定';
```

## 6. 作业场景层 DDL

```sql
CREATE TABLE job_scene (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  page_resource_id BIGINT NOT NULL,
  current_version_id BIGINT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_job_scene_name_del (name, is_deleted),
  KEY idx_job_scene_org_status (owner_org_id, status, updated_at),
  KEY idx_job_scene_page (page_resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='作业场景主表';

CREATE TABLE job_scene_version (
  id BIGINT NOT NULL AUTO_INCREMENT,
  job_scene_id BIGINT NOT NULL,
  version_no INT NOT NULL,
  state VARCHAR(32) NOT NULL,
  execution_mode VARCHAR(64) NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  owner_user_id VARCHAR(64) NOT NULL,
  effective_start_at DATETIME(3) NULL,
  effective_end_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_job_scene_ver_del (job_scene_id, version_no, is_deleted),
  KEY idx_job_scene_ver_state_org (state, owner_org_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='作业场景版本';

CREATE TABLE job_node (
  id BIGINT NOT NULL AUTO_INCREMENT,
  job_scene_version_id BIGINT NOT NULL,
  node_type VARCHAR(32) NOT NULL,
  order_no INT NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  node_config JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_job_node_order_del (job_scene_version_id, order_no, is_deleted),
  KEY idx_job_node_ver (job_scene_version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='作业节点';

CREATE TABLE job_node_mapping (
  id BIGINT NOT NULL AUTO_INCREMENT,
  job_node_id BIGINT NOT NULL,
  mapping_type VARCHAR(32) NOT NULL,
  source_ref VARCHAR(255) NOT NULL,
  target_ref VARCHAR(255) NOT NULL,
  sort_no INT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_job_node_mapping (job_node_id, sort_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='节点输入输出映射';

CREATE TABLE job_preview_template (
  id BIGINT NOT NULL AUTO_INCREMENT,
  job_scene_version_id BIGINT NOT NULL,
  field_name VARCHAR(128) NOT NULL,
  source_ref VARCHAR(255) NOT NULL,
  target_ref VARCHAR(255) NULL,
  writable TINYINT(1) NOT NULL DEFAULT 1,
  sort_no INT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_job_preview_ver (job_scene_version_id, sort_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预览确认模板';

CREATE TABLE risk_confirmation_record (
  id BIGINT NOT NULL AUTO_INCREMENT,
  job_scene_version_id BIGINT NOT NULL,
  confirmer_id VARCHAR(64) NOT NULL,
  confirmed_at DATETIME(3) NOT NULL,
  execution_mode VARCHAR(64) NOT NULL,
  scope_snapshot JSON NOT NULL,
  remark VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_risk_confirm_ver (job_scene_version_id, confirmed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自动执行风险确认记录';

CREATE TABLE manual_time_baseline (
  id BIGINT NOT NULL AUTO_INCREMENT,
  job_scene_version_id BIGINT NOT NULL,
  manual_duration_sec INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_manual_time_ver_del (job_scene_version_id, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='人工作业时长基线';
```

## 7. 控制与权限层 DDL

```sql
CREATE TABLE org_role (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  role_type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  org_scope_id VARCHAR(64) NOT NULL,
  source_role_id BIGINT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_org_role_name_scope_del (name, org_scope_id, is_deleted),
  KEY idx_org_role_status_scope (status, org_scope_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组织内角色定义';

CREATE TABLE org_role_action (
  id BIGINT NOT NULL AUTO_INCREMENT,
  role_id BIGINT NOT NULL,
  action_type VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_org_role_action_del (role_id, action_type, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色操作类型权限';

CREATE TABLE org_role_member (
  id BIGINT NOT NULL AUTO_INCREMENT,
  role_id BIGINT NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  bind_org_id VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_org_role_member_del (role_id, user_id, is_deleted),
  KEY idx_org_role_member_user (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色与人员绑定';

CREATE TABLE publish_task (
  id BIGINT NOT NULL AUTO_INCREMENT,
  resource_type VARCHAR(32) NOT NULL,
  resource_id BIGINT NOT NULL,
  target_version_id BIGINT NOT NULL,
  status VARCHAR(32) NOT NULL,
  operator_id VARCHAR(64) NOT NULL,
  scope_snapshot JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_publish_resource (resource_type, resource_id, created_at),
  KEY idx_publish_status_operator (status, operator_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='发布任务';

CREATE TABLE validation_record (
  id BIGINT NOT NULL AUTO_INCREMENT,
  publish_task_id BIGINT NOT NULL,
  validation_type VARCHAR(64) NOT NULL,
  result VARCHAR(16) NOT NULL,
  target_ref VARCHAR(255) NULL,
  detail_json JSON NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_validation_task (publish_task_id, result)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='发布前校验结果';

CREATE TABLE state_change_audit_log (
  id BIGINT NOT NULL AUTO_INCREMENT,
  resource_type VARCHAR(32) NOT NULL,
  resource_id BIGINT NOT NULL,
  action_type VARCHAR(32) NOT NULL,
  operator_id VARCHAR(64) NOT NULL,
  org_id VARCHAR(64) NOT NULL,
  trace_id VARCHAR(64) NOT NULL,
  detail_json JSON NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_audit_trace (trace_id),
  KEY idx_audit_resource_time (resource_type, resource_id, created_at),
  KEY idx_audit_operator_time (operator_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='状态变更审计日志';
```

## 8. 运行面与日志层 DDL

```sql
CREATE TABLE runtime_snapshot (
  id BIGINT NOT NULL AUTO_INCREMENT,
  snapshot_type VARCHAR(32) NOT NULL,
  page_resource_id BIGINT NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  role_scope_hash VARCHAR(128) NOT NULL,
  bundle_version VARCHAR(64) NOT NULL,
  etag VARCHAR(64) NOT NULL,
  payload_json JSON NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_runtime_snapshot_bundle_del (page_resource_id, owner_org_id, role_scope_hash, bundle_version, is_deleted),
  KEY idx_runtime_snapshot_etag (page_resource_id, owner_org_id, role_scope_hash, etag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='运行时快照';

CREATE TABLE runtime_execution_instance (
  id BIGINT NOT NULL AUTO_INCREMENT,
  job_scene_version_id BIGINT NOT NULL,
  page_resource_id BIGINT NOT NULL,
  trigger_source VARCHAR(32) NOT NULL,
  execution_mode VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  trace_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  org_id VARCHAR(64) NOT NULL,
  context_json JSON NULL,
  error_message VARCHAR(1024) NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_runtime_exec_trace_del (trace_id, id, is_deleted),
  KEY idx_runtime_exec_scene_time (job_scene_version_id, created_at),
  KEY idx_runtime_exec_status_time (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='执行实例';

CREATE TABLE runtime_node_instance (
  id BIGINT NOT NULL AUTO_INCREMENT,
  execution_instance_id BIGINT NOT NULL,
  job_node_id BIGINT NOT NULL,
  status VARCHAR(32) NOT NULL,
  latency_ms INT NULL,
  input_snapshot JSON NULL,
  output_snapshot JSON NULL,
  error_message VARCHAR(1024) NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_runtime_node_exec_del (execution_instance_id, job_node_id, is_deleted),
  KEY idx_runtime_node_status_time (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='节点执行快照';

CREATE TABLE trigger_log (
  id BIGINT NOT NULL AUTO_INCREMENT,
  trace_id VARCHAR(64) NOT NULL,
  rule_version_id BIGINT NOT NULL,
  page_resource_id BIGINT NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  org_id VARCHAR(64) NOT NULL,
  result VARCHAR(32) NOT NULL,
  reason VARCHAR(255) NULL,
  detail_json JSON NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_trigger_trace (trace_id),
  KEY idx_trigger_rule_time (rule_version_id, created_at),
  KEY idx_trigger_page_org_time (page_resource_id, org_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='规则触发日志';

CREATE TABLE execution_log (
  id BIGINT NOT NULL AUTO_INCREMENT,
  trace_id VARCHAR(64) NOT NULL,
  execution_instance_id BIGINT NOT NULL,
  node_id BIGINT NULL,
  result VARCHAR(32) NOT NULL,
  reason VARCHAR(255) NULL,
  latency_ms INT NULL,
  detail_json JSON NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_exec_log_trace (trace_id),
  KEY idx_exec_log_instance_time (execution_instance_id, created_at),
  KEY idx_exec_log_result_time (result, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='执行日志';

CREATE TABLE metric_daily_org_menu (
  id BIGINT NOT NULL AUTO_INCREMENT,
  stat_date DATE NOT NULL,
  org_id VARCHAR(64) NOT NULL,
  menu_id BIGINT NOT NULL,
  execution_success_cnt BIGINT NOT NULL DEFAULT 0,
  execution_total_cnt BIGINT NOT NULL DEFAULT 0,
  avg_saved_sec DECIMAL(12,2) NOT NULL DEFAULT 0,
  expired_resource_cnt BIGINT NOT NULL DEFAULT 0,
  expiring_soon_resource_cnt BIGINT NOT NULL DEFAULT 0,
  failure_reason_topn JSON NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_metric_day_org_menu_del (stat_date, org_id, menu_id, is_deleted),
  KEY idx_metric_org_date (org_id, stat_date),
  KEY idx_metric_menu_date (menu_id, stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='核心指标日聚合';
```

## 9. 日志归档与容量建议

### 9.1 首批优先落地的核心表

以下表建议在 P0 阶段优先完成建表和联调：

1. `rule`
2. `rule_version`
3. `job_scene`
4. `job_scene_version`
5. `org_role`
6. `publish_task`

### 9.2 优先考虑归档的表

以下表增长更快，建议优先设计归档和冷热分层策略：

1. `trigger_log`
2. `execution_log`
3. `state_change_audit_log`
4. `runtime_execution_instance`
5. `runtime_node_instance`
6. `metric_daily_org_menu`

### 9.3 单库索引与容量建议

1. 日志类表优先按 `created_at` 做归档策略，不急于做物理拆表。
2. 指标类表优先保证 `stat_date + org_id + menu_id` 唯一键和查询索引。
3. 快照类表优先保证 `page_resource_id + owner_org_id + etag` 的读取效率。

## 10. 与 TDSQL 相关的特别说明

1. 当前草案未批量写入 `FOREIGN KEY`，主要是为了降低前期 schema 迭代成本；正式建库时，可优先为主数据表、版本表和明细表补充稳定外键。
2. `JSON` 字段适合承载快照、规则条件、节点配置等弱结构数据，但高频过滤字段应单独冗余成列。
3. 软删除唯一键采用 `(业务唯一字段, is_deleted)` 模式，兼容对象停用/重建场景。
4. 日志大表建议按月归档或冷热分层，不建议长期全部保留在主库热表。
5. 若行内规范不允许 `JSON` 字段，可退化为 `LONGTEXT` + 应用层序列化，但索引能力会变弱。
6. 名单数据采用“元数据入 TDSQL、检索明细入 Elasticsearch”的分层方案；本文仅覆盖名单对象、版本、发布与引用等元数据表，不覆盖名单明细行存储结构。

## 11. 下一步建议

1. 先用本文覆盖核心表建模评审，不急于一次性冻结所有日志扩展字段。
2. 以 `page_resource`、`list_data`、`rule`、`job_scene`、`publish_task`、`runtime_execution_instance` 六条主链为首批建表范围。
3. 在正式建库前，补齐以下内容：
   `bundle_version` 生成规则
   是否补充稳定外键
   日志保留周期
   `JSON` 字段的行内规范限制
   名单明细 ES 索引模板与别名切换规则
4. 若后续确认实际为 `TDSQL-PG`，可保留本文表结构设计，只切换为 PostgreSQL 方言 DDL。



