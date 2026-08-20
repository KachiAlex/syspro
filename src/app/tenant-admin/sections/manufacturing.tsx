"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Eye, Edit, Trash2, Download, Filter, Package, Factory,
  ClipboardList, AlertTriangle, CheckCircle, XCircle, Clock,
  Play, Pause, CheckSquare, X, TrendingUp, Layers, Search
} from "lucide-react";

interface Bom {
  id: string;
  productSku: string;
  productName: string;
  revision: string;
  status: string;
  quantity: number;
  unit: string;
  description: string | null;
  lines?: BomLine[];
}

interface BomLine {
  id: string;
  componentSku: string;
  componentName: string;
  quantity: number;
  unit: string;
  componentType: string;
  scrapPercentage: number;
}

interface WorkOrder {
  id: string;
  orderNumber: string;
  productSku: string;
  productName: string;
  quantity: number;
  unit: string;
  status: string;
  priority: string;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  unitCost: number;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

interface MrpRequirement {
  componentSku: string;
  componentName: string;
  grossRequirement: number;
  onHand: number;
  netRequirement: number;
  unit: string;
  unitCost: number;
  shortage: boolean;
}

interface QualityInspection {
  id: string;
  workOrderId: string;
  inspectionNumber: string;
  inspector: string;
  result: string;
  defectsFound: number;
  unitsInspected: number;
  unitsRejected: number;
  defectTypes: string[];
  notes: string | null;
  inspectedAt: string;
}

type Tab = "bom" | "work-orders" | "mrp" | "quality" | "costing";

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-gray-100 text-gray-800",
  released: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  closed: "bg-purple-100 text-purple-800",
  cancelled: "bg-red-100 text-red-800",
  active: "bg-green-100 text-green-800",
  draft: "bg-gray-100 text-gray-800",
  deprecated: "bg-red-100 text-red-800",
};

export default function Manufacturing({ tenantSlug, initialTab }: { tenantSlug: string; initialTab?: Tab }) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "bom");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [boms, setBoms] = useState<Bom[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [mrpResults, setMrpResults] = useState<MrpRequirement[] | null>(null);
  const [inspections, setInspections] = useState<QualityInspection[]>([]);

  const [showCreateBom, setShowCreateBom] = useState(false);
  const [showCreateWo, setShowCreateWo] = useState(false);
  const [showMrpModal, setShowMrpModal] = useState(false);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [showBomDetail, setShowBomDetail] = useState<Bom | null>(null);
  const [showWoDetail, setShowWoDetail] = useState<WorkOrder | null>(null);

  const [searchQuery, setSearchQuery] = useState("");

  const ts = tenantSlug;

  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(null), 3500); return () => clearTimeout(t); }
  }, [error]);

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(null), 3500); return () => clearTimeout(t); }
  }, [success]);

  const loadBoms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/manufacturing/bom?tenantSlug=${encodeURIComponent(ts)}`);
      const payload = await res.json().catch(() => ({}));
      if (payload.success) setBoms(payload.data || []);
    } catch { setError("Failed to load BOMs"); }
    finally { setLoading(false); }
  }, [ts]);

  const loadWorkOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/manufacturing/work-orders?tenantSlug=${encodeURIComponent(ts)}`);
      const payload = await res.json().catch(() => ({}));
      if (payload.success) setWorkOrders(payload.data || []);
    } catch { setError("Failed to load work orders"); }
    finally { setLoading(false); }
  }, [ts]);

  const loadInspections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/manufacturing/quality-control?tenantSlug=${encodeURIComponent(ts)}`);
      const payload = await res.json().catch(() => ({}));
      if (payload.success) setInspections(payload.data || []);
    } catch { setError("Failed to load inspections"); }
    finally { setLoading(false); }
  }, [ts]);

  useEffect(() => {
    if (activeTab === "bom") loadBoms();
    else if (activeTab === "work-orders") loadWorkOrders();
    else if (activeTab === "quality") loadInspections();
  }, [activeTab, loadBoms, loadWorkOrders, loadInspections]);

  async function handleWoAction(id: string, action: string) {
    try {
      const res = await fetch(`/api/manufacturing/work-orders?tenantSlug=${encodeURIComponent(ts)}&id=${encodeURIComponent(id)}&action=${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await res.json().catch(() => ({}));
      if (!payload.success) throw new Error(payload.error || `Failed to ${action} work order`);
      setSuccess(`Work order ${action} successful`);
      await loadWorkOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function viewBomDetail(id: string) {
    try {
      const res = await fetch(`/api/manufacturing/bom?tenantSlug=${encodeURIComponent(ts)}&id=${encodeURIComponent(id)}`);
      const payload = await res.json().catch(() => ({}));
      if (payload.success) setShowBomDetail(payload.data);
    } catch { setError("Failed to load BOM detail"); }
  }

  async function viewWoDetail(id: string) {
    try {
      const res = await fetch(`/api/manufacturing/work-orders?tenantSlug=${encodeURIComponent(ts)}&id=${encodeURIComponent(id)}&detail=true`);
      const payload = await res.json().catch(() => ({}));
      if (payload.success) setShowWoDetail(payload.data);
    } catch { setError("Failed to load work order detail"); }
  }

  const filteredBoms = boms.filter(b =>
    !searchQuery ||
    b.productSku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.productName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWos = workOrders.filter(w =>
    !searchQuery ||
    w.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.productName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "bom", label: "Bill of Materials", icon: <Layers className="w-4 h-4" /> },
    { key: "work-orders", label: "Work Orders", icon: <Factory className="w-4 h-4" /> },
    { key: "mrp", label: "MRP", icon: <TrendingUp className="w-4 h-4" /> },
    { key: "quality", label: "Quality Control", icon: <ClipboardList className="w-4 h-4" /> },
    { key: "costing", label: "Costing", icon: <Package className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Manufacturing</h2>
        <p className="text-gray-600">Manage bills of materials, production orders, MRP, quality control, and costing</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-800 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-800 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-64"
          />
        </div>
        <div className="flex gap-2">
          {activeTab === "bom" && (
            <button onClick={() => setShowCreateBom(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> New BOM
            </button>
          )}
          {activeTab === "work-orders" && (
            <button onClick={() => setShowCreateWo(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Work Order
            </button>
          )}
          {activeTab === "mrp" && (
            <button onClick={() => setShowMrpModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2">
              <Play className="w-4 h-4" /> Run MRP
            </button>
          )}
          {activeTab === "quality" && (
            <button onClick={() => setShowInspectionModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Inspection
            </button>
          )}
          <button onClick={() => activeTab === "bom" ? loadBoms() : activeTab === "work-orders" ? loadWorkOrders() : activeTab === "quality" ? loadInspections() : null} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      ) : activeTab === "bom" ? (
        <BomTab boms={filteredBoms} onView={viewBomDetail} />
      ) : activeTab === "work-orders" ? (
        <WorkOrderTab workOrders={filteredWos} onView={viewWoDetail} onAction={handleWoAction} />
      ) : activeTab === "mrp" ? (
        <MrpTab results={mrpResults} />
      ) : activeTab === "quality" ? (
        <QualityTab inspections={inspections} />
      ) : activeTab === "costing" ? (
        <CostingTab workOrders={workOrders} />
      ) : null}

      {/* Modals */}
      {showCreateBom && <CreateBomModal tenantSlug={ts} onClose={() => setShowCreateBom(false)} onCreated={() => { setShowCreateBom(false); loadBoms(); }} />}
      {showCreateWo && <CreateWorkOrderModal tenantSlug={ts} onClose={() => setShowCreateWo(false)} onCreated={() => { setShowCreateWo(false); loadWorkOrders(); }} />}
      {showMrpModal && <RunMrpModal tenantSlug={ts} onClose={() => setShowMrpModal(false)} onResult={(reqs) => { setMrpResults(reqs); setShowMrpModal(false); }} />}
      {showInspectionModal && <CreateInspectionModal tenantSlug={ts} workOrders={workOrders} onClose={() => setShowInspectionModal(false)} onCreated={() => { setShowInspectionModal(false); loadInspections(); }} />}
      {showBomDetail && <BomDetailModal bom={showBomDetail} onClose={() => setShowBomDetail(null)} />}
      {showWoDetail && <WorkOrderDetailModal wo={showWoDetail} onClose={() => setShowWoDetail(null)} />}
    </div>
  );
}

// --- BOM Tab ---
function BomTab({ boms, onView }: { boms: Bom[]; onView: (id: string) => void }) {
  if (!boms.length) return <EmptyState icon={<Layers className="w-12 h-12" />} message="No BOMs created yet" />;
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product SKU</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revision</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {boms.map((bom) => (
            <tr key={bom.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{bom.productSku}</td>
              <td className="px-4 py-3 text-gray-700">{bom.productName}</td>
              <td className="px-4 py-3 text-gray-700">{bom.revision}</td>
              <td className="px-4 py-3 text-gray-700">{bom.quantity} {bom.unit}</td>
              <td className="px-4 py-3">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[bom.status] || "bg-gray-100"}`}>
                  {bom.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <button onClick={() => onView(bom.id)} className="text-blue-600 hover:text-blue-800 mr-3">
                  <Eye className="w-4 h-4 inline" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Work Order Tab ---
function WorkOrderTab({ workOrders, onView, onAction }: { workOrders: WorkOrder[]; onView: (id: string) => void; onAction: (id: string, action: string) => void }) {
  if (!workOrders.length) return <EmptyState icon={<Factory className="w-12 h-12" />} message="No work orders created yet" />;
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Cost</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {workOrders.map((wo) => (
            <tr key={wo.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{wo.orderNumber}</td>
              <td className="px-4 py-3 text-gray-700">{wo.productName}</td>
              <td className="px-4 py-3 text-gray-700">{wo.quantity} {wo.unit}</td>
              <td className="px-4 py-3">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[wo.status] || "bg-gray-100"}`}>
                  {wo.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                  wo.priority === "urgent" ? "bg-red-100 text-red-800" :
                  wo.priority === "high" ? "bg-orange-100 text-orange-800" :
                  wo.priority === "medium" ? "bg-yellow-100 text-yellow-800" :
                  "bg-gray-100 text-gray-800"
                }`}>{wo.priority}</span>
              </td>
              <td className="px-4 py-3 text-gray-700">{wo.totalCost > 0 ? `₦${wo.totalCost.toLocaleString()}` : "-"}</td>
              <td className="px-4 py-3">
                <button onClick={() => onView(wo.id)} className="text-blue-600 hover:text-blue-800 mr-2" title="View">
                  <Eye className="w-4 h-4 inline" />
                </button>
                {wo.status === "planned" && (
                  <button onClick={() => onAction(wo.id, "release")} className="text-green-600 hover:text-green-800 mr-2" title="Release">
                    <Play className="w-4 h-4 inline" />
                  </button>
                )}
                {wo.status === "released" && (
                  <button onClick={() => onAction(wo.id, "start")} className="text-yellow-600 hover:text-yellow-800 mr-2" title="Start">
                    <Play className="w-4 h-4 inline" />
                  </button>
                )}
                {wo.status === "in_progress" && (
                  <button onClick={() => onAction(wo.id, "complete")} className="text-green-600 hover:text-green-800 mr-2" title="Complete">
                    <CheckSquare className="w-4 h-4 inline" />
                  </button>
                )}
                {wo.status === "completed" && (
                  <button onClick={() => onAction(wo.id, "close")} className="text-purple-600 hover:text-purple-800 mr-2" title="Close">
                    <CheckCircle className="w-4 h-4 inline" />
                  </button>
                )}
                {(wo.status === "planned" || wo.status === "released") && (
                  <button onClick={() => onAction(wo.id, "cancel")} className="text-red-600 hover:text-red-800" title="Cancel">
                    <XCircle className="w-4 h-4 inline" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- MRP Tab ---
function MrpTab({ results }: { results: MrpRequirement[] | null }) {
  if (!results) return <EmptyState icon={<TrendingUp className="w-12 h-12" />} message="Run MRP to see material requirements" />;
  const shortages = results.filter(r => r.shortage);
  return (
    <div className="space-y-4">
      {shortages.length > 0 && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span className="text-sm font-medium text-red-800">
            {shortages.length} material shortage(s) detected — total shortfall value: ₦{shortages.reduce((s, r) => s + r.netRequirement * r.unitCost, 0).toLocaleString()}
          </span>
        </div>
      )}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Component SKU</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gross Req.</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">On Hand</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Req.</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {results.map((r, i) => (
              <tr key={i} className={r.shortage ? "bg-red-50" : "hover:bg-gray-50"}>
                <td className="px-4 py-3 font-medium text-gray-900">{r.componentSku}</td>
                <td className="px-4 py-3 text-gray-700">{r.componentName}</td>
                <td className="px-4 py-3 text-gray-700">{r.grossRequirement} {r.unit}</td>
                <td className="px-4 py-3 text-gray-700">{r.onHand} {r.unit}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{r.netRequirement} {r.unit}</td>
                <td className="px-4 py-3">
                  {r.shortage ? (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Shortage</span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Quality Tab ---
function QualityTab({ inspections }: { inspections: QualityInspection[] }) {
  if (!inspections.length) return <EmptyState icon={<ClipboardList className="w-12 h-12" />} message="No quality inspections recorded yet" />;
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inspection #</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inspector</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Defects</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inspected</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rejected</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {inspections.map((qi) => (
            <tr key={qi.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{qi.inspectionNumber}</td>
              <td className="px-4 py-3 text-gray-700">{qi.inspector}</td>
              <td className="px-4 py-3">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                  qi.result === "pass" ? "bg-green-100 text-green-800" :
                  qi.result === "fail" ? "bg-red-100 text-red-800" :
                  "bg-yellow-100 text-yellow-800"
                }`}>{qi.result}</span>
              </td>
              <td className="px-4 py-3 text-gray-700">{qi.defectsFound}</td>
              <td className="px-4 py-3 text-gray-700">{qi.unitsInspected}</td>
              <td className="px-4 py-3 text-gray-700">{qi.unitsRejected}</td>
              <td className="px-4 py-3 text-gray-500">{new Date(qi.inspectedAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Costing Tab ---
function CostingTab({ workOrders }: { workOrders: WorkOrder[] }) {
  const completed = workOrders.filter(w => w.status === "completed" || w.status === "closed");
  if (!completed.length) return <EmptyState icon={<Package className="w-12 h-12" />} message="No completed work orders to show costing" />;
  const totalMaterial = completed.reduce((s, w) => s + w.materialCost, 0);
  const totalLabor = completed.reduce((s, w) => s + w.laborCost, 0);
  const totalOverhead = completed.reduce((s, w) => s + w.overheadCost, 0);
  const totalCost = completed.reduce((s, w) => s + w.totalCost, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <CostCard label="Total Material Cost" value={totalMaterial} color="blue" />
        <CostCard label="Total Labor Cost" value={totalLabor} color="green" />
        <CostCard label="Total Overhead Cost" value={totalOverhead} color="purple" />
        <CostCard label="Grand Total Cost" value={totalCost} color="orange" />
      </div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Labor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Overhead</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {completed.map((wo) => (
              <tr key={wo.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{wo.orderNumber}</td>
                <td className="px-4 py-3 text-gray-700">{wo.productName}</td>
                <td className="px-4 py-3 text-gray-700">₦{wo.materialCost.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-700">₦{wo.laborCost.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-700">₦{wo.overheadCost.toLocaleString()}</td>
                <td className="px-4 py-3 font-medium text-gray-900">₦{wo.totalCost.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-700">₦{wo.unitCost.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CostCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-900 border-blue-200",
    green: "bg-green-50 text-green-900 border-green-200",
    purple: "bg-purple-50 text-purple-900 border-purple-200",
    orange: "bg-orange-50 text-orange-900 border-orange-200",
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">₦{value.toLocaleString()}</p>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-400 mb-3">
        {icon}
      </div>
      <p className="text-gray-600 text-sm">{message}</p>
    </div>
  );
}

// --- Create BOM Modal ---
function CreateBomModal({ tenantSlug, onClose, onCreated }: { tenantSlug: string; onClose: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    productSku: "", productName: "", revision: "1", quantity: "1", unit: "pcs", description: "",
  });
  const [lines, setLines] = useState([{ componentSku: "", componentName: "", quantity: "1", unit: "pcs", componentType: "raw_material" }]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.productSku || !formData.productName) { setError("Product SKU and name are required"); return; }
    if (lines.some(l => !l.componentSku || !l.componentName)) { setError("All BOM lines need SKU and name"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/manufacturing/bom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          ...formData,
          quantity: parseFloat(formData.quantity),
          lines: lines.map(l => ({ ...l, quantity: parseFloat(l.quantity) })),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!payload.success) throw new Error(payload.error || "Failed to create BOM");
      onCreated();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setLoading(false); }
  }

  return (
    <Modal title="Create New BOM" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Product SKU *" value={formData.productSku} onChange={(v) => setFormData({ ...formData, productSku: v })} />
          <Field label="Product Name *" value={formData.productName} onChange={(v) => setFormData({ ...formData, productName: v })} />
          <Field label="Revision" value={formData.revision} onChange={(v) => setFormData({ ...formData, revision: v })} />
          <Field label="Quantity" value={formData.quantity} onChange={(v) => setFormData({ ...formData, quantity: v })} type="number" />
          <Field label="Unit" value={formData.unit} onChange={(v) => setFormData({ ...formData, unit: v })} />
          <Field label="Description" value={formData.description} onChange={(v) => setFormData({ ...formData, description: v })} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-900">BOM Lines</h4>
            <button type="button" onClick={() => setLines([...lines, { componentSku: "", componentName: "", quantity: "1", unit: "pcs", componentType: "raw_material" }])}
              className="text-blue-600 text-sm flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add Line
            </button>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-5 gap-2 mb-2">
              <input placeholder="Component SKU" value={line.componentSku} onChange={(e) => { const n = [...lines]; n[i].componentSku = e.target.value; setLines(n); }} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
              <input placeholder="Component Name" value={line.componentName} onChange={(e) => { const n = [...lines]; n[i].componentName = e.target.value; setLines(n); }} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
              <input type="number" placeholder="Qty" value={line.quantity} onChange={(e) => { const n = [...lines]; n[i].quantity = e.target.value; setLines(n); }} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
              <select value={line.componentType} onChange={(e) => { const n = [...lines]; n[i].componentType = e.target.value; setLines(n); }} className="border border-gray-300 rounded px-2 py-1.5 text-sm">
                <option value="raw_material">Raw Material</option>
                <option value="subassembly">Subassembly</option>
                <option value="finished_good">Finished Good</option>
              </select>
              {lines.length > 1 && (
                <button type="button" onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Creating..." : "Create BOM"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- Create Work Order Modal ---
function CreateWorkOrderModal({ tenantSlug, onClose, onCreated }: { tenantSlug: string; onClose: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    productSku: "", productName: "", quantity: "1", unit: "pcs", priority: "medium",
    scheduledStart: "", scheduledEnd: "", notes: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.productSku || !formData.productName) { setError("Product SKU and name are required"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/manufacturing/work-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          productSku: formData.productSku,
          productName: formData.productName,
          quantity: parseFloat(formData.quantity),
          unit: formData.unit,
          priority: formData.priority,
          scheduledStart: formData.scheduledStart || undefined,
          scheduledEnd: formData.scheduledEnd || undefined,
          notes: formData.notes || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!payload.success) throw new Error(payload.error || "Failed to create work order");
      onCreated();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setLoading(false); }
  }

  return (
    <Modal title="Create New Work Order" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Product SKU *" value={formData.productSku} onChange={(v) => setFormData({ ...formData, productSku: v })} />
          <Field label="Product Name *" value={formData.productName} onChange={(v) => setFormData({ ...formData, productName: v })} />
          <Field label="Quantity" value={formData.quantity} onChange={(v) => setFormData({ ...formData, quantity: v })} type="number" />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
            <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <Field label="Scheduled Start" value={formData.scheduledStart} onChange={(v) => setFormData({ ...formData, scheduledStart: v })} type="date" />
          <Field label="Scheduled End" value={formData.scheduledEnd} onChange={(v) => setFormData({ ...formData, scheduledEnd: v })} type="date" />
        </div>
        <Field label="Notes" value={formData.notes} onChange={(v) => setFormData({ ...formData, notes: v })} textarea />
        <div className="flex justify-end gap-2 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Creating..." : "Create Work Order"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- Run MRP Modal ---
function RunMrpModal({ tenantSlug, onClose, onResult }: { tenantSlug: string; onClose: () => void; onResult: (reqs: MrpRequirement[]) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [demands, setDemands] = useState([{ productSku: "", productName: "", quantity: "1", dueDate: "" }]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (demands.some(d => !d.productSku || !d.productName)) { setError("All demands need SKU and name"); return; }
    setLoading(true); setError(null); setSuccess(null);
    try {
      const res = await fetch(`/api/manufacturing/mrp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          demands: demands.map(d => ({
            productSku: d.productSku,
            productName: d.productName,
            quantity: parseFloat(d.quantity),
            dueDate: d.dueDate || new Date().toISOString().split("T")[0],
            source: "manual",
          })),
          autoGenerateRequisitions: autoGenerate,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!payload.success) throw new Error(payload.error || "Failed to run MRP");
      onResult(payload.data?.requirements || []);
      if (payload.requisition) {
        setSuccess(`Purchase requisition ${payload.requisition.requisitionNumber} created with ${payload.requisition.itemCount} item(s), total $${payload.requisition.totalAmount.toFixed(2)}`);
      }
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setLoading(false); }
  }

  return (
    <Modal title="Run MRP Calculation" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>}
        {success && <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm">{success}</div>}
        <p className="text-sm text-gray-600">Enter demand items to calculate material requirements. BOMs will be exploded and inventory checked automatically.</p>
        {demands.map((d, i) => (
          <div key={i} className="grid grid-cols-4 gap-2">
            <input placeholder="Product SKU" value={d.productSku} onChange={(e) => { const n = [...demands]; n[i].productSku = e.target.value; setDemands(n); }} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
            <input placeholder="Product Name" value={d.productName} onChange={(e) => { const n = [...demands]; n[i].productName = e.target.value; setDemands(n); }} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
            <input type="number" placeholder="Qty" value={d.quantity} onChange={(e) => { const n = [...demands]; n[i].quantity = e.target.value; setDemands(n); }} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
            <input type="date" value={d.dueDate} onChange={(e) => { const n = [...demands]; n[i].dueDate = e.target.value; setDemands(n); }} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>
        ))}
        <button type="button" onClick={() => setDemands([...demands, { productSku: "", productName: "", quantity: "1", dueDate: "" }])}
          className="text-blue-600 text-sm flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add Demand
        </button>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)} className="rounded border-gray-300" />
          Auto-generate purchase requisitions for shortage materials
        </label>
        <div className="flex justify-end gap-2 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Running..." : "Run MRP"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- Create Inspection Modal ---
function CreateInspectionModal({ tenantSlug, workOrders, onClose, onCreated }: { tenantSlug: string; workOrders: WorkOrder[]; onClose: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    workOrderId: "", inspector: "", result: "pass", defectsFound: "0", unitsInspected: "0", unitsRejected: "0", notes: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.workOrderId || !formData.inspector) { setError("Work order and inspector are required"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/manufacturing/quality-control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          workOrderId: formData.workOrderId,
          inspector: formData.inspector,
          result: formData.result,
          defectsFound: parseInt(formData.defectsFound),
          unitsInspected: parseInt(formData.unitsInspected),
          unitsRejected: parseInt(formData.unitsRejected),
          notes: formData.notes || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!payload.success) throw new Error(payload.error || "Failed to create inspection");
      onCreated();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setLoading(false); }
  }

  return (
    <Modal title="New Quality Inspection" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Work Order *</label>
          <select value={formData.workOrderId} onChange={(e) => setFormData({ ...formData, workOrderId: e.target.value })} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="">Select work order...</option>
            {workOrders.map(wo => <option key={wo.id} value={wo.id}>{wo.orderNumber} — {wo.productName}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inspector *" value={formData.inspector} onChange={(v) => setFormData({ ...formData, inspector: v })} />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Result</label>
            <select value={formData.result} onChange={(e) => setFormData({ ...formData, result: e.target.value })} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="conditional">Conditional</option>
            </select>
          </div>
          <Field label="Defects Found" value={formData.defectsFound} onChange={(v) => setFormData({ ...formData, defectsFound: v })} type="number" />
          <Field label="Units Inspected" value={formData.unitsInspected} onChange={(v) => setFormData({ ...formData, unitsInspected: v })} type="number" />
          <Field label="Units Rejected" value={formData.unitsRejected} onChange={(v) => setFormData({ ...formData, unitsRejected: v })} type="number" />
        </div>
        <Field label="Notes" value={formData.notes} onChange={(v) => setFormData({ ...formData, notes: v })} textarea />
        <div className="flex justify-end gap-2 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Creating..." : "Create Inspection"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- BOM Detail Modal ---
function BomDetailModal({ bom, onClose }: { bom: Bom; onClose: () => void }) {
  return (
    <Modal title={`BOM: ${bom.productName}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div><span className="text-gray-500">SKU:</span> <span className="font-medium">{bom.productSku}</span></div>
          <div><span className="text-gray-500">Revision:</span> <span className="font-medium">{bom.revision}</span></div>
          <div><span className="text-gray-500">Status:</span> <span className="font-medium">{bom.status}</span></div>
          <div><span className="text-gray-500">Quantity:</span> <span className="font-medium">{bom.quantity} {bom.unit}</span></div>
          {bom.description && <div className="col-span-3"><span className="text-gray-500">Description:</span> {bom.description}</div>}
        </div>
        {bom.lines && bom.lines.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Components</h4>
            <table className="w-full text-sm border border-gray-200 rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Qty</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Scrap %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bom.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-2 font-medium">{line.componentSku}</td>
                    <td className="px-3 py-2">{line.componentName}</td>
                    <td className="px-3 py-2">{line.quantity} {line.unit}</td>
                    <td className="px-3 py-2">{line.componentType}</td>
                    <td className="px-3 py-2">{line.scrapPercentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-end pt-4">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Close</button>
        </div>
      </div>
    </Modal>
  );
}

// --- Work Order Detail Modal ---
function WorkOrderDetailModal({ wo, onClose }: { wo: any; onClose: () => void }) {
  return (
    <Modal title={`Work Order: ${wo.orderNumber}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Product:</span> <span className="font-medium">{wo.productName} ({wo.productSku})</span></div>
          <div><span className="text-gray-500">Quantity:</span> <span className="font-medium">{wo.quantity} {wo.unit}</span></div>
          <div><span className="text-gray-500">Status:</span> <span className="font-medium">{wo.status}</span></div>
          <div><span className="text-gray-500">Priority:</span> <span className="font-medium">{wo.priority}</span></div>
          <div><span className="text-gray-500">Material Cost:</span> ₦{wo.materialCost?.toLocaleString()}</div>
          <div><span className="text-gray-500">Labor Cost:</span> ₦{wo.laborCost?.toLocaleString()}</div>
          <div><span className="text-gray-500">Overhead Cost:</span> ₦{wo.overheadCost?.toLocaleString()}</div>
          <div><span className="text-gray-500">Total Cost:</span> <span className="font-bold">₦{wo.totalCost?.toLocaleString()}</span></div>
          <div><span className="text-gray-500">Unit Cost:</span> ₦{wo.unitCost?.toLocaleString()}</div>
        </div>
        {wo.operations && wo.operations.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Operations</h4>
            <table className="w-full text-sm border border-gray-200 rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Work Center</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Std Min</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {wo.operations.map((op: any) => (
                  <tr key={op.id}>
                    <td className="px-3 py-2">{op.sequence}</td>
                    <td className="px-3 py-2">{op.name}</td>
                    <td className="px-3 py-2">{op.workCenter || "-"}</td>
                    <td className="px-3 py-2">{op.standardMinutes}</td>
                    <td className="px-3 py-2">{op.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {wo.materials && wo.materials.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Materials</h4>
            <table className="w-full text-sm border border-gray-200 rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Required</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Consumed</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {wo.materials.map((mat: any) => (
                  <tr key={mat.id}>
                    <td className="px-3 py-2 font-medium">{mat.componentSku}</td>
                    <td className="px-3 py-2">{mat.componentName}</td>
                    <td className="px-3 py-2">{mat.requiredQuantity} {mat.unit}</td>
                    <td className="px-3 py-2">{mat.consumedQuantity} {mat.unit}</td>
                    <td className="px-3 py-2">{mat.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-end pt-4">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Close</button>
        </div>
      </div>
    </Modal>
  );
}

// --- Shared Modal + Field ---
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", textarea }: { label: string; value: string; onChange: (v: string) => void; type?: string; textarea?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
      )}
    </div>
  );
}
