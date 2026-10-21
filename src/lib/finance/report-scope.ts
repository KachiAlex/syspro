import type { ReportFilters } from "./assets-reports";
import { resolveEffectiveBranchIds } from "./branches";

/**
 * Apply the caller's branch-access scope to report filters. `requested`
 * (from ?branchId=/?branch=) is resolved and must fall inside the user's
 * scope; restricted users with no explicit branch get their scope applied.
 * Throws { status: 403 } on out-of-scope requests.
 */
export async function applyBranchScope(
  filters: ReportFilters,
  tenantSlug: string,
  userId: string | undefined | null,
  requested: string | null
): Promise<void> {
  const ids = await resolveEffectiveBranchIds(tenantSlug, userId ?? "anonymous", requested);
  if (ids) filters.branchIds = ids;
}
