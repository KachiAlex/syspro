import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import RevOpsWorkspace from '@/app/tenant-admin/sections/revops-workspace';
import ModuleRegistry from '@/app/tenant-admin/sections/module-registry';
import AnalyticsSection from '@/app/tenant-admin/sections/analytics';

const meta: Meta = {
  title: 'TenantAdmin/Sections',
};

export default meta;

export const RevOps: StoryObj = {
  render: () => (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <RevOpsWorkspace tenantSlug={undefined} />
    </div>
  ),
};

export const Modules: StoryObj = {
  render: () => (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <ModuleRegistry tenantSlug={undefined} />
    </div>
  ),
};

export const Analytics: StoryObj = {
  render: () => (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <AnalyticsSection tenantSlug={undefined} />
    </div>
  ),
};