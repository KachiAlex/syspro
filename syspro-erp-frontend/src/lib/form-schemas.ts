import { z } from "zod";

// Common field schemas
const emailSchema = z.string().email("Please enter a valid email address");
const phoneSchema = z.string().regex(/^\+?[\d\s\-\(\)]+$/, "Please enter a valid phone number");
const urlSchema = z.string().url("Please enter a valid URL");
const positiveNumberSchema = z.number().min(0, "Value must be positive");
const percentageSchema = z.number().min(0, "Percentage must be at least 0").max(100, "Percentage must not exceed 100");

// User/Employee schemas
export const userSchema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters")
    .regex(/^[a-zA-Z\s\-']+$/, "Name can only contain letters, spaces, hyphens, and apostrophes"),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal("")),
  role: z.string().min(1, "Role is required"),
  department: z.string().min(1, "Department is required"),
  status: z.enum(["active", "inactive", "pending"], {
    errorMap: () => ({ message: "Please select a valid status" })
  }),
});

export const createUserSchema = userSchema.extend({
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const updateUserSchema = userSchema.partial().omit({ email: true });

// Customer/Contact schemas
export const contactSchema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters"),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal("")),
  company: z.string().min(1, "Company is required"),
  title: z.string().optional(),
  type: z.enum(["customer", "prospect", "partner", "vendor"], {
    errorMap: () => ({ message: "Please select a valid contact type" })
  }),
  segment: z.enum(["vip", "premium", "standard", "inactive"], {
    errorMap: () => ({ message: "Please select a valid segment" })
  }),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
});

// Lead schemas
export const leadSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal("")),
  company: z.string().min(1, "Company is required"),
  source: z.enum(["website", "email", "social", "referral", "cold_call", "other"], {
    errorMap: () => ({ message: "Please select a valid source" })
  }),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"], {
    errorMap: () => ({ message: "Please select a valid status" })
  }),
  score: z.number().min(0).max(100, "Score must be between 0 and 100"),
  assignedTo: z.string().optional(),
  notes: z.string().max(1000, "Notes must not exceed 1000 characters").optional(),
});

// Deal/Opportunity schemas
export const dealSchema = z.object({
  name: z.string().min(2, "Deal name must be at least 2 characters"),
  contactId: z.string().min(1, "Contact is required"),
  value: positiveNumberSchema,
  currency: z.string().default("USD"),
  stage: z.enum(["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"], {
    errorMap: () => ({ message: "Please select a valid stage" })
  }),
  probability: percentageSchema,
  expectedCloseDate: z.string().min(1, "Expected close date is required"),
  assignedTo: z.string().optional(),
  description: z.string().max(2000, "Description must not exceed 2000 characters").optional(),
});

// Invoice schemas
export const invoiceSchema = z.object({
  number: z.string().min(1, "Invoice number is required"),
  clientId: z.string().min(1, "Client is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"], {
    errorMap: () => ({ message: "Please select a valid status" })
  }),
  currency: z.string().default("USD"),
  subtotal: positiveNumberSchema,
  taxRate: percentageSchema.default(0),
  taxAmount: positiveNumberSchema.default(0),
  total: positiveNumberSchema,
  notes: z.string().max(1000, "Notes must not exceed 1000 characters").optional(),
  items: z.array(z.object({
    description: z.string().min(1, "Item description is required"),
    quantity: positiveNumberSchema,
    unitPrice: positiveNumberSchema,
    total: positiveNumberSchema,
  })).min(1, "At least one item is required"),
});

// Payment schemas
export const paymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice is required"),
  amount: positiveNumberSchema,
  paymentDate: z.string().min(1, "Payment date is required"),
  method: z.enum(["cash", "check", "credit_card", "bank_transfer", "other"], {
    errorMap: () => ({ message: "Please select a valid payment method" })
  }),
  status: z.enum(["pending", "completed", "failed", "refunded"], {
    errorMap: () => ({ message: "Please select a valid status" })
  }),
  reference: z.string().optional(),
  notes: z.string().max(500, "Notes must not exceed 500 characters").optional(),
});

// Expense schemas
export const expenseSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  amount: positiveNumberSchema,
  currency: z.string().default("USD"),
  date: z.string().min(1, "Date is required"),
  category: z.enum(["travel", "meals", "office", "supplies", "software", "training", "other"], {
    errorMap: () => ({ message: "Please select a valid category" })
  }),
  status: z.enum(["pending", "approved", "rejected", "reimbursed"], {
    errorMap: () => ({ message: "Please select a valid status" })
  }),
  submittedBy: z.string().min(1, "Submitted by is required"),
  approvedBy: z.string().optional(),
  receipt: z.string().optional(),
  notes: z.string().max(1000, "Notes must not exceed 1000 characters").optional(),
});

// Vendor schemas
export const vendorSchema = z.object({
  name: z.string().min(2, "Vendor name must be at least 2 characters"),
  email: emailSchema.optional().or(z.literal("")),
  phone: phoneSchema.optional().or(z.literal("")),
  website: urlSchema.optional().or(z.literal("")),
  category: z.enum(["supplies", "services", "software", "equipment", "consulting", "other"], {
    errorMap: () => ({ message: "Please select a valid category" })
  }),
  status: z.enum(["active", "inactive", "under_review"], {
    errorMap: () => ({ message: "Please select a valid status" })
  }),
  paymentTerms: z.string().optional(),
  taxId: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  notes: z.string().max(1000, "Notes must not exceed 1000 characters").optional(),
});

// Purchase Order schemas
export const purchaseOrderSchema = z.object({
  number: z.string().min(1, "PO number is required"),
  vendorId: z.string().min(1, "Vendor is required"),
  orderDate: z.string().min(1, "Order date is required"),
  expectedDate: z.string().min(1, "Expected delivery date is required"),
  status: z.enum(["draft", "sent", "approved", "received", "cancelled"], {
    errorMap: () => ({ message: "Please select a valid status" })
  }),
  currency: z.string().default("USD"),
  subtotal: positiveNumberSchema,
  taxRate: percentageSchema.default(0),
  taxAmount: positiveNumberSchema.default(0),
  total: positiveNumberSchema,
  notes: z.string().max(1000, "Notes must not exceed 1000 characters").optional(),
  items: z.array(z.object({
    description: z.string().min(1, "Item description is required"),
    quantity: positiveNumberSchema,
    unitPrice: positiveNumberSchema,
    total: positiveNumberSchema,
  })).min(1, "At least one item is required"),
});

// Product/Inventory schemas
export const productSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  sku: z.string().min(1, "SKU is required"),
  description: z.string().max(2000, "Description must not exceed 2000 characters").optional(),
  category: z.string().min(1, "Category is required"),
  price: positiveNumberSchema,
  cost: positiveNumberSchema.optional(),
  stock: z.number().min(0, "Stock cannot be negative"),
  minStock: z.number().min(0, "Minimum stock cannot be negative"),
  maxStock: z.number().min(0, "Maximum stock cannot be negative"),
  status: z.enum(["active", "inactive", "discontinued"], {
    errorMap: () => ({ message: "Please select a valid status" })
  }),
  weight: positiveNumberSchema.optional(),
  dimensions: z.object({
    length: positiveNumberSchema.optional(),
    width: positiveNumberSchema.optional(),
    height: positiveNumberSchema.optional(),
  }).optional(),
});

// Project schemas
export const projectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters"),
  description: z.string().max(2000, "Description must not exceed 2000 characters").optional(),
  clientId: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"], {
    errorMap: () => ({ message: "Please select a valid status" })
  }),
  priority: z.enum(["low", "medium", "high", "critical"], {
    errorMap: () => ({ message: "Please select a valid priority" })
  }),
  budget: positiveNumberSchema.optional(),
  currency: z.string().default("USD"),
  managerId: z.string().min(1, "Project manager is required"),
  teamMembers: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
}).refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
  message: "End date must be after start date",
  path: ["endDate"],
});

// Task schemas
export const taskSchema = z.object({
  title: z.string().min(2, "Task title must be at least 2 characters"),
  description: z.string().max(2000, "Description must not exceed 2000 characters").optional(),
  projectId: z.string().min(1, "Project is required"),
  assigneeId: z.string().optional(),
  status: z.enum(["todo", "in_progress", "review", "completed", "cancelled"], {
    errorMap: () => ({ message: "Please select a valid status" })
  }),
  priority: z.enum(["low", "medium", "high", "critical"], {
    errorMap: () => ({ message: "Please select a valid priority" })
  }),
  dueDate: z.string().optional(),
  estimatedHours: positiveNumberSchema.optional(),
  actualHours: positiveNumberSchema.optional(),
  tags: z.array(z.string()).optional(),
});

// Department schemas
export const departmentSchema = z.object({
  name: z.string()
    .min(2, "Department name must be at least 2 characters")
    .max(100, "Department name must not exceed 100 characters"),
  description: z.string().max(500, "Description must not exceed 500 characters").optional(),
  managerId: z.string().optional(),
  budget: positiveNumberSchema.optional(),
  parentDepartmentId: z.string().optional(),
  status: z.enum(["active", "inactive"], {
    errorMap: () => ({ message: "Please select a valid status" })
  }),
});

// Role schemas
export const roleSchema = z.object({
  name: z.string()
    .min(2, "Role name must be at least 2 characters")
    .max(100, "Role name must not exceed 100 characters"),
  description: z.string().max(500, "Description must not exceed 500 characters").optional(),
  permissions: z.array(z.string()).min(1, "At least one permission is required"),
  scope: z.enum(["tenant", "region", "branch"], {
    errorMap: () => ({ message: "Please select a valid scope" })
  }),
});

// Settings/Configuration schemas
export const settingsSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  email: emailSchema,
  phone: phoneSchema.optional(),
  website: urlSchema.optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }),
  currency: z.string().default("USD"),
  timezone: z.string().default("UTC"),
  dateFormat: z.string().default("MM/DD/YYYY"),
  language: z.string().default("en"),
});

// Export all schemas for easy importing
export const formSchemas = {
  user: userSchema,
  createUser: createUserSchema,
  updateUser: updateUserSchema,
  contact: contactSchema,
  lead: leadSchema,
  deal: dealSchema,
  invoice: invoiceSchema,
  payment: paymentSchema,
  expense: expenseSchema,
  vendor: vendorSchema,
  purchaseOrder: purchaseOrderSchema,
  product: productSchema,
  project: projectSchema,
  task: taskSchema,
  department: departmentSchema,
  role: roleSchema,
  settings: settingsSchema,
} as const;

// Type exports
export type UserFormData = z.infer<typeof userSchema>;
export type CreateUserFormData = z.infer<typeof createUserSchema>;
export type UpdateUserFormData = z.infer<typeof updateUserSchema>;
export type ContactFormData = z.infer<typeof contactSchema>;
export type LeadFormData = z.infer<typeof leadSchema>;
export type DealFormData = z.infer<typeof dealSchema>;
export type InvoiceFormData = z.infer<typeof invoiceSchema>;
export type PaymentFormData = z.infer<typeof paymentSchema>;
export type ExpenseFormData = z.infer<typeof expenseSchema>;
export type VendorFormData = z.infer<typeof vendorSchema>;
export type PurchaseOrderFormData = z.infer<typeof purchaseOrderSchema>;
export type ProductFormData = z.infer<typeof productSchema>;
export type ProjectFormData = z.infer<typeof projectSchema>;
export type TaskFormData = z.infer<typeof taskSchema>;
export type DepartmentFormData = z.infer<typeof departmentSchema>;
export type RoleFormData = z.infer<typeof roleSchema>;
export type SettingsFormData = z.infer<typeof settingsSchema>;
