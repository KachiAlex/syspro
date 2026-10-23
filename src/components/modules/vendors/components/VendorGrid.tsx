'use client';

import React from 'react';
import { Building, Star, Eye, Edit } from 'lucide-react';
import { Vendor } from '../types';

interface VendorGridProps {
  vendors: Vendor[];
  onView: (vendor: Vendor) => void;
  onEdit: (vendor: Vendor) => void;
}

export const VendorGrid: React.FC<VendorGridProps> = ({
  vendors,
  onView,
  onEdit
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {vendors.map((vendor, i) => (
        <div key={i} className="bg-theme-surface rounded-lg border border-theme-border p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-theme-muted rounded-lg flex items-center justify-center">
                <Building className="w-6 h-6 text-theme-text-secondary" />
              </div>
              <div>
                <h3 className="font-semibold text-theme-text-primary">{vendor.name}</h3>
                <p className="text-sm text-theme-text-secondary">{vendor.category}</p>
              </div>
            </div>
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              vendor.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-theme-muted text-theme-text-primary'
            }`}>{vendor.status}</span>
          </div>
          
          <div className="space-y-2 mb-4 text-sm">
            <div className="flex justify-between">
              <span className="text-theme-text-secondary">Rating</span>
              <span className="font-semibold flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500 fill-current" />
                {vendor.rating}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-theme-text-secondary">Total Spend</span>
              <span className="font-semibold">{vendor.spend}</span>
            </div>
          </div>
          
          <div className="flex gap-2 pt-3 border-t">
            <button 
              onClick={() => onView(vendor)}
              className="flex-1 text-theme-accent hover:text-blue-800"
              title="View vendor"
            >
              <Eye className="w-4 h-4 inline mr-2" />
              View
            </button>
            <button 
              onClick={() => onEdit(vendor)}
              className="flex-1 text-green-600 hover:text-green-800"
              title="Edit vendor"
            >
              <Edit className="w-4 h-4 inline mr-2" />
              Edit
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
