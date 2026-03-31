// Export all ERP module components for convenient importing
export { HRModule } from './hr/HRModule';
export { BillsModule } from './bills/BillsModule';
export { AccountingModule } from './accounting/AccountingModule';
export { VendorsModule } from './vendors/VendorsModule';
export { ProcurementModule } from './procurement/ProcurementModule';
export { PurchaseOrdersModule } from './purchase-orders/PurchaseOrdersModule';
export { InvoicesModule } from './invoices/InvoicesModule';

// Export types for each module
export type { HRStats, Employee, AlertMessage as HRAlertMessage } from './hr/types';
export type { Bill, BillStats, AlertMessage as BillsAlertMessage } from './bills/types';
export type { AlertMessage as AccountingAlertMessage } from './accounting/types';
export type { Vendor, AlertMessage as VendorsAlertMessage } from './vendors/types';
export type { Requisition, ProcurementMetrics, AlertMessage as ProcurementAlertMessage } from './procurement/types';
export type { PurchaseOrder, AlertMessage as POAlertMessage } from './purchase-orders/types';
export type { Invoice, AlertMessage as InvoicesAlertMessage } from './invoices/types/invoices';
