import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { SectionHeading, PillButton } from '@/components/ui/primitives';

const meta: Meta = {
  title: 'TenantAdmin/Headers',
};

export default meta;

export const ItSupportHeader: StoryObj = {
  render: () => (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <SectionHeading eyebrow="Incident to resolution" title="IT Support control center" description="Live ticket queue, SLA heatmap, dispatch radar, and assignment intelligence." />
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <PillButton variant="primary">New ticket</PillButton>
        <PillButton variant="secondary">Refresh data</PillButton>
      </div>
    </div>
  ),
};

export const BillingHeader: StoryObj = {
  render: () => (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <SectionHeading eyebrow="Billing" title="Active Subscriptions" description="Manage your organization's subscriptions and plans" />
    </div>
  ),
};

export const ReportsHeader: StoryObj = {
  render: () => (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <SectionHeading eyebrow="Reports" title="Operational, financial, and executive" description="Cross-module reporting with scheduling and exports." />
      <div style={{ marginTop: 12 }}>
        <PillButton variant="secondary">Refresh</PillButton>
      </div>
    </div>
  ),
};