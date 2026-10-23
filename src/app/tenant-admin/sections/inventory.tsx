'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit, Trash2, Download, Filter, Package, AlertCircle, TrendingUp, Archive, RefreshCw } from 'lucide-react';
import {
  CreateProductModal,
  ViewProductModal,
  AdjustStockModal,
} from './inventory-modals';
import ImportInventoryModal from '@/app/tenant-admin/components/ImportInventoryModal';

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unitCost: number;
  salePrice: number;
  reorderLevel: number;
  supplier: string;
  tracking?: string;
  description?: string;
}

interface SerialRow {
  id: string;
  sku: string;
  serialNo: string;
  warehouseId: string | null;
  status: string;
  updatedAt: string;
}

interface LotRow {
  id: string;
  sku: string;
  lotNo: string;
  warehouseId: string;
  qtyOnHand: number;
  expiryDate: string | null;
}

export default function Inventory({ tenantSlug }: { tenantSlug: string }) {
  const [products, setProducts] = useState<Product[]>([]);

  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [activeTab, setActiveTab] = useState<"products" | "tracking">("products");
  const [serials, setSerials] = useState<SerialRow[]>([]);
  const [lots, setLots] = useState<LotRow[]>([]);
  const [serialFilter, setSerialFilter] = useState("");
  const [traceSku, setTraceSku] = useState("");
  const [traceNo, setTraceNo] = useState("");
  const [traceResult, setTraceResult] = useState<any>(null);

  // Initialize last refreshed on mount
  useEffect(() => {
    setLastRefreshed(new Date());
  }, []);

  // Auto-dismiss alerts after 3.5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Map backend product to frontend shape
  function mapBackendProduct(raw: any): Product {
    return {
      id: raw.id,
      sku: raw.sku,
      name: raw.name,
      category: raw.category,
      quantity: typeof raw.current_stock === "number" ? raw.current_stock : (typeof raw.currentStock === "number" ? raw.currentStock : 0),
      unitCost: typeof raw.unit_cost === "number" ? raw.unit_cost : (typeof raw.unitCost === "number" ? raw.unitCost : 0),
      salePrice: typeof raw.sale_price === "number" ? raw.sale_price : (typeof raw.salePrice === "number" ? raw.salePrice : 0),
      reorderLevel: typeof raw.min_stock === "number" ? raw.min_stock : (typeof raw.minStock === "number" ? raw.minStock : 0),
      supplier: raw.supplier || "",
      tracking: raw.tracking || "none",
      description: raw.description || "",
    };
  }

  async function loadTrackingData() {
    try {
      const [sRes, lRes] = await Promise.all([
        fetch(`/api/inventory/serials?tenantSlug=${encodeURIComponent(tenantSlug)}`),
        fetch(`/api/inventory/lots?tenantSlug=${encodeURIComponent(tenantSlug)}`),
      ]);
      const s = await sRes.json().catch(() => ({}));
      const l = await lRes.json().catch(() => ({}));
      setSerials(s.serials || []);
      setLots(l.lots || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleTraceSerial() {
    if (!traceSku || !traceNo) return;
    setTraceResult(null);
    try {
      const res = await fetch(
        `/api/inventory/serials?tenantSlug=${encodeURIComponent(tenantSlug)}&sku=${encodeURIComponent(traceSku)}&serialNo=${encodeURIComponent(traceNo)}`
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || "Serial not found");
        return;
      }
      setTraceResult(payload);
    } catch (err) {
      console.error(err);
      setError("Failed to trace serial");
    }
  }

  const handleSetTracking = async (product: Product, tracking: string) => {
    try {
      const res = await fetch("/api/inventory/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug, id: product.id, tracking }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to update tracking");
      await loadProducts();
      setSuccess(`Tracking set to "${tracking}" for ${product.sku}`);
    } catch (err: any) {
      setError(err.message || "Failed to update tracking");
    }
  };

  // Load products from API
  async function loadProducts() {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/products?tenantSlug=${encodeURIComponent(tenantSlug)}`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to load products");
      setProducts((payload.products || []).map(mapBackendProduct));
      setLastRefreshed(new Date());
    } catch (err) {
      console.error(err);
      setError("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  // Load on mount
  useEffect(() => {
    loadProducts();
    loadTrackingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  // Refresh inventory data
  const handleRefreshInventory = async () => {
    await loadProducts();
    await loadTrackingData();
    setSuccess("Inventory refreshed successfully");
  };

  const filteredProducts = products.filter(p => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (searchQuery && !p.sku.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (stockStatusFilter) {
      if (stockStatusFilter === 'low' && p.quantity > p.reorderLevel) return false;
      if (stockStatusFilter === 'medium' && (p.quantity <= p.reorderLevel || p.quantity > 50)) return false;
      if (stockStatusFilter === 'high' && p.quantity <= 50) return false;
      if (stockStatusFilter === 'zero' && p.quantity > 0) return false;
    }
    return true;
  });

  const handleCreateProduct = async (data: any) => {
    try {
      const res = await fetch("/api/inventory/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          name: data.name,
          sku: data.sku,
          category: data.category,
          currentStock: parseInt(data.quantity) || 0,
          minStock: parseInt(data.reorderLevel) || 0,
          unitCost: parseFloat(data.unitCost) || 0,
          salePrice: parseFloat(data.salePrice) || 0,
          supplier: data.supplier || "",
          description: data.description || "",
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to create product");
      await loadProducts();
      setSuccess("Product created successfully");
      setShowCreateModal(false);
    } catch (err) {
      console.error(err);
      setError("Failed to create product");
    }
  };

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setShowViewModal(true);
  };

  const handleAdjustStock = (product: Product) => {
    setSelectedProduct(product);
    setShowAdjustModal(true);
  };

  const handleSubmitAdjustment = async (data: any) => {
    if (!selectedProduct) return;
    try {
      const newQuantity = data.adjustmentType === 'add'
        ? selectedProduct.quantity + parseInt(data.quantity)
        : selectedProduct.quantity - parseInt(data.quantity);

      const res = await fetch("/api/inventory/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          id: selectedProduct.id,
          currentStock: Math.max(0, newQuantity),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to adjust stock");
      await loadProducts();
      setSuccess("Stock adjusted successfully");
      setShowAdjustModal(false);
    } catch (err) {
      console.error(err);
      setError("Failed to adjust stock");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`/api/inventory/products?id=${encodeURIComponent(id)}&tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to delete product");
      await loadProducts();
      setSuccess("Product deleted successfully");
    } catch (err) {
      console.error(err);
      setError("Failed to delete product");
    }
  };

  const handleImport = async (items: any[]) => {
    const res = await fetch(`/api/inventory/bulk?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || 'Failed to import items');
    await loadProducts();
    return payload;
  };

  const handleExport = () => {
    const csv = [
      ['SKU', 'Name', 'Category', 'Quantity', 'Unit Cost', 'Sale Price', 'Reorder Level', 'Supplier'],
      ...filteredProducts.map(p => [
        p.sku, p.name, p.category, p.quantity, p.unitCost, p.salePrice, p.reorderLevel, p.supplier
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleSelectProduct = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedProducts(newSelected);
  };

  const totalValue = products.reduce((sum, p) => sum + (p.quantity * p.unitCost), 0);
  const lowStockCount = products.filter(p => p.quantity <= p.reorderLevel).length;
  const totalProducts = products.length;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700 text-sm">
          {success}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-theme-text-primary mb-2">Inventory Management</h2>
          <p className="text-theme-text-secondary">Track stock levels, manage products, and optimize inventory</p>
          {lastRefreshed && (
            <p className="text-xs text-theme-text-secondary mt-1">
              Last updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          onClick={handleRefreshInventory}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-theme-border rounded-lg text-theme-text-primary hover:bg-theme-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-theme-border">
        <button
          onClick={() => setActiveTab("products")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "products"
              ? "border-theme-accent text-theme-accent"
              : "border-transparent text-theme-text-secondary hover:text-theme-text-primary"
          }`}
        >
          Products
        </button>
        <button
          onClick={() => setActiveTab("tracking")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "tracking"
              ? "border-theme-accent text-theme-accent"
              : "border-transparent text-theme-text-secondary hover:text-theme-text-primary"
          }`}
        >
          Serials &amp; Batches
        </button>
      </div>

      {activeTab === "tracking" && (
        <div className="space-y-6">
          {/* Serial trace */}
          <div className="bg-theme-muted rounded-lg border border-theme-border p-4">
            <h3 className="text-sm font-semibold text-theme-text-primary mb-3">Trace a Serial Number</h3>
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text" placeholder="SKU" value={traceSku}
                onChange={(e) => setTraceSku(e.target.value)}
                className="bg-theme-bg px-3 py-2 border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-accent text-theme-text-primary md:w-48"
              />
              <input
                type="text" placeholder="Serial number" value={traceNo}
                onChange={(e) => setTraceNo(e.target.value)}
                className="bg-theme-bg px-3 py-2 border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-accent text-theme-text-primary flex-1"
              />
              <button
                onClick={handleTraceSerial}
                className="px-4 py-2 bg-theme-accent text-white rounded-lg hover:bg-theme-accent-hover transition-colors"
              >
                Trace
              </button>
            </div>
            {traceResult?.serial && (
              <div className="mt-4 text-sm">
                <div className="flex gap-6">
                  <span>Status: <b className={traceResult.serial.status === 'in_stock' ? 'text-green-600' : 'text-theme-text-primary'}>{traceResult.serial.status}</b></span>
                  <span>Warehouse: <b>{traceResult.serial.warehouseId ?? "—"}</b></span>
                </div>
                <div className="mt-2">
                  <p className="text-theme-text-secondary mb-1">Movement history:</p>
                  <ul className="space-y-1">
                    {traceResult.movements.map((m: any) => (
                      <li key={m.id} className="text-xs text-theme-text-secondary">
                        {String(m.created_at).slice(0, 19)} · {m.movement_type} · qty {m.quantity} · {m.reference_type}/{m.reference_id}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Serials table */}
          <div className="bg-theme-muted rounded-lg border border-theme-border overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-theme-border">
              <h3 className="text-sm font-semibold text-theme-text-primary">Serial Numbers ({serials.length})</h3>
              <input
                type="text" placeholder="Filter serial…" value={serialFilter}
                onChange={(e) => setSerialFilter(e.target.value)}
                className="bg-theme-bg px-3 py-1.5 text-sm border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-accent text-theme-text-primary"
              />
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-theme-muted border-b border-theme-border sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-theme-text-secondary uppercase">Serial</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-theme-text-secondary uppercase">SKU</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-theme-text-secondary uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-theme-text-secondary uppercase">Warehouse</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {serials
                    .filter((s) => !serialFilter || s.serialNo.toLowerCase().includes(serialFilter.toLowerCase()) || s.sku.toLowerCase().includes(serialFilter.toLowerCase()))
                    .map((s) => (
                      <tr key={s.id} className="hover:bg-theme-muted">
                        <td className="px-4 py-2 text-sm font-medium text-theme-text-primary">{s.serialNo}</td>
                        <td className="px-4 py-2 text-sm text-theme-text-primary">{s.sku}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                            s.status === 'in_stock' ? 'bg-green-100 text-green-800' :
                            s.status === 'issued' ? 'bg-theme-muted text-theme-text-primary' :
                            'bg-orange-100 text-orange-800'
                          }`}>{s.status}</span>
                        </td>
                        <td className="px-4 py-2 text-sm text-theme-text-secondary">{s.warehouseId ?? "—"}</td>
                      </tr>
                    ))}
                  {serials.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-theme-text-secondary">No serial-tracked stock yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Lots table */}
          <div className="bg-theme-muted rounded-lg border border-theme-border overflow-hidden">
            <div className="p-4 border-b border-theme-border">
              <h3 className="text-sm font-semibold text-theme-text-primary">Batch / Lot Stock ({lots.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-theme-muted border-b border-theme-border">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-theme-text-secondary uppercase">Lot</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-theme-text-secondary uppercase">SKU</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-theme-text-secondary uppercase">Qty</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-theme-text-secondary uppercase">Warehouse</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-theme-text-secondary uppercase">Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {lots.map((l) => (
                    <tr key={l.id} className="hover:bg-theme-muted">
                      <td className="px-4 py-2 text-sm font-medium text-theme-text-primary">{l.lotNo}</td>
                      <td className="px-4 py-2 text-sm text-theme-text-primary">{l.sku}</td>
                      <td className="px-4 py-2 text-sm text-theme-text-primary">{l.qtyOnHand}</td>
                      <td className="px-4 py-2 text-sm text-theme-text-secondary">{l.warehouseId}</td>
                      <td className="px-4 py-2 text-sm">
                        {l.expiryDate ? (
                          <span className={`font-medium ${
                            new Date(l.expiryDate) < new Date() ? 'text-red-600' :
                            new Date(l.expiryDate) < new Date(Date.now() + 30 * 86400000) ? 'text-orange-600' :
                            'text-theme-text-primary'
                          }`}>{l.expiryDate}</span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                  {lots.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-theme-text-secondary">No batch-tracked stock yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "products" && (
      <>
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-theme-muted rounded-lg border border-theme-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-theme-text-secondary">Total Products</p>
              <p className="text-xl font-bold text-theme-text-primary">{totalProducts}</p>
            </div>
            <Package className="w-8 h-8 text-theme-accent" />
          </div>
        </div>
        <div className="bg-theme-muted rounded-lg border border-theme-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-theme-text-secondary">Inventory Value</p>
              <p className="text-xl font-bold text-theme-text-primary">${totalValue.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-theme-muted rounded-lg border border-theme-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-theme-text-secondary">Low Stock Items</p>
              <p className="text-xl font-bold text-theme-text-primary">{lowStockCount}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        <div className="bg-theme-muted rounded-lg border border-theme-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-theme-text-secondary">Categories</p>
              <p className="text-xl font-bold text-theme-text-primary">{new Set(products.map(p => p.category)).size}</p>
            </div>
            <Archive className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-theme-muted rounded-lg border border-theme-border p-4">
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-theme-accent text-white rounded-lg hover:bg-theme-accent-hover transition-colors"
          >
            <Plus className="w-4 h-4 mr-2 inline" />
            Add Product
          </button>
          <button 
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-2 inline" />
            Import
          </button>
          <button 
            onClick={handleExport}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-2 inline" />
            Export
          </button>
          {selectedProducts.size > 0 && (
            <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
              Bulk Action ({selectedProducts.size})
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-theme-muted rounded-lg border border-theme-border p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-theme-bg px-3 py-2 border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-accent text-theme-text-primary"
          >
            <option value="">All Categories</option>
            {Array.from(new Set(products.map(p => p.category))).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select 
            value={stockStatusFilter} 
            onChange={(e) => setStockStatusFilter(e.target.value)}
            className="bg-theme-bg px-3 py-2 border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-accent text-theme-text-primary"
          >
            <option value="">All Stock Levels</option>
            <option value="zero">Out of Stock</option>
            <option value="low">Low Stock</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <input 
            type="text"
            placeholder="Search by SKU or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-theme-bg flex-1 px-3 py-2 border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-accent text-theme-text-primary"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-theme-muted rounded-lg border border-theme-border overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-theme-muted rounded-lg animate-pulse">
                <div className="w-4 h-4 bg-theme-muted rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-theme-muted rounded w-20"></div>
                  <div className="h-3 bg-theme-muted rounded w-32"></div>
                </div>
                <div className="h-4 bg-theme-muted rounded w-24"></div>
                <div className="h-4 bg-theme-muted rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-theme-text-secondary mx-auto mb-4" />
            <p className="text-theme-text-secondary font-medium mb-2">No products found</p>
            <p className="text-sm text-theme-text-secondary mb-4">
              {searchQuery || categoryFilter || stockStatusFilter
                ? "Try adjusting your filters or search query"
                : "Add your first product to get started"}
            </p>
            {!searchQuery && !categoryFilter && !stockStatusFilter && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-theme-accent text-white rounded-lg hover:bg-theme-accent-hover transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Product
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-theme-muted border-b border-theme-border">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input 
                      type="checkbox" 
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
                        } else {
                          setSelectedProducts(new Set());
                        }
                      }}
                      className="bg-theme-surface rounded border-theme-border text-theme-text-primary"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Product Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Unit Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Reorder Level</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Tracking</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border">
                {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-theme-muted">
                  <td className="px-4 py-3">
                    <input 
                      type="checkbox" 
                      checked={selectedProducts.has(product.id)}
                      onChange={(e) => handleSelectProduct(product.id, e.target.checked)}
                      className="bg-theme-surface rounded border-theme-border text-theme-text-primary"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-theme-text-primary">{product.sku}</td>
                  <td className="px-4 py-3 text-sm text-theme-text-primary">{product.name}</td>
                  <td className="px-4 py-3 text-sm text-theme-text-primary">{product.category}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-theme-text-primary">{product.quantity}</td>
                  <td className="px-4 py-3 text-sm text-theme-text-primary">${product.unitCost.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-theme-text-primary">{product.reorderLevel}</td>
                  <td className="px-4 py-3">
                    <select
                      value={product.tracking ?? "none"}
                      onChange={(e) => handleSetTracking(product, e.target.value)}
                      className="text-xs bg-theme-bg border border-theme-border rounded px-1.5 py-1 text-theme-text-primary"
                    >
                      <option value="none">none</option>
                      <option value="serial">serial</option>
                      <option value="batch">batch</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      product.quantity === 0 ? 'bg-red-100 text-red-800' :
                      product.quantity <= product.reorderLevel ? 'bg-orange-100 text-orange-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {product.quantity === 0 ? 'Out of Stock' : 
                       product.quantity <= product.reorderLevel ? 'Low Stock' : 'In Stock'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleViewProduct(product)}
                        className="text-theme-accent hover:text-blue-800"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleAdjustStock(product)}
                        className="text-green-600 hover:text-green-800"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(product.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* Modals */}
      <CreateProductModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateProduct}
      />
      <ViewProductModal 
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        product={selectedProduct}
      />
      <AdjustStockModal 
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        onSubmit={handleSubmitAdjustment}
        product={selectedProduct}
      />
      <ImportInventoryModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
      />
    </div>
  );
}
