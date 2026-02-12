-- Seed data for Automation Module (sample automation and rule)
INSERT INTO automations (id, name, description, owner_id, enabled, metadata)
VALUES (
  gen_random_uuid(),
  'Sample: Vendor Onboarding',
  'Example automation to demonstrate rule triggering on vendor.created',
  NULL,
  true,
  json_build_object('example', true)
)
ON CONFLICT DO NOTHING;

-- Insert a sample rule that triggers when event.type = 'vendor.created'
INSERT INTO automation_rules (id, automation_id, name, conditions, actions, priority, enabled)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automations WHERE name = 'Sample: Vendor Onboarding' LIMIT 1),
  'Welcome new vendor',
  json_build_array(json_build_object('op','eq','path','type','value','vendor.created')),
  json_build_array(json_build_object('op','log','message','Notify: new vendor created')),
  10,
  true
)
ON CONFLICT DO NOTHING;
