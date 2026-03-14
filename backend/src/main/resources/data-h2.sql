INSERT INTO page_site (id, site_code, name, status, remark, created_at, created_by, updated_at, updated_by, is_deleted)
VALUES (1, 'crm', 'CRM', 'ACTIVE', 'H2 seed', CURRENT_TIMESTAMP, 'system.seed', CURRENT_TIMESTAMP, 'system.seed', 0);

INSERT INTO page_menu (id, site_id, menu_code, menu_name, url_pattern, status, created_at, created_by, updated_at, updated_by, is_deleted)
VALUES (1, 1, 'loan-apply', 'Loan Apply', '/loan/apply', 'ACTIVE', CURRENT_TIMESTAMP, 'system.seed', CURRENT_TIMESTAMP, 'system.seed', 0);

INSERT INTO page_resource (id, site_id, menu_id, page_name, page_code, owner_org_id, status, current_version_id, created_at, created_by, updated_at, updated_by, is_deleted)
VALUES (100, 1, 1, 'Loan Apply Page', 'loan.apply.page', 'org.demo', 'ACTIVE', 1000, CURRENT_TIMESTAMP, 'system.seed', CURRENT_TIMESTAMP, 'system.seed', 0);

INSERT INTO page_resource_version (id, page_resource_id, version_no, status, content_json, created_at, created_by, updated_at, updated_by, is_deleted)
VALUES (1000, 100, 1, 'ACTIVE', '{"pageTitle":"Loan Apply","urlPattern":"/loan/apply"}', CURRENT_TIMESTAMP, 'system.seed', CURRENT_TIMESTAMP, 'system.seed', 0);

INSERT INTO interface_definition (id, name, method, path, owner_org_id, status, current_version_id, created_at, created_by, updated_at, updated_by, is_deleted)
VALUES (200, 'Customer Profile API', 'POST', '/internal/customer/profile', 'org.demo', 'ACTIVE', 2000, CURRENT_TIMESTAMP, 'system.seed', CURRENT_TIMESTAMP, 'system.seed', 0);

INSERT INTO interface_version (id, interface_id, version_no, status, content_json, created_at, created_by, updated_at, updated_by, is_deleted)
VALUES (2000, 200, 1, 'ACTIVE', '{"authStrategy":"INTRANET_SESSION"}', CURRENT_TIMESTAMP, 'system.seed', CURRENT_TIMESTAMP, 'system.seed', 0);

INSERT INTO rule_definition (id, rule_name, page_resource_id, owner_org_id, trigger_mode, status, current_version_id, created_at, created_by, updated_at, updated_by, is_deleted)
VALUES (300, 'Large Amount Prompt', 100, 'org.demo', 'AUTO', 'ACTIVE', 3000, CURRENT_TIMESTAMP, 'system.seed', CURRENT_TIMESTAMP, 'system.seed', 0);

INSERT INTO rule_version (id, rule_id, version_no, status, content_json, created_at, created_by, updated_at, updated_by, is_deleted)
VALUES (3000, 300, 1, 'ACTIVE', '{"conditionLogic":"AND"}', CURRENT_TIMESTAMP, 'system.seed', CURRENT_TIMESTAMP, 'system.seed', 0);

INSERT INTO publish_task (id, resource_type, resource_id, version_id, publish_type, status, scope_org_ids_json, effective_at, created_at, created_by, updated_at, updated_by, is_deleted)
VALUES (4001, 'PAGE_RESOURCE', 100, 1000, 'IMMEDIATE', 'SUCCEEDED', '["org.demo"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'system.seed', CURRENT_TIMESTAMP, 'system.seed', 0);

INSERT INTO runtime_snapshot (id, page_resource_id, page_version_id, owner_org_id, snapshot_version, snapshot_json, status, created_at, created_by, updated_at, updated_by, is_deleted)
VALUES (5001, 100, 1000, 'org.demo', 'snapshot-1', '{"manifest":{"pageId":100}}', 'ACTIVE', CURRENT_TIMESTAMP, 'system.seed', CURRENT_TIMESTAMP, 'system.seed', 0);
