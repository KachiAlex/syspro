import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// Recreate the schema from the route to test validation independently
const createSchema = z.object({
  tenantSlug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  parentDepartmentId: z.string().optional(),
  budget: z.number().nonnegative().optional(),
  costCenter: z.string().optional(),
  managerId: z.string().optional(),
});

describe('POST /api/hr/departments schema validation', () => {
  it('accepts valid payload with all fields', () => {
    const payload = {
      tenantSlug: 'acme',
      name: 'Engineering',
      description: 'Dev team',
      budget: 50000,
      costCenter: 'CC-001',
    };
    const result = createSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Engineering');
      expect(result.data.budget).toBe(50000);
    }
  });

  it('accepts minimal valid payload', () => {
    const payload = {
      tenantSlug: 'acme',
      name: 'Sales',
    };
    const result = createSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('rejects when tenantSlug is missing', () => {
    const payload = { name: 'HR' };
    const result = createSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects when name is empty', () => {
    const payload = { tenantSlug: 'acme', name: '' };
    const result = createSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects budget as string (e.g., from HTML input)', () => {
    const payload = {
      tenantSlug: 'acme',
      name: 'Marketing',
      budget: '50000' as any,
    };
    const result = createSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects negative budget', () => {
    const payload = {
      tenantSlug: 'acme',
      name: 'Ops',
      budget: -100,
    };
    const result = createSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects null body', () => {
    const result = createSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('rejects non-object body', () => {
    const result = createSchema.safeParse('string');
    expect(result.success).toBe(false);
  });
});

describe('POST /api/hr/departments payload serialization', () => {
  it('ensures budget is sent as number not string', () => {
    const budgetInput = '75000';
    const coerced = budgetInput ? Number(budgetInput) : undefined;
    expect(typeof coerced).toBe('number');
    expect(coerced).toBe(75000);

    const payload = {
      tenantSlug: 'acme',
      name: 'Finance',
      budget: coerced,
    };
    const result = createSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
