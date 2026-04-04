// Sales & Procurement Service
// Handles all API calls for sales, procurement, suppliers, and inventory

export interface SalesOrderData {
  id: string;
  orderNumber: string;
  customerId: string;
  customer: string;
  amount: number;
  status: string;
  orderDate: string;
  dueDate: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes: string;
}

export interface PurchaseOrderData {
  id: string;
  poNumber: string;
  supplierId: string;
  supplier: string;
  amount: number;
  status: string;
  poDate: string;
  dueDate: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes: string;
}

export interface SupplierData {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  paymentTerms: string;
  rating: number;
  status: string;
  totalSpend: number;
}

export interface InventoryItemData {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  reorderLevel: number;
  location: string;
  description: string;
  status: string;
}

// Mock API client - replace with actual API calls
const apiClient = {
  async post(endpoint: string, data: any) {
    console.log(`POST ${endpoint}`, data);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    return { success: true, data };
  },

  async get(endpoint: string) {
    console.log(`GET ${endpoint}`);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, data: [] };
  },

  async patch(endpoint: string, data: any) {
    console.log(`PATCH ${endpoint}`, data);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    return { success: true, data };
  },

  async delete(endpoint: string) {
    console.log(`DELETE ${endpoint}`);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    return { success: true };
  }
};

export class SalesProcurementService {
  // Sales Orders
  static async createSalesOrder(tenantSlug: string, orderData: any): Promise<SalesOrderData> {
    try {
      const response = await apiClient.post(`/sales/orders`, orderData);
      return response.data;
    } catch (error) {
      console.error('Error creating sales order:', error);
      throw error;
    }
  }

  static async getSalesOrders(tenantSlug: string): Promise<SalesOrderData[]> {
    try {
      const response = await apiClient.get(`/sales/orders`);
      return response.data;
    } catch (error) {
      console.error('Error fetching sales orders:', error);
      throw error;
    }
  }

  static async updateSalesOrder(tenantSlug: string, orderId: string, updates: any): Promise<SalesOrderData> {
    try {
      const response = await apiClient.patch(`/sales/orders/${orderId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating sales order:', error);
      throw error;
    }
  }

  static async deleteSalesOrder(tenantSlug: string, orderId: string): Promise<void> {
    try {
      await apiClient.delete(`/sales/orders/${orderId}`);
    } catch (error) {
      console.error('Error deleting sales order:', error);
      throw error;
    }
  }

  // Purchase Orders
  static async createPurchaseOrder(tenantSlug: string, orderData: any): Promise<PurchaseOrderData> {
    try {
      const response = await apiClient.post(`/purchase-orders`, orderData);
      return response.data;
    } catch (error) {
      console.error('Error creating purchase order:', error);
      throw error;
    }
  }

  static async getPurchaseOrders(tenantSlug: string): Promise<PurchaseOrderData[]> {
    try {
      const response = await apiClient.get(`/purchase-orders`);
      return response.data;
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      throw error;
    }
  }

  static async updatePurchaseOrder(tenantSlug: string, poId: string, updates: any): Promise<PurchaseOrderData> {
    try {
      const response = await apiClient.patch(`/purchase-orders/${poId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating purchase order:', error);
      throw error;
    }
  }

  static async deletePurchaseOrder(tenantSlug: string, poId: string): Promise<void> {
    try {
      await apiClient.delete(`/purchase-orders/${poId}`);
    } catch (error) {
      console.error('Error deleting purchase order:', error);
      throw error;
    }
  }

  // Suppliers
  static async createSupplier(tenantSlug: string, supplierData: any): Promise<SupplierData> {
    try {
      const response = await apiClient.post(`/suppliers`, supplierData);
      return response.data;
    } catch (error) {
      console.error('Error creating supplier:', error);
      throw error;
    }
  }

  static async getSuppliers(tenantSlug: string): Promise<SupplierData[]> {
    try {
      const response = await apiClient.get(`/suppliers`);
      return response.data;
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      throw error;
    }
  }

  static async updateSupplier(tenantSlug: string, supplierId: string, updates: any): Promise<SupplierData> {
    try {
      const response = await apiClient.patch(`/suppliers/${supplierId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating supplier:', error);
      throw error;
    }
  }

  static async deleteSupplier(tenantSlug: string, supplierId: string): Promise<void> {
    try {
      await apiClient.delete(`/suppliers/${supplierId}`);
    } catch (error) {
      console.error('Error deleting supplier:', error);
      throw error;
    }
  }

  // Inventory
  static async createInventoryItem(tenantSlug: string, itemData: any): Promise<InventoryItemData> {
    try {
      const response = await apiClient.post(`/inventory`, itemData);
      return response.data;
    } catch (error) {
      console.error('Error creating inventory item:', error);
      throw error;
    }
  }

  static async getInventoryItems(tenantSlug: string): Promise<InventoryItemData[]> {
    try {
      const response = await apiClient.get(`/inventory`);
      return response.data;
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      throw error;
    }
  }

  static async updateInventoryItem(tenantSlug: string, itemId: string, updates: any): Promise<InventoryItemData> {
    try {
      const response = await apiClient.patch(`/inventory/${itemId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating inventory item:', error);
      throw error;
    }
  }

  static async deleteInventoryItem(tenantSlug: string, itemId: string): Promise<void> {
    try {
      await apiClient.delete(`/inventory/${itemId}`);
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      throw error;
    }
  }

  // Export functionality
  static async exportSalesOrders(tenantSlug: string, filters?: any): Promise<Blob> {
    try {
      const response = await apiClient.post(`/sales/orders/export`, filters);
      // Convert response to blob for download
      return new Blob([JSON.stringify(response.data)], { type: 'application/json' });
    } catch (error) {
      console.error('Error exporting sales orders:', error);
      throw error;
    }
  }

  static async exportPurchaseOrders(tenantSlug: string, filters?: any): Promise<Blob> {
    try {
      const response = await apiClient.post(`/purchase-orders/export`, filters);
      return new Blob([JSON.stringify(response.data)], { type: 'application/json' });
    } catch (error) {
      console.error('Error exporting purchase orders:', error);
      throw error;
    }
  }

  static async exportInventory(tenantSlug: string, filters?: any): Promise<Blob> {
    try {
      const response = await apiClient.post(`/inventory/export`, filters);
      return new Blob([JSON.stringify(response.data)], { type: 'application/json' });
    } catch (error) {
      console.error('Error exporting inventory:', error);
      throw error;
    }
  }

  // Analytics and reporting
  static async getSalesAnalytics(tenantSlug: string, dateRange?: any): Promise<any> {
    try {
      const response = await apiClient.get(`/sales/analytics${dateRange ? `?${new URLSearchParams(dateRange)}` : ''}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching sales analytics:', error);
      throw error;
    }
  }

  static async getInventoryAnalytics(tenantSlug: string): Promise<any> {
    try {
      const response = await apiClient.get(`/inventory/analytics`);
      return response.data;
    } catch (error) {
      console.error('Error fetching inventory analytics:', error);
      throw error;
    }
  }

  static async getSupplierAnalytics(tenantSlug: string): Promise<any> {
    try {
      const response = await apiClient.get(`/suppliers/analytics`);
      return response.data;
    } catch (error) {
      console.error('Error fetching supplier analytics:', error);
      throw error;
    }
  }
}
