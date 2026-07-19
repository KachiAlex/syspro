'use client';

import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import AutomationRules from '@/app/tenant-admin/sections/automation-rules';

export default function RulesPage() {
  const { tenantSlug } = useTenantContext();
  return <AutomationRules tenantSlug={tenantSlug || ''} />;
}
