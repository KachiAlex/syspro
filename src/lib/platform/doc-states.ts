import { FINANCE_INVOICE_STATUSES, EXPENSE_APPROVAL_STATUSES } from "@/lib/finance/types";
import { BUDGET_STATUSES } from "@/lib/finance/budgets";
import { ASSET_STATUSES } from "@/lib/finance/assets-reports";
import { PROJECT_STATUSES, TASK_STATUSES } from "@/lib/projects/types";

/**
 * Canonical lifecycle states per workflow doc type — used to pre-populate the
 * workflow builder's From/To dropdowns with the states a document type can
 * actually hold, before any tenant-defined workflow exists.
 */
export const DOC_TYPE_STATUSES: Record<string, string[]> = {
  invoice: [...FINANCE_INVOICE_STATUSES],
  expense: [...EXPENSE_APPROVAL_STATUSES],
  budget: [...BUDGET_STATUSES],
  asset: [...ASSET_STATUSES],
  project: [...PROJECT_STATUSES],
  task: [...TASK_STATUSES],
};

export function knownStatesForDocType(docType: string): string[] {
  const key = docType.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return DOC_TYPE_STATUSES[key] ?? [];
}
