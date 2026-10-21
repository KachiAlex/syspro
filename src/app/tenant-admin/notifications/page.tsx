"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { Bell, Mail, Clock, Plus, Trash2, Check } from "lucide-react";

type RecipientSpec =
  | { kind: "role"; value: string }
  | { kind: "user"; value: string }
  | { kind: "party" }
  | { kind: "emails"; value: string[] }
  | { kind: "admin" };

type Rule = {
  eventType: string;
  channels: string[];
  recipients: RecipientSpec[];
  enabled: boolean;
  source: string;
  subjectOverride?: string;
};

type Prefs = {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  frequency: "immediate" | "daily";
  quietStart?: string | null;
  quietEnd?: string | null;
  quietTz?: string | null;
};

const TIMEZONES = ["Africa/Lagos", "UTC", "Africa/Johannesburg", "Europe/London", "America/New_York"];

export default function NotificationsSettingsPage() {
  const { tenantSlug } = useTenantContext();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [busy, setBusy] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const qs = useCallback(() => `tenantSlug=${encodeURIComponent(tenantSlug)}`, [tenantSlug]);

  const load = useCallback(async () => {
    const [p, r] = await Promise.all([
      fetch(`/api/notifications/preferences?${qs()}`).then((res) => res.json()).catch(() => ({})),
      fetch(`/api/notifications/rules?${qs()}`).then((res) => res.json()).catch(() => ({})),
    ]);
    if (p.preferences) setPrefs(p.preferences);
    if (r.rules) setRules(r.rules);
  }, [qs]);

  useEffect(() => { void load(); }, [load]);

  const flash = (msg: string) => { setSavedMsg(msg); setTimeout(() => setSavedMsg(""), 2500); };

  const savePrefs = async () => {
    if (!prefs) return;
    setBusy(true);
    await fetch("/api/notifications/preferences", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug, ...prefs }),
    });
    setBusy(false);
    flash("Preferences saved");
  };

  const saveRule = async (rule: Rule) => {
    setBusy(true);
    await fetch("/api/notifications/rules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantSlug, eventType: rule.eventType, channels: rule.channels,
        recipients: rule.recipients, enabled: rule.enabled,
        subjectOverride: rule.subjectOverride,
      }),
    });
    setBusy(false);
    flash(`Rule saved: ${rule.eventType}`);
    void load();
  };

  const updateRule = (idx: number, patch: Partial<Rule>) =>
    setRules((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const toggleChannel = (idx: number, ch: string) => {
    const r = rules[idx];
    const channels = r.channels.includes(ch)
      ? r.channels.filter((c) => c !== ch)
      : [...r.channels, ch];
    updateRule(idx, { channels: channels.length ? channels : r.channels });
  };

  const addRecipient = (idx: number) =>
    updateRule(idx, { recipients: [...rules[idx].recipients, { kind: "role", value: "" }] });

  const updateRecipient = (idx: number, rIdx: number, spec: RecipientSpec) =>
    updateRule(idx, { recipients: rules[idx].recipients.map((s, i) => (i === rIdx ? spec : s)) });

  const removeRecipient = (idx: number, rIdx: number) =>
    updateRule(idx, { recipients: rules[idx].recipients.filter((_, i) => i !== rIdx) });

  if (!prefs) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold"><Bell className="h-5 w-5" /> Notifications</h1>
        {savedMsg && <span className="flex items-center gap-1 text-sm text-emerald-400"><Check className="h-4 w-4" />{savedMsg}</span>}
      </div>

      {/* My delivery preferences */}
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-4">
        <h2 className="font-medium text-slate-200">My delivery preferences</h2>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={prefs.emailEnabled}
              onChange={(e) => setPrefs({ ...prefs, emailEnabled: e.target.checked })} />
            <Mail className="h-4 w-4 text-slate-400" /> Email me
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={prefs.inAppEnabled}
              onChange={(e) => setPrefs({ ...prefs, inAppEnabled: e.target.checked })} />
            <Bell className="h-4 w-4 text-slate-400" /> In-app (bell)
          </label>
          <label className="flex items-center gap-2 text-sm">
            Frequency
            <select className="rounded bg-slate-800 px-2 py-1 text-sm" value={prefs.frequency}
              onChange={(e) => setPrefs({ ...prefs, frequency: e.target.value as Prefs["frequency"] })}>
              <option value="immediate">Immediate</option>
              <option value="daily">Daily digest (08:00)</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Clock className="h-4 w-4 text-slate-400" />
          <span className="text-slate-400">Quiet hours</span>
          <input type="time" className="rounded bg-slate-800 px-2 py-1" value={prefs.quietStart ?? ""}
            onChange={(e) => setPrefs({ ...prefs, quietStart: e.target.value || null })} />
          <span className="text-slate-500">to</span>
          <input type="time" className="rounded bg-slate-800 px-2 py-1" value={prefs.quietEnd ?? ""}
            onChange={(e) => setPrefs({ ...prefs, quietEnd: e.target.value || null })} />
          <select className="rounded bg-slate-800 px-2 py-1" value={prefs.quietTz ?? ""}
            onChange={(e) => setPrefs({ ...prefs, quietTz: e.target.value || null })}>
            <option value="">Timezone…</option>
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
          <span className="text-xs text-slate-500">emails are held until quiet hours end</span>
        </div>
        <button disabled={busy} onClick={() => void savePrefs()}
          className="rounded bg-sky-600 px-4 py-1.5 text-sm hover:bg-sky-500 disabled:opacity-50">
          {busy ? "Saving…" : "Save preferences"}
        </button>
      </section>

      {/* Tenant routing rules */}
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-3">
        <h2 className="font-medium text-slate-200">Event routing <span className="text-xs font-normal text-slate-500">(tenant overrides)</span></h2>
        <div className="space-y-2">
          {rules.map((rule, idx) => (
            <details key={rule.eventType} className="rounded border border-slate-800 bg-slate-950">
              <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={rule.enabled}
                    onChange={(e) => updateRule(idx, { enabled: e.target.checked })}
                    onClick={(e) => e.stopPropagation()} />
                  <span className="font-mono text-sm">{rule.eventType}</span>
                  {rule.source === "tenant" && <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-400">override</span>}
                </div>
                <div className="flex gap-2 text-[10px] uppercase tracking-wide text-slate-500">
                  {rule.channels.map((c) => <span key={c} className="rounded bg-slate-800 px-1.5 py-0.5">{c}</span>)}
                </div>
              </summary>
              <div className="space-y-3 border-t border-slate-800 px-4 py-3">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-400">Channels:</span>
                  {["email", "in_app"].map((ch) => (
                    <label key={ch} className="flex items-center gap-1.5">
                      <input type="checkbox" checked={rule.channels.includes(ch)} onChange={() => toggleChannel(idx, ch)} />
                      {ch === "in_app" ? "in-app" : ch}
                    </label>
                  ))}
                </div>
                <div className="space-y-2">
                  <span className="text-sm text-slate-400">Recipients:</span>
                  {rule.recipients.map((spec, rIdx) => (
                    <div key={rIdx} className="flex items-center gap-2">
                      <select className="rounded bg-slate-800 px-2 py-1 text-sm" value={spec.kind}
                        onChange={(e) => {
                          const kind = e.target.value as RecipientSpec["kind"];
                          const next: RecipientSpec =
                            kind === "role" || kind === "user" ? { kind, value: "" }
                            : kind === "emails" ? { kind, value: [] }
                            : { kind } as RecipientSpec;
                          updateRecipient(idx, rIdx, next);
                        }}>
                        <option value="role">role</option>
                        <option value="user">user</option>
                        <option value="party">document party</option>
                        <option value="emails">explicit emails</option>
                        <option value="admin">all admins</option>
                      </select>
                      {(spec.kind === "role" || spec.kind === "user") && (
                        <input className="flex-1 rounded bg-slate-800 px-2 py-1 text-sm"
                          placeholder={spec.kind === "role" ? "e.g. finance_manager" : "user id or email"}
                          value={spec.value}
                          onChange={(e) => updateRecipient(idx, rIdx, { ...spec, value: e.target.value } as RecipientSpec)} />
                      )}
                      {spec.kind === "emails" && (
                        <input className="flex-1 rounded bg-slate-800 px-2 py-1 text-sm"
                          placeholder="a@b.co, c@d.co"
                          value={spec.value.join(", ")}
                          onChange={(e) => updateRecipient(idx, rIdx, {
                            kind: "emails",
                            value: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                          })} />
                      )}
                      <button onClick={() => removeRecipient(idx, rIdx)} className="text-slate-500 hover:text-rose-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addRecipient(idx)} className="flex items-center gap-1 text-xs text-sky-400 hover:underline">
                    <Plus className="h-3 w-3" /> Add recipient
                  </button>
                </div>
                <button disabled={busy} onClick={() => void saveRule(rule)}
                  className="rounded bg-sky-600 px-3 py-1 text-xs hover:bg-sky-500 disabled:opacity-50">
                  Save rule
                </button>
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
