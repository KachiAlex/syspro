'use client';

import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface FormAlertProps {
  type: 'success' | 'error';
  message: string;
  onClose: () => void;
}

function FormAlert({ type, message, onClose }: FormAlertProps) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`p-4 rounded-lg flex items-center gap-3 ${
      type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
    }`}>
      <AlertCircle className="w-5 h-5" />
      <span>{message}</span>
    </div>
  );
}

export function CreateProductModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: '',
    description: '',
    quantity: '',
    unitCost: '',
    salePrice: '',
    reorderLevel: '',
    supplier: '',
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sku || !formData.name || !formData.category || !formData.quantity) {
      setAlert({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      onSubmit(formData);
      setAlert({ type: 'success', message: 'Product created successfully!' });
      setTimeout(() => {
        setFormData({
          sku: '',
          name: '',
          category: '',
          description: '',
          quantity: '',
          unitCost: '',
          salePrice: '',
          reorderLevel: '',
          supplier: '',
        });
        onClose();
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-theme-overlay flex items-center justify-center z-50">
      <div className="bg-theme-surface rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-theme-surface border-b border-theme-border p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-theme-text-primary">Create New Product</h2>
          <button onClick={onClose} className="text-theme-text-secondary hover:text-theme-text-primary">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {alert && (
            <FormAlert
              type={alert.type}
              message={alert.message}
              onClose={() => setAlert(null)}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                SKU <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
                placeholder="e.g., PROD-001"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                Product Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
                placeholder="Product name"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                Category <span className="text-red-600">*</span>
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
                required
              >
                <option value="">Select category</option>
                <option value="electronics">Electronics</option>
                <option value="office-supplies">Office Supplies</option>
                <option value="furniture">Furniture</option>
                <option value="raw-materials">Raw Materials</option>
                <option value="finished-goods">Finished Goods</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                Supplier
              </label>
              <input
                type="text"
                name="supplier"
                value={formData.supplier}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
                placeholder="Supplier name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
              placeholder="Product description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                Initial Quantity <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
                placeholder="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                Reorder Level
              </label>
              <input
                type="number"
                name="reorderLevel"
                value={formData.reorderLevel}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                Unit Cost
              </label>
              <input
                type="number"
                name="unitCost"
                value={formData.unitCost}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                Sale Price
              </label>
              <input
                type="number"
                name="salePrice"
                value={formData.salePrice}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
                placeholder="0.00"
                step="0.01"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-theme-border">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-theme-accent text-theme-text-primary rounded-lg hover:bg-theme-accent-hover disabled:bg-theme-muted transition-colors"
            >
              {loading ? 'Creating...' : 'Create Product'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-theme-border text-theme-text-primary rounded-lg hover:bg-theme-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ViewProductModal({
  isOpen,
  onClose,
  product,
}: {
  isOpen: boolean;
  onClose: () => void;
  product?: any;
}) {
  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-theme-overlay flex items-center justify-center z-50">
      <div className="bg-theme-surface rounded-lg shadow-lg max-w-2xl w-full mx-4">
        <div className="border-b border-theme-border p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-theme-text-primary">Product Details</h2>
          <button onClick={onClose} className="text-theme-text-secondary hover:text-theme-text-primary">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-theme-text-secondary">SKU</p>
              <p className="text-lg font-medium text-theme-text-primary">{product.sku}</p>
            </div>
            <div>
              <p className="text-sm text-theme-text-secondary">Product Name</p>
              <p className="text-lg font-medium text-theme-text-primary">{product.name}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-theme-text-secondary">Category</p>
              <p className="text-lg font-medium text-theme-text-primary">{product.category}</p>
            </div>
            <div>
              <p className="text-sm text-theme-text-secondary">Current Stock</p>
              <p className="text-lg font-medium text-theme-text-primary">{product.quantity} units</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-theme-text-secondary">Unit Cost</p>
              <p className="text-lg font-medium text-theme-text-primary">${parseFloat(product.unitCost || 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-theme-text-secondary">Sale Price</p>
              <p className="text-lg font-medium text-theme-text-primary">${parseFloat(product.salePrice || 0).toFixed(2)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-theme-text-secondary">Reorder Level</p>
              <p className="text-lg font-medium text-theme-text-primary">{product.reorderLevel} units</p>
            </div>
            <div>
              <p className="text-sm text-theme-text-secondary">Supplier</p>
              <p className="text-lg font-medium text-theme-text-primary">{product.supplier || 'N/A'}</p>
            </div>
          </div>

          {product.description && (
            <div>
              <p className="text-sm text-theme-text-secondary">Description</p>
              <p className="text-theme-text-primary">{product.description}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-theme-border">
            <button className="flex-1 px-4 py-2 bg-theme-muted text-theme-text-primary rounded-lg hover:bg-theme-muted transition-colors">
              Edit Product
            </button>
            <button className="flex-1 px-4 py-2 border border-theme-border text-theme-text-primary rounded-lg hover:bg-theme-muted transition-colors">
              Delete
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-theme-accent text-theme-text-primary rounded-lg hover:bg-theme-accent-hover transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdjustStockModal({
  isOpen,
  onClose,
  onSubmit,
  product,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  product?: any;
}) {
  const [formData, setFormData] = useState({
    adjustmentType: 'add',
    quantity: '',
    reason: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.quantity || !formData.reason) {
      setAlert({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      onSubmit(formData);
      setAlert({ type: 'success', message: 'Stock adjusted successfully!' });
      setTimeout(() => {
        setFormData({ adjustmentType: 'add', quantity: '', reason: '', notes: '' });
        onClose();
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-theme-overlay flex items-center justify-center z-50">
      <div className="bg-theme-surface rounded-lg shadow-lg max-w-lg w-full mx-4">
        <div className="border-b border-theme-border p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-theme-text-primary">Adjust Stock</h2>
            <p className="text-sm text-theme-text-secondary">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-theme-text-secondary hover:text-theme-text-primary">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {alert && (
            <FormAlert
              type={alert.type}
              message={alert.message}
              onClose={() => setAlert(null)}
            />
          )}

          <div>
            <p className="text-sm text-theme-text-secondary mb-2">Current Stock</p>
            <p className="text-2xl font-bold text-theme-text-primary">{product.quantity} units</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-2">
              Adjustment Type
            </label>
            <select
              name="adjustmentType"
              value={formData.adjustmentType}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
            >
              <option value="add">Add to Stock</option>
              <option value="remove">Remove from Stock</option>
              <option value="correct">Inventory Correction</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-2">
              Quantity <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
              placeholder="0"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-2">
              Reason <span className="text-red-600">*</span>
            </label>
            <select
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
              required
            >
              <option value="">Select reason</option>
              <option value="purchase">Purchase Order</option>
              <option value="sales">Sales Order</option>
              <option value="damage">Damage/Loss</option>
              <option value="count">Physical Count</option>
              <option value="return">Customer Return</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-2">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-theme-border">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-theme-accent text-theme-text-primary rounded-lg hover:bg-theme-accent-hover disabled:bg-theme-muted transition-colors"
            >
              {loading ? 'Adjusting...' : 'Adjust Stock'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-theme-border text-theme-text-primary rounded-lg hover:bg-theme-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
