CREATE TABLE IF NOT EXISTS page_site (
  id BIGINT PRIMARY KEY,
  site_code VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  remark VARCHAR(255),
  created_at TIMESTAMP NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS page_menu (
  id BIGINT PRIMARY KEY,
  site_id BIGINT NOT NULL,
  menu_code VARCHAR(64) NOT NULL,
  menu_name VARCHAR(128) NOT NULL,
  url_pattern VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS page_resource (
  id BIGINT PRIMARY KEY,
  site_id BIGINT NOT NULL,
  menu_id BIGINT NOT NULL,
  page_name VARCHAR(128) NOT NULL,
  page_code VARCHAR(128) NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  current_version_id BIGINT,
  created_at TIMESTAMP NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS page_resource_version (
  id BIGINT PRIMARY KEY,
  page_resource_id BIGINT NOT NULL,
  version_no INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  content_json CLOB NOT NULL,
  created_at TIMESTAMP NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS interface_definition (
  id BIGINT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  method VARCHAR(16) NOT NULL,
  path VARCHAR(255) NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  current_version_id BIGINT,
  created_at TIMESTAMP NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS interface_version (
  id BIGINT PRIMARY KEY,
  interface_id BIGINT NOT NULL,
  version_no INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  content_json CLOB NOT NULL,
  created_at TIMESTAMP NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rule_definition (
  id BIGINT PRIMARY KEY,
  rule_name VARCHAR(128) NOT NULL,
  page_resource_id BIGINT NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  trigger_mode VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  current_version_id BIGINT,
  created_at TIMESTAMP NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rule_version (
  id BIGINT PRIMARY KEY,
  rule_id BIGINT NOT NULL,
  version_no INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  content_json CLOB NOT NULL,
  created_at TIMESTAMP NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS publish_task (
  id BIGINT PRIMARY KEY,
  resource_type VARCHAR(64) NOT NULL,
  resource_id BIGINT NOT NULL,
  version_id BIGINT NOT NULL,
  publish_type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  scope_org_ids_json CLOB NOT NULL,
  effective_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS runtime_snapshot (
  id BIGINT PRIMARY KEY,
  page_resource_id BIGINT NOT NULL,
  page_version_id BIGINT NOT NULL,
  owner_org_id VARCHAR(64) NOT NULL,
  snapshot_version VARCHAR(64) NOT NULL,
  snapshot_json CLOB NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  is_deleted TINYINT NOT NULL DEFAULT 0
);
