'use client';

import React, { useState } from 'react';
import { Plus, Eye, Edit, Trash2, Download, Filter, Package, AlertCircle, TrendingUp, Archive } from 'lucide-react';
import { 
  CreateProductModal, 
  ViewProductModal, 
  AdjustStockModal,
  ImportInventoryModal 
} from './inventory-modals';

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
  description?: string;
}

export default function Inventory({ tenantSlug }: { tenantSlug: string }) {
  const [products, setProducts] = useState<Product[]>([
    {
      id: '1',
      sku: 'PROD-001',
      name: 'Laptop Computer',
      category: 'Electronics',
      quantity: 42,
      unitCost: 450.00,
      salePrice: 899.99,
      reorderLevel: 10,
      supplier: 'Tech Solutions Inc',
      description: 'High-performance laptop'
    },
    {
      id: '2',
      sku: 'PROD-002',
      name: 'Office Chair',
      category: 'Furniture',
      quantity: 18,
      unitCost: 150.00,
      salePrice: 299.99,
      reorderLevel: 5,
      supplier: 'Furniture Ltd',
      description: 'Ergonomic office chair'
    }
  ]);

  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();

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

  const handleCreateProduct = (data: any) => {
    const newProduct: Product = {
      id: Date.now().toString(),
      ...data,
      quantity: parseInt(data.quantity),
      unitCost: parseFloat(data.unitCost),
      salePrice: parseFloat(data.salePrice),
      reorderLevel: parseInt(data.reorderLevel),
    };
    setProducts([...products, newProduct]);
  };

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setShowViewModal(true);
  };

  const handleAdjustStock = (product: Product) => {
    setSelectedProduct(product);
    setShowAdjustModal(true);
  };

  const handleSubmitAdjustment = (data: any) => {
    if (selectedProduct) {
      const newQuantity = data.adjustmentType === 'add' 
        ? selectedProduct.quantity + parseInt(data.quantity)
        : selectedProduct.quantity - parseInt(data.quantity);
      
      setProducts(products.map(p => 
        p.id === selectedProduct.id 
          ? { ...p, quantity: Math.max(0, newQuantity) }
          : p
      ));
      setShowAdjustModal(false);
    }
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const handleImport = (data: any) => {
    // Mock import functionality
    setShowImportModal(false);
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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Inventory Management</h2>
        <p className="text-gray-600">Track stock levels, manage products, and optimize inventory</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Products</p>
              <p className="text-xl font-bold text-gray-900">{totalProducts}</p>
            </div>
            <Package className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Inventory Value</p>
              <p className="text-xl font-bold text-gray-900">${totalValue.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low Stock Items</p>
              <p className="text-xl font-bold text-gray-900">{lowStockCount}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Categories</p>
              <p className="text-xl font-bold text-gray-900">{new Set(products.map(p => p.category)).size}</p>
            </div>
            <Archive className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {Array.from(new Set(products.map(p => p.category))).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select 
            value={stockStatusFilter} 
            onChange={(e) => setStockStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
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
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reorder Level</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input 
                      type="checkbox" 
                      checked={selectedProducts.has(product.id)}
                      onChange={(e) => handleSelectProduct(product.id, e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{product.sku}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{product.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{product.category}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{product.quantity}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">${product.unitCost.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{product.reorderLevel}</td>
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
                        className="text-blue-600 hover:text-blue-800"
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
      </div>

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
        onSubmit={handleImport}
      />
    </div>
  );
}
