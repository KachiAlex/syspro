/**
 * Ledger bisect: recompute an account's running balance chronologically and
 * locate the first point where it diverges from the expected closing balance
 * — plus structural anomalies (duplicate lines, journal-number gaps,
 * unbalanced entries) that typically cause the divergence.
 *
 * The caller supplies the known-good opening balance and the expected closing
 * balance (e.g. from a trial balance or period close). If the recomputed
 * closing doesn't match, the tool reports the discrepancy delta and the
 * anomaly candidates ranked by proximity to where the drift begins.
 */
import { db } from "@/lib/sql-client";

export interface BisectAnomaly {
  kind: "duplicate" | "sequence_gap" | "unbalanced_entry" | "divergence_point";
  entryId?: string;
  entryNumber?: number | null;
  postingDate?: string;
  detail: string;
}

export interface BisectResult {
  accountCode: string;
  openingBalance: number;
  expectedClosing: number;
  computedClosing: number;
  discrepancy: number;
  lineCount: number;
  entryCount: number;
  anomalies: BisectAnomaly[];
  checkpoint: {
    // running balance at every journal entry — used to localize divergence
    entryNumber: number | null;
    entryId: string;
    postingDate: string;
    debit: number;
    credit: number;
    runningBalance: number;
  }[];
}

export async function bisectLedger(params: {
  tenantSlug: string;
  accountCode: string;
  openingBalance?: number;
  expectedClosing: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<BisectResult> {
  const { tenantSlug, accountCode } = params;
  const opening = Number(params.openingBalance ?? 0);
  const expected = Number(params.expectedClosing);

  const lines = (
    await db.query<any>(
      `select l.id as line_id, l.debit, l.credit, l.account_code,
              e.id as entry_id, e.entry_number, e.posting_date, e.reference,
              e.total_debit, e.total_credit, e.is_reversing
       from journal_entry_lines l
       join journal_entries e on e.id = l.journal_entry_id
       where e.tenant_slug = $1
         and (l.account_code = $2 or l.account_id::text = $2)
         and e.status = 'posted'
         and ($3::text is null or e.posting_date::text >= $3)
         and ($4::text is null or e.posting_date::text <= $4)
       order by e.posting_date, e.entry_number, l.line_number`,
      [tenantSlug, accountCode, params.dateFrom ?? null, params.dateTo ?? null]
    )
  ).rows;

  const anomalies: BisectAnomaly[] = [];
  const checkpoints: BisectResult["checkpoint"] = [];
  const seen = new Map<string, string>(); // amount+date sig → first entry

  let running = opening;
  let prevEntryNo: number | null = null;
  let prevEntryId = "";
  let firstDrift: BisectAnomaly | null = null;

  const entriesSeen = new Set<string>();
  for (const l of lines) {
    const debit = Number(l.debit ?? l.debit_amount ?? 0);
    const credit = Number(l.credit ?? l.credit_amount ?? 0);
    running += debit - credit;
    entriesSeen.add(l.entry_id);

    // duplicate detection: same amount on same date in two different entries
    const sig = `${debit}|${credit}|${l.posting_date}`;
    const dupOf = seen.get(sig);
    if (dupOf && dupOf !== l.entry_id && debit + credit !== 0) {
      anomalies.push({
        kind: "duplicate",
        entryId: l.entry_id,
        entryNumber: l.entry_number,
        postingDate: String(l.posting_date),
        detail: `Amount ${debit - credit} also posted by entry ${dupOf.slice(0, 8)}`,
      });
    } else {
      seen.set(sig, l.entry_id);
    }

    // journal-number sequence gaps
    const en = l.entry_number != null ? Number(l.entry_number) : null;
    if (en != null && prevEntryNo != null && en > prevEntryNo + 1 && l.entry_id !== prevEntryId) {
      anomalies.push({
        kind: "sequence_gap",
        entryId: l.entry_id,
        entryNumber: en,
        postingDate: String(l.posting_date),
        detail: `Journal numbers jump ${prevEntryNo} → ${en}`,
      });
    }
    if (l.entry_id !== prevEntryId) {
      prevEntryNo = en;
      prevEntryId = l.entry_id;
      // unbalanced entry check (once per entry)
      if (Number(l.total_debit ?? 0) !== Number(l.total_credit ?? 0)) {
        anomalies.push({
          kind: "unbalanced_entry",
          entryId: l.entry_id,
          entryNumber: en,
          postingDate: String(l.posting_date),
          detail: `Entry totals debit ${l.total_debit} ≠ credit ${l.total_credit}`,
        });
      }
    }

    checkpoints.push({
      entryNumber: en,
      entryId: l.entry_id,
      postingDate: String(l.posting_date),
      debit,
      credit,
      runningBalance: Math.round(running * 100) / 100,
    });
  }

  const computed = Math.round(running * 100) / 100;
  const discrepancy = Math.round((expected - computed) * 100) / 100;

  // Localize divergence: binary search the checkpoint where the remaining
  // delta first appears relative to the end. With anomalies detected, report
  // the entry nearest to where |running| starts drifting — approximated by
  // the first checkpoint after which the discrepancy is fully attributable
  // to subsequent lines.
  if (discrepancy !== 0 && checkpoints.length) {
    // Walk from the end: the last point where runningBalance equals
    // expected - (remaining tail). The simplest useful signal: report the
    // checkpoint index where the discrepancy would originate if all later
    // lines were correct.
    let lo = 0;
    let hi = checkpoints.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const tailSum = checkpoints.slice(mid).reduce((s, c) => s + (c.debit - c.credit), 0);
      const impliedOpen = expected - tailSum;
      if (Math.abs(checkpoints[mid].runningBalance - (impliedOpen - 0)) < 0.005) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }
    const idx = Math.min(lo, checkpoints.length - 1);
    const cp = checkpoints[idx];
    firstDrift = {
      kind: "divergence_point",
      entryId: cp.entryId,
      entryNumber: cp.entryNumber,
      postingDate: cp.postingDate,
      detail: `First checkpoint where running balance ${cp.runningBalance} no longer reconciles to expected closing ${expected} (Δ ${discrepancy})`,
    };
    anomalies.unshift(firstDrift);
  }

  return {
    accountCode,
    openingBalance: opening,
    expectedClosing: expected,
    computedClosing: computed,
    discrepancy,
    lineCount: lines.length,
    entryCount: entriesSeen.size,
    anomalies,
    checkpoint: checkpoints,
  };
}
