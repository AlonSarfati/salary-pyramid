INSERT INTO ruleset (ruleset_id, tenant_id, name, status, published_at)
VALUES ('default-2025','default','Default ruleset 2025','ACTIVE', now())
ON CONFLICT (ruleset_id) DO NOTHING;

INSERT INTO tenant_active_ruleset (tenant_id, ruleset_id)
VALUES ('default','default-2025')
ON CONFLICT (tenant_id) DO UPDATE SET ruleset_id=EXCLUDED.ruleset_id, updated_at=now();

INSERT INTO rule (ruleset_id, target, expression, depends_on, meta)
VALUES
('default-2025','Base','10000','[]','{}'),
('default-2025','Expert Bonus','${Base} * 0.06','["Base"]','{"taxable":"true","group":"pension_13_5"}');
