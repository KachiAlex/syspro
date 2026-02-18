import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { Panel, PillButton, Tag } from './primitives';

const meta: Meta = {
  title: 'UI/Primitives',
  component: Panel,
};

export default meta;

export const Card: StoryObj = {
  render: () => (
    <Panel>
      <h3 className="text-lg font-semibold">Panel / Card</h3>
      <p className="mt-2 text-sm text-muted">This uses new semantic tokens and card styling.</p>
      <div className="mt-4 flex gap-2">
        <PillButton variant="primary">Primary</PillButton>
        <PillButton variant="secondary">Secondary</PillButton>
      </div>
    </Panel>
  ),
};

export const Tags: StoryObj = {
  render: () => (
    <div className="space-y-2">
      <Tag tone="teal">Teal</Tag>
      <Tag tone="amber">Amber</Tag>
      <Tag tone="rose">Rose</Tag>
    </div>
  ),
};

export const BillingSectionExample: StoryObj = {
  render: () => (
    <Panel>
      <SectionHeading eyebrow="Billing" title="Active Subscriptions" description="Manage subscriptions and invoices" />
      <div className="mt-4">
        <PillButton variant="primary">New Invoice</PillButton>
      </div>
    </Panel>
  )
};

export const ItSupportExample: StoryObj = {
  render: () => (
    <Panel>
      <SectionHeading eyebrow="Support" title="IT Support control center" description="Manage tickets and field jobs" />
      <div className="mt-4">
        <PillButton variant="primary">New ticket</PillButton>
      </div>
    </Panel>
  )
};