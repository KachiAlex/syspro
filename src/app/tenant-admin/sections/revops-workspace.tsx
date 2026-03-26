"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  Compass,
  FilePlus,
  Gauge,
  LineChart,
  Megaphone,
  Plus,
  RefreshCcw,
  Shield,
} from "lucide-react";

import { FormAlert } from "@/components/form";

import type {
  AttributionModel,
  AttributionSummary,
  Campaign,
  DemandChannel,
  EnablementAsset,
  LeadSource,
  RevOpsOverviewSnapshot,
  RevenueForecast,
  SalesPerformanceSnapshot,
  SalesTarget,
} from "@/lib/revops-data";

const REVOPS_VIEWS = [
  "overview",
  "campaigns",
  "lead-sources",
  "attribution",
  "sales-performance",
  "enablement",
  "forecasting",
  "reports",
  "settings",
] as const;

const CHANNEL_OPTIONS: DemandChannel[] = [
  "email",
  "social",
  "events",
  "partnerships",
  "referrals",
  "advocacy",
  "paid_search",
  "sponsorships",
];

const MODEL_OPTIONS: { value: AttributionModel; label: string }[] = [
  { value: "first_touch", label: "First touch" },
  { value: "last_touch", label: "Last touch" },
  { value: "linear", label: "Linear" },
];

type RevOpsView = (typeof REVOPS_VIEWS)[number];

type CampaignFormState = {
  name: string;
  objective: string;
  channel: DemandChannel;
  region: string;
  branch: string;
  subsidiary: string;
  startDate: string;
  endDate: string;
  budget: string;
  attributionModel: AttributionModel;
  targetSegments: string;
};

type LeadSourceFormState = {
  name: string;
  channel: DemandChannel;
  region: string;
  branch: string;
  subsidiary: string;
  costCenter: string;
  campaignId: string;
};

type AssetFormState = {
  title: string;
  assetType: EnablementAsset["assetType"];
  audience: EnablementAsset["audience"];
  summary: string;
  storageUrl: string;
  owner: string;
  subsidiary: string;
  region: string;
  tags: string;
};

type SelectOption = string | { label: string; value: string };

const DEFAULT_CAMPAIGN_FORM = (): CampaignFormState => ({
  name: "",
  objective: "",
  channel: "events",
  region: "Global",
  branch: "",
  subsidiary: "MetroWave Holdings",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  budget: "0",
  attributionModel: "linear",
  targetSegments: "",
});

const DEFAULT_LEAD_SOURCE_FORM = (campaignId?: string): LeadSourceFormState => ({
  name: "",
  channel: "events",
  region: "Global",
  branch: "",
  subsidiary: "MetroWave Holdings",
  costCenter: "CC-7000",
  campaignId: campaignId ?? "",
});

const DEFAULT_ASSET_FORM = (): AssetFormState => ({
  title: "",
  assetType: "deck",
  audience: "sales",
  summary: "",
  storageUrl: "",
  owner: "revops.enablement",
  subsidiary: "MetroWave Holdings",
  region: "",
  tags: "",
});

const currencyFormatter = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function RevOpsWorkspace({ tenantSlug, onRefresh }: { tenantSlug?: string | null; onRefresh?: () => void }) {
  const slug = tenantSlug?.trim() || "kreatix-default";
  const [view, setView] = useState<RevOpsView>("overview");
  const [overview, setOverview] = useState<RevOpsOverviewSnapshot | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [attributionModel, setAttributionModel] = useState<AttributionModel>("linear");
  const [attribution, setAttribution] = useState<AttributionSummary | null>(null);
  const [salesSnapshot, setSalesSnapshot] = useState<SalesPerformanceSnapshot | null>(null);
  const [salesTargets, setSalesTargets] = useState<SalesTarget[]>([]);
  const [assets, setAssets] = useState<EnablementAsset[]>([]);
  const [forecast, setForecast] = useState<RevenueForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [leadSourceModalOpen, setLeadSourceModalOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);

  const [campaignForm, setCampaignForm] = useState<CampaignFormState>(() => DEFAULT_CAMPAIGN_FORM());
  const [leadSourceForm, setLeadSourceForm] = useState<LeadSourceFormState>(() => DEFAULT_LEAD_SOURCE_FORM());
  const [assetForm, setAssetForm] = useState<AssetFormState>(() => DEFAULT_ASSET_FORM());
  const [formError, setFormError] = useState<string | null>(null);

  const tenantQuery = useMemo(() => {
    const params = new URLSearchParams({ tenantSlug: slug });
    return params.toString();
  }, [slug]);

  const loadCore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, campaignsRes, leadSourceRes, salesRes, enablementRes, forecastRes] = await Promise.all([
        fetch(`/api/revops/overview?${tenantQuery}`, { cache: "no-store" }),
        fetch(`/api/revops/campaigns?${tenantQuery}`, { cache: "no-store" }),
        fetch(`/api/revops/lead-sources?${tenantQuery}`, { cache: "no-store" }),
        fetch(`/api/revops/sales-performance?${tenantQuery}`, { cache: "no-store" }),
        fetch(`/api/revops/enablement-assets?${tenantQuery}`, { cache: "no-store" }),
        fetch(`/api/revops/forecast?${tenantQuery}`, { cache: "no-store" }),
      ]);

      const [overviewPayload, campaignsPayload, leadSourcePayload, salesPayload, assetsPayload, forecastPayload] = await Promise.all([
        overviewRes.json().catch(() => ({})),
        campaignsRes.json().catch(() => ({})),
        leadSourceRes.json().catch(() => ({})),
        salesRes.json().catch(() => ({})),
        enablementRes.json().catch(() => ({})),
        forecastRes.json().catch(() => ({})),
      ]);

      if (!overviewRes.ok) throw new Error(overviewPayload?.error ?? "Unable to load RevOps overview");
      if (!campaignsRes.ok) throw new Error(campaignsPayload?.error ?? "Unable to load campaigns");
      if (!leadSourceRes.ok) throw new Error(leadSourcePayload?.error ?? "Unable to load lead sources");
      if (!salesRes.ok) throw new Error(salesPayload?.error ?? "Unable to load performance snapshot");
      if (!enablementRes.ok) throw new Error(assetsPayload?.error ?? "Unable to load enablement assets");
      if (!forecastRes.ok) throw new Error(forecastPayload?.error ?? "Unable to load forecast");

      setOverview(overviewPayload.overview ?? null);
      setForecast(forecastPayload.forecast ?? null);
      setCampaigns(Array.isArray(campaignsPayload.campaigns) ? campaignsPayload.campaigns : []);
      setLeadSources(Array.isArray(leadSourcePayload.leadSources) ? leadSourcePayload.leadSources : []);
      setSalesSnapshot(salesPayload.snapshot ?? null);
      setSalesTargets(Array.isArray(salesPayload.targets) ? salesPayload.targets : []);
      setAssets(Array.isArray(assetsPayload.assets) ? assetsPayload.assets : []);
    } catch (err) {
      console.error("RevOps load failed", err);
      setError(err instanceof Error ? err.message : "Unable to load Revenue Operations workspace");
    } finally {
      setLoading(false);
    }
  }, [tenantQuery]);

  const loadAttribution = useCallback(async () => {
    try {
      const response = await fetch(`/api/revops/attribution?${tenantQuery}&model=${encodeURIComponent(attributionModel)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "Unable to load attribution");
      setAttribution(payload.summary ?? null);
    } catch (err) {
      console.error("Attribution load failed", err);
      setAttribution(null);
    }
  }, [tenantQuery, attributionModel]);

  useEffect(() => {
    loadCore();
  }, [loadCore, refreshToken]);

  useEffect(() => {
    loadAttribution();
  }, [loadAttribution, refreshToken]);

  const handleCampaignSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!campaignForm.name.trim() || !campaignForm.objective.trim()) {
      setFormError("Name and objective are required");
      return;
    }

    try {
      const response = await fetch("/api/revops/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: slug,
          name: campaignForm.name.trim(),
          objective: campaignForm.objective.trim(),
          channel: campaignForm.channel,
          region: campaignForm.region.trim() || "Global",
          branch: campaignForm.branch.trim() || undefined,
          subsidiary: campaignForm.subsidiary.trim() || "MetroWave Holdings",
          startDate: campaignForm.startDate,
          endDate: campaignForm.endDate || undefined,
          budget: Number(campaignForm.budget) || 0,
          attributionModel: campaignForm.attributionModel,
          targetSegments: campaignForm.targetSegments
            ? campaignForm.targetSegments.split(",").map((value) => value.trim()).filter(Boolean)
            : undefined,
          createdBy: "revops.ui",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "Unable to create campaign");
      setCampaigns((prev) => [payload.campaign, ...prev]);
      setCampaignModalOpen(false);
      setCampaignForm(DEFAULT_CAMPAIGN_FORM());
    } catch (err) {
      console.error("Campaign create failed", err);
      setFormError(err instanceof Error ? err.message : "Unable to create campaign");
    }
  };

  const handleLeadSourceSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!leadSourceForm.name.trim() || !leadSourceForm.costCenter.trim()) {
      setFormError("Source name and cost center are required");
      return;
    }
    try {
      const response = await fetch("/api/revops/lead-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: slug,
          name: leadSourceForm.name.trim(),
          channel: leadSourceForm.channel,
          region: leadSourceForm.region.trim() || "Global",
          branch: leadSourceForm.branch.trim() || undefined,
          subsidiary: leadSourceForm.subsidiary.trim() || "MetroWave Holdings",
          costCenter: leadSourceForm.costCenter.trim(),
          campaignId: leadSourceForm.campaignId || undefined,
          createdBy: "revops.ui",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "Unable to register lead source");
      setLeadSources((prev) => [...prev, payload.leadSource]);
      setLeadSourceModalOpen(false);
      setLeadSourceForm(DEFAULT_LEAD_SOURCE_FORM());
    } catch (err) {
      console.error("Lead source create failed", err);
      setFormError(err instanceof Error ? err.message : "Unable to register lead source");
    }
  };

  const handleAssetSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!assetForm.title.trim() || !assetForm.summary.trim() || !assetForm.storageUrl.trim()) {
      setFormError("Title, summary, and storage URL are required");
      return;
    }
    try {
      const response = await fetch("/api/revops/enablement-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: slug,
          title: assetForm.title.trim(),
          assetType: assetForm.assetType,
          audience: assetForm.audience,
          summary: assetForm.summary.trim(),
          storageUrl: assetForm.storageUrl.trim(),
          owner: assetForm.owner.trim() || "revops.enablement",
          subsidiary: assetForm.subsidiary.trim() || "MetroWave Holdings",
          region: assetForm.region.trim() || undefined,
          tags: assetForm.tags
            ? assetForm.tags.split(",").map((value) => value.trim()).filter(Boolean)
            : undefined,
          createdBy: "revops.ui",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "Unable to publish asset");
      setAssets((prev) => [payload.asset, ...prev]);
      setAssetModalOpen(false);
      setAssetForm(DEFAULT_ASSET_FORM());
    } catch (err) {
      console.error("Asset create failed", err);
      setFormError(err instanceof Error ? err.message : "Unable to publish asset");
    }
  };

  const navItems = useMemo(
    () => [
      { key: "overview", label: "Overview", icon: Gauge },
      { key: "campaigns", label: "Campaigns", icon: Megaphone },
      { key: "lead-sources", label: "Lead Sources", icon: Compass },
      { key: "attribution", label: "Attribution", icon: BarChart3 },
      { key: "sales-performance", label: "Sales Performance", icon: Activity },
      { key: "enablement", label: "Enablement Hub", icon: BookOpenCheck },
      { key: "forecasting", label: "Forecasting", icon: LineChart },
      { key: "reports", label: "Reports", icon: FilePlus },
      { key: "settings", label: "Settings", icon: Shield },
    ],
    []
  );

  const handleRefresh = () => {
    setRefreshToken((prev) => prev + 1);
    onRefresh?.();
  };

  const SectionShell = ({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) => (
    <div className="space-y-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overview?.metrics?.map((metric) => (
          <div key={metric.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{metric.value}</p>
            {metric.delta !== undefined && (
              <p className={`text-xs font-medium ${metric.deltaDirection === "up" ? "text-emerald-600" : "text-rose-600"}`}>
                {metric.deltaDirection === "up" ? "▲" : "▼"} {metric.delta}% vs prior period
              </p>
            )}
          </div>
        ))}
      </div>

      <SectionShell title="Revenue vs target" description="RevOps consumes CRM + Finance data in read-only mode to avoid record conflicts.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-sm text-slate-500">Current period ({overview?.revenueVsTarget.period || "TBD"})</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {overview ? currencyFormatter.format(overview.revenueVsTarget.actual) : "--"}
              <span className="text-base font-normal text-slate-500"> / {overview ? currencyFormatter.format(overview.revenueVsTarget.target) : "--"}</span>
            </p>
            <div className="mt-4 h-3 w-full rounded-full bg-slate-100">
              <div
                className="h-3 rounded-full bg-indigo-500"
                style={{ width: `${Math.min(100, overview ? (overview.revenueVsTarget.actual / Math.max(overview.revenueVsTarget.target, 1)) * 100 : 0)}%` }}
              />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <h4 className="text-sm font-semibold text-slate-900">Executive highlights</h4>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
              {overview?.executiveHighlights && overview.executiveHighlights.length > 0 ? (
                overview.executiveHighlights.map((note) => <li key={note}>{note}</li>)
              ) : (
                <li>Insights will appear once data sync completes.</li>
              )}
            </ul>
          </div>
        </div>
      </SectionShell>

      <SectionShell title="Campaign ROI" description="Campaigns remain linked to CRM opportunities via campaign_id only.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2">Campaign</th>
                <th className="pb-2">Channel</th>
                <th className="pb-2">Region</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Spend</th>
                <th className="pb-2 text-right">Revenue</th>
                <th className="pb-2 text-right">ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.length > 0 ? (
                campaigns.slice(0, 6).map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="py-3 font-medium text-slate-900">{campaign.name}</td>
                    <td className="py-3 text-slate-500">{campaign.channel}</td>
                    <td className="py-3 text-slate-500">{campaign.region}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{campaign.status.replace(/_/g, " ")}</span>
                    </td>
                    <td className="py-3 text-right text-slate-500">{currencyFormatter.format(campaign.actualSpend)}</td>
                    <td className="py-3 text-right text-slate-500">{currencyFormatter.format(campaign.revenueAttributed)}</td>
                    <td className="py-3 text-right font-semibold text-slate-900">{campaign.roi.toFixed(2)}x</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-slate-500">
                    Add a campaign to see ROI insights.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionShell>
    </div>
  );

  const renderCampaigns = () => (
    <SectionShell
      title="Campaign management"
      description="RevOps defines demand programs, budgets, and approvals without owning CRM records."
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setCampaignForm(DEFAULT_CAMPAIGN_FORM());
              setCampaignModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            <PlusIcon /> New campaign
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setLeadSourceForm(DEFAULT_LEAD_SOURCE_FORM());
              setLeadSourceModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600"
          >
            Register source
          </button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-2">Campaign</th>
              <th className="pb-2">Region</th>
              <th className="pb-2">Channel</th>
              <th className="pb-2">Budget</th>
              <th className="pb-2">Spend</th>
              <th className="pb-2">Status</th>
              <th className="pb-2 text-right">ROI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {campaigns.length > 0 ? (
              campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td className="py-3">
                    <p className="font-semibold text-slate-900">{campaign.name}</p>
                    <p className="text-xs text-slate-500">{campaign.campaignCode}</p>
                  </td>
                  <td className="py-3 text-slate-500">{campaign.branch ? `${campaign.region} • ${campaign.branch}` : campaign.region}</td>
                  <td className="py-3 text-slate-500">{campaign.channel}</td>
                  <td className="py-3 text-slate-500">{currencyFormatter.format(campaign.budget)}</td>
                  <td className="py-3 text-slate-500">{currencyFormatter.format(campaign.actualSpend)}</td>
                  <td className="py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{campaign.status.replace(/_/g, " ")}</span>
                  </td>
                  <td className="py-3 text-right font-semibold text-slate-900">{campaign.roi.toFixed(2)}x</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-slate-500">
                  No campaigns yet. Create one to unlock attribution and spend controls.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionShell>
  );

  const renderLeadSources = () => (
    <SectionShell
      title="Lead source registry"
      description="Defines where demand originates. CRM opportunities simply reference revops_lead_sources.id."
      actions={
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setLeadSourceForm(DEFAULT_LEAD_SOURCE_FORM(campaigns[0]?.id));
            setLeadSourceModalOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          <PlusIcon /> New source
        </button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-2">Source</th>
              <th className="pb-2">Channel</th>
              <th className="pb-2">Region</th>
              <th className="pb-2">Campaign</th>
              <th className="pb-2">Cost Center</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leadSources.length > 0 ? (
              leadSources.map((source) => (
                <tr key={source.id}>
                  <td className="py-3 font-semibold text-slate-900">{source.name}</td>
                  <td className="py-3 text-slate-500">{source.channel}</td>
                  <td className="py-3 text-slate-500">{source.branch ? `${source.region} • ${source.branch}` : source.region}</td>
                  <td className="py-3 text-slate-500">{campaigns.find((c) => c.id === source.campaignId)?.name ?? "Not linked"}</td>
                  <td className="py-3 text-slate-500">{source.costCenter}</td>
                  <td className="py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${source.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"}`}>
                      {source.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                  Register a source to unify attribution naming.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionShell>
  );

  const renderAttribution = () => (
    <SectionShell
      title="Revenue attribution"
      description="Supports first-touch, last-touch, and linear models without mutating CRM data."
      actions={
        <select
          value={attributionModel}
          onChange={(event) => setAttributionModel(event.target.value as AttributionModel)}
          className="rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-600"
        >
          {MODEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      }
    >
      {attribution ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatPill label="Revenue" value={currencyFormatter.format(attribution.totals.revenue)} />
            <StatPill label="Spend" value={currencyFormatter.format(attribution.totals.spend)} />
            <StatPill label="ROI" value={`${attribution.totals.roi.toFixed(2)}x`} />
            <StatPill label="Opportunities" value={String(attribution.totals.opportunities)} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">By campaign</h4>
              <ul className="mt-3 space-y-3 text-sm">
                {attribution.campaigns.length > 0 ? (
                  attribution.campaigns.map((campaign) => (
                    <li key={campaign.campaignId} className="rounded-2xl border border-slate-100 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{campaign.name}</p>
                          <p className="text-xs text-slate-500">{campaign.influencedDeals} influenced deals</p>
                        </div>
                        <p className="font-semibold text-slate-900">{campaign.roi.toFixed(2)}x</p>
                      </div>
                    </li>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No attribution data for this model yet.</p>
                )}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">By channel</h4>
              <ul className="mt-3 space-y-3 text-sm">
                {attribution.channels.length > 0 ? (
                  attribution.channels.map((channel) => (
                    <li key={channel.channel} className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
                      <div>
                        <p className="font-semibold text-slate-900">{channel.channel}</p>
                        <p className="text-xs text-slate-500">CPA {currencyFormatter.format(channel.costPerAcquisition)}</p>
                      </div>
                      <p className="font-semibold text-slate-900">{channel.roi.toFixed(2)}x</p>
                    </li>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Awaiting channel data.</p>
                )}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Attribution summary unavailable. Confirm data syncs for CRM + Finance.</p>
      )}
    </SectionShell>
  );

  const renderSalesPerformance = () => (
    <SectionShell
      title="Sales performance"
      description="RevOps benchmarks win rates, velocity, and targets using read-only CRM snapshots."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatPill label="Win rate" value={`${Math.round((salesSnapshot?.winRate ?? 0) * 100)}%`} />
        <StatPill label="Deal velocity" value={`${salesSnapshot?.dealVelocityDays ?? 0} days`} />
        <StatPill label="Avg deal size" value={currencyFormatter.format(salesSnapshot?.avgDealSize ?? 0)} />
        <StatPill label="Pipeline coverage" value={`${salesSnapshot?.pipelineCoverage ?? 0}x`} />
      </div>
      <div className="overflow-x-auto">
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-2">Owner</th>
              <th className="pb-2">Period</th>
              <th className="pb-2">Target</th>
              <th className="pb-2">Achieved</th>
              <th className="pb-2">Attainment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {salesTargets.length > 0 ? (
              salesTargets.map((target) => (
                <tr key={target.id}>
                  <td className="py-3 font-semibold text-slate-900">{target.ownerName}</td>
                  <td className="py-3 text-slate-500">{target.period}</td>
                  <td className="py-3 text-slate-500">{currencyFormatter.format(target.targetAmount)}</td>
                  <td className="py-3 text-slate-500">{currencyFormatter.format(target.achievedAmount)}</td>
                  <td className="py-3 font-semibold text-slate-900">
                    {Math.round((target.achievedAmount / Math.max(target.targetAmount, 1)) * 100)}%
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-slate-500">
                  Targets will appear once configured in RevOps.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionShell>
  );

  const renderEnablement = () => (
    <SectionShell
      title="Enablement hub"
      description="Version-controlled collateral that CRM references via secure links."
      actions={
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setAssetForm(DEFAULT_ASSET_FORM());
            setAssetModalOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          <PlusIcon /> Publish asset
        </button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {assets.length > 0 ? (
          assets.map((asset) => (
            <div key={asset.id} className="rounded-2xl border border-slate-100 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{asset.assetType}</p>
                  <h4 className="mt-1 text-lg font-semibold text-slate-900">{asset.title}</h4>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{asset.audience}</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{asset.summary}</p>
              <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                <span>{asset.version}</span>
                <span>{asset.usageMetrics.downloads} downloads</span>
                <span>{asset.usageMetrics.crmLinks} CRM links</span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No assets yet.</p>
        )}
      </div>
    </SectionShell>
  );

  const renderForecasting = () => (
    <SectionShell title="Forecast & intelligence" description="RevOps blends CRM pipeline, historical win rates, and finance realizations.">
      {forecast ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{forecast.periodStart.slice(0, 10)} → {forecast.periodEnd.slice(0, 10)}</p>
            <h4 className="mt-2 text-3xl font-semibold text-slate-900">{currencyFormatter.format(forecast.forecastLikely)}</h4>
            <p className="text-sm text-slate-500">Low {currencyFormatter.format(forecast.forecastLow)} • High {currencyFormatter.format(forecast.forecastHigh)}</p>
            <p className="mt-3 text-sm text-slate-500">Confidence {Math.round(forecast.confidence * 100)}%</p>
          </div>
          <div className="rounded-2xl border border-slate-100 p-6">
            <h4 className="text-sm font-semibold text-slate-900">Risk alerts</h4>
            <ul className="mt-3 space-y-3 text-sm">
              {forecast.riskAlerts.map((alert) => (
                <li key={alert.id} className="flex items-start gap-3">
                  <AlertTriangle className={`mt-0.5 h-4 w-4 ${alert.severity === "high" ? "text-rose-600" : alert.severity === "medium" ? "text-amber-500" : "text-slate-400"}`} />
                  <div>
                    <p className="font-semibold text-slate-900">{alert.label}</p>
                    <p className="text-xs text-slate-500">{alert.detail ?? "Monitor closely"}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Forecast data unavailable.</p>
      )}
    </SectionShell>
  );

  const renderReports = () => (
    <SectionShell title="Dashboards & reports" description="Feeds into the global analytics workspace via read-only APIs.">
      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard icon={<Gauge className="h-5 w-5" />} title="Executive dashboard" detail="Company-wide revenue vs target, efficiency, and subsidiary comparisons." />
        <InfoCard icon={<BarChart3 className="h-5 w-5" />} title="Campaign ROI board" detail="Spend vs revenue, funnel leakage, and channel trends." />
        <InfoCard icon={<Activity className="h-5 w-5" />} title="Sales productivity" detail="Win rates, velocity, and CRM activity heatmaps." />
        <InfoCard icon={<Brain className="h-5 w-5" />} title="Forecast radar" detail="Scenario modeling, seasonality overlays, and risk scoring." />
      </div>
    </SectionShell>
  );

  const renderSettings = () => (
    <SectionShell title="Operating guardrails" description="RevOps reads CRM, Finance, and Projects data without mutating their records.">
      <div className="grid gap-4 md:grid-cols-2">
        <GuardrailCard
          title="Owns"
          bullets={[
            "Campaigns, demand sources, budgets",
            "Revenue attribution + ROI",
            "Sales targets, enablement, and executive dashboards",
          ]}
        />
        <GuardrailCard
          title="Does not own"
          bullets={[
            "Leads, contacts, accounts, opportunities",
            "Pipelines and quotes",
            "Any CRUD operations inside CRM",
          ]}
        />
        <GuardrailCard
          title="Integrations"
          bullets={[
            "CRM (read-only) for opportunities, activities, win data",
            "Finance & Accounting for payments and invoices",
            "Projects for post-sale delivery status",
            "Email / analytics APIs for campaign telemetry",
          ]}
        />
        <GuardrailCard
          title="Roles"
          bullets={[
            "Marketing / RevOps manage campaigns and attribution",
            "Sales managers view targets + enablement",
            "Finance validates cost vs revenue",
            "Executives consume dashboards",
          ]}
        />
      </div>
    </SectionShell>
  );

  const viewRenderer: Record<RevOpsView, () => React.ReactNode> = {
    overview: renderOverview,
    campaigns: renderCampaigns,
    "lead-sources": renderLeadSources,
    attribution: renderAttribution,
    "sales-performance": renderSalesPerformance,
    enablement: renderEnablement,
    forecasting: renderForecasting,
    reports: renderReports,
    settings: renderSettings,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Revenue intelligence</p>
          <h2 className="text-2xl font-semibold text-slate-900">Revenue Operations (RevOps)</h2>
          <p className="text-sm text-slate-500">Align demand, spend, and revenue without duplicating CRM data.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600"
          >
            <RefreshCcw className="h-4 w-4" /> Refresh data
          </button>
        </div>
      </div>

      {loading && <div className="rounded-3xl border border-slate-100 bg-white p-4 text-sm text-slate-500">Syncing RevOps telemetry…</div>}
      {error && (
        <FormAlert
          type="error"
          title="Error loading RevOps workspace"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-slate-100 bg-white p-4">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setView(item.key as RevOpsView)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold ${
                  view === item.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
        <section>{viewRenderer[view]()}</section>
      </div>

      {campaignModalOpen && (
        <Modal title="New campaign" onClose={() => setCampaignModalOpen(false)}>
          <form className="space-y-4" onSubmit={handleCampaignSubmit}>
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Name" value={campaignForm.name} onChange={(value) => setCampaignForm((prev) => ({ ...prev, name: value }))} required />
              <Input label="Subsidiary" value={campaignForm.subsidiary} onChange={(value) => setCampaignForm((prev) => ({ ...prev, subsidiary: value }))} />
              <Input label="Region" value={campaignForm.region} onChange={(value) => setCampaignForm((prev) => ({ ...prev, region: value }))} />
              <Input label="Branch" value={campaignForm.branch} onChange={(value) => setCampaignForm((prev) => ({ ...prev, branch: value }))} />
              <Input label="Budget" value={campaignForm.budget} onChange={(value) => setCampaignForm((prev) => ({ ...prev, budget: value }))} type="number" />
              <Select label="Channel" value={campaignForm.channel} onChange={(value) => setCampaignForm((prev) => ({ ...prev, channel: value as DemandChannel }))} options={CHANNEL_OPTIONS} />
              <Input label="Start date" type="date" value={campaignForm.startDate} onChange={(value) => setCampaignForm((prev) => ({ ...prev, startDate: value }))} />
              <Input label="End date" type="date" value={campaignForm.endDate} onChange={(value) => setCampaignForm((prev) => ({ ...prev, endDate: value }))} />
              <Select label="Attribution" value={campaignForm.attributionModel} onChange={(value) => setCampaignForm((prev) => ({ ...prev, attributionModel: value as AttributionModel }))} options={MODEL_OPTIONS} />
              <Input label="Target segments" value={campaignForm.targetSegments} onChange={(value) => setCampaignForm((prev) => ({ ...prev, targetSegments: value }))} placeholder="Enterprise, Carrier" />
            </div>
            <Textarea label="Objective" value={campaignForm.objective} onChange={(value) => setCampaignForm((prev) => ({ ...prev, objective: value }))} required />
            {formError && (
              <FormAlert
                type="error"
                title="Error"
                message={formError}
                onClose={() => setFormError(null)}
              />
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCampaignModalOpen(false)} className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">
                Cancel
              </button>
              <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                Create campaign
              </button>
            </div>
          </form>
        </Modal>
      )}

      {leadSourceModalOpen && (
        <Modal title="Register lead source" onClose={() => setLeadSourceModalOpen(false)}>
          <form className="space-y-4" onSubmit={handleLeadSourceSubmit}>
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Source name" value={leadSourceForm.name} onChange={(value) => setLeadSourceForm((prev) => ({ ...prev, name: value }))} required />
              <Select label="Channel" value={leadSourceForm.channel} onChange={(value) => setLeadSourceForm((prev) => ({ ...prev, channel: value as DemandChannel }))} options={CHANNEL_OPTIONS} />
              <Input label="Region" value={leadSourceForm.region} onChange={(value) => setLeadSourceForm((prev) => ({ ...prev, region: value }))} />
              <Input label="Branch" value={leadSourceForm.branch} onChange={(value) => setLeadSourceForm((prev) => ({ ...prev, branch: value }))} />
              <Input label="Subsidiary" value={leadSourceForm.subsidiary} onChange={(value) => setLeadSourceForm((prev) => ({ ...prev, subsidiary: value }))} />
              <Input label="Cost center" value={leadSourceForm.costCenter} onChange={(value) => setLeadSourceForm((prev) => ({ ...prev, costCenter: value }))} required />
            </div>
            <label className="block text-sm font-medium text-slate-900">
              Campaign link
              <select
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-600"
                value={leadSourceForm.campaignId}
                onChange={(event) => setLeadSourceForm((prev) => ({ ...prev, campaignId: event.target.value }))}
              >
                <option value="">Not linked</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>
            {formError && (
              <FormAlert
                type="error"
                title="Error"
                message={formError}
                onClose={() => setFormError(null)}
              />
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setLeadSourceModalOpen(false)} className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">
                Cancel
              </button>
              <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                Register
              </button>
            </div>
          </form>
        </Modal>
      )}

      {assetModalOpen && (
        <Modal title="Publish enablement asset" onClose={() => setAssetModalOpen(false)}>
          <form className="space-y-4" onSubmit={handleAssetSubmit}>
            <Input label="Title" value={assetForm.title} onChange={(value) => setAssetForm((prev) => ({ ...prev, title: value }))} required />
            <Textarea label="Summary" value={assetForm.summary} onChange={(value) => setAssetForm((prev) => ({ ...prev, summary: value }))} required />
            <Input label="Storage URL" value={assetForm.storageUrl} onChange={(value) => setAssetForm((prev) => ({ ...prev, storageUrl: value }))} required />
            <div className="grid gap-3 md:grid-cols-2">
              <Select label="Asset type" value={assetForm.assetType} onChange={(value) => setAssetForm((prev) => ({ ...prev, assetType: value as EnablementAsset["assetType"] }))} options={["deck", "playbook", "case_study", "template", "pricing"]} />
              <Select label="Audience" value={assetForm.audience} onChange={(value) => setAssetForm((prev) => ({ ...prev, audience: value as EnablementAsset["audience"] }))} options={["sales", "revops", "executive", "partner"]} />
              <Input label="Owner" value={assetForm.owner} onChange={(value) => setAssetForm((prev) => ({ ...prev, owner: value }))} />
              <Input label="Subsidiary" value={assetForm.subsidiary} onChange={(value) => setAssetForm((prev) => ({ ...prev, subsidiary: value }))} />
              <Input label="Region" value={assetForm.region} onChange={(value) => setAssetForm((prev) => ({ ...prev, region: value }))} />
              <Input label="Tags" value={assetForm.tags} onChange={(value) => setAssetForm((prev) => ({ ...prev, tags: value }))} placeholder="fiber, enterprise" />
            </div>
            {formError && (
              <FormAlert
                type="error"
                title="Error"
                message={formError}
                onClose={() => setFormError(null)}
              />
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAssetModalOpen(false)} className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">
                Cancel
              </button>
              <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                Publish asset
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const StatPill = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
    <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
  </div>
);

const InfoCard = ({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-slate-100 p-4">
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-600">{icon}</div>
    <div>
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="text-sm text-slate-500">{detail}</p>
    </div>
  </div>
);

const GuardrailCard = ({ title, bullets }: { title: string; bullets: string[] }) => (
  <div className="rounded-2xl border border-slate-100 p-4">
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    <ul className="mt-2 space-y-1 text-sm text-slate-500">
      {bullets.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

const Input = ({ label, value, onChange, type = "text", required, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string }) => (
  <label className="block text-sm font-medium text-slate-900">
    {label}
    <input
      type={type}
      value={value}
      required={required}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-600"
    />
  </label>
);

const Textarea = ({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) => (
  <label className="block text-sm font-medium text-slate-900">
    {label}
    <textarea
      value={value}
      required={required}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-600"
      rows={3}
    />
  </label>
);

const Select = ({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: ReadonlyArray<SelectOption> }) => (
  <label className="block text-sm font-medium text-slate-900">
    {label}
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-600"
    >
      {options.map((option) => {
        const optionValue = typeof option === "string" ? option : option.value;
        const optionLabel = typeof option === "string" ? option : option.label;
        return (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        );
      })}
    </select>
  </label>
);

const Modal = ({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
          ×
        </button>
      </div>
      {children}
    </div>
  </div>
);

const PlusIcon = () => <Plus className="h-4 w-4" />;
