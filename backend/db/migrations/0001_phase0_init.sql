CREATE TABLE IF NOT EXISTS page_site (
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
  UNIQUE KEY uk_page_site_code_del (site_code, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='业务站点定义';

CREATE TABLE IF NOT EXISTS page_menu (
  id BIGINT NOT NULL AUTO_INCREMENT,
  site_id BIGINT NOT NULL,
  menu_code VARCHAR(64) NOT NULL,
  menu_name VARCHAR(128) NOT NULL,
  url_pattern VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_page_menu_site_status (site_id, status, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单定义';

CREATE TABLE IF NOT EXISTS page_resource (
  id BIGINT NOT NULL AUTO_INCREMENT,
  site_id BIGINT NOT NULL,
  menu_id BIGINT NOT NULL,
  page_name VARCHAR(128) NOT NULL,
  page_code VARCHAR(128) NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  current_version_id BIGINT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_page_resource_owner_status (owner_org_id, status, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='页面资源主表';

CREATE TABLE IF NOT EXISTS page_resource_version (
  id BIGINT NOT NULL AUTO_INCREMENT,
  page_resource_id BIGINT NOT NULL,
  version_no INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  content_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_page_resource_version_page (page_resource_id, version_no, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='页面资源版本表';

CREATE TABLE IF NOT EXISTS interface_definition (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  method VARCHAR(16) NOT NULL,
  path VARCHAR(255) NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  current_version_id BIGINT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_interface_owner_status (owner_org_id, status, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='接口定义主表';

CREATE TABLE IF NOT EXISTS interface_version (
  id BIGINT NOT NULL AUTO_INCREMENT,
  interface_id BIGINT NOT NULL,
  version_no INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  content_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_interface_version_interface (interface_id, version_no, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='接口定义版本表';

CREATE TABLE IF NOT EXISTS rule_definition (
  id BIGINT NOT NULL AUTO_INCREMENT,
  rule_name VARCHAR(128) NOT NULL,
  page_resource_id BIGINT NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  trigger_mode VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  current_version_id BIGINT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_rule_owner_status (owner_org_id, status, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='规则主表';

CREATE TABLE IF NOT EXISTS rule_version (
  id BIGINT NOT NULL AUTO_INCREMENT,
  rule_id BIGINT NOT NULL,
  version_no INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  content_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_rule_version_rule (rule_id, version_no, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='规则版本表';

CREATE TABLE IF NOT EXISTS publish_task (
  id BIGINT NOT NULL AUTO_INCREMENT,
  resource_type VARCHAR(64) NOT NULL,
  resource_id BIGINT NOT NULL,
  version_id BIGINT NOT NULL,
  publish_type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  scope_org_ids_json JSON NOT NULL,
  effective_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_publish_task_resource (resource_type, resource_id, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='发布任务表';

CREATE TABLE IF NOT EXISTS runtime_snapshot (
  id BIGINT NOT NULL AUTO_INCREMENT,
  page_resource_id BIGINT NOT NULL,
  page_version_id BIGINT NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  snapshot_version VARCHAR(64) NOT NULL,
  snapshot_json JSON NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_runtime_snapshot_page (page_resource_id, owner_org_id, status, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='运行时快照表';
