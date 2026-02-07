"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "@/lib/use-form";
import { TextInput, FormButton, FormAlert } from "@/components/form";

type AccessControl = {
  id: string;
  roleId: string;
  roleName: string;
  moduleAccess: { module: string; read: boolean; write: boolean; admin: boolean }[];
  tempGrants?: { grantId: string; module: string; expiresAt: string }[];
  createdAt: string;
};

const MODULE_INFO: Record<string, { label: string; description: string; icon: string }> = {
  crm: {
    label: "Sales & CRM",
    description: "Manage customer relationships, leads, and sales opportunities",
    icon: "👥",
  },
  finance: {
    label: "Finance & Accounting",
    description: "Handle invoices, budgets, financial reports, and accounting",
    icon: "💰",
  },
  people: {
    label: "People & HR",
    description: "Manage employees, attendance, payroll, and team information",
    icon: "👨‍💼",
  },
  projects: {
    label: "Projects",
    description: "Plan and track projects, timelines, and team assignments",
    icon: "📊",
  },
  billing: {
    label: "Billing & Invoicing",
    description: "Create invoices, manage billing, and track payments",
    icon: "🧾",
  },
  integrations: {
    label: "Integrations & Security",
    description: "Configure integrations, manage API keys, and security settings",
    icon: "⚙️",
  },
};

const ROLE_TEMPLATES = [
  {
    id: "viewer",
    name: "Viewer",
    description: "Read-only access to view data",
    permissions: { crm: "read", finance: "read", people: "read", projects: "read", billing: "read", integrations: "none" },
    color: "bg-blue-50 border-blue-200",
  },
  {
    id: "editor",
    name: "Editor",
    description: "Can view and edit data in most areas",
    permissions: { crm: "write", finance: "write", people: "write", projects: "write", billing: "write", integrations: "none" },
    color: "bg-green-50 border-green-200",
  },
  {
    id: "manager",
    name: "Manager",
    description: "Full access including admin capabilities",
    permissions: { crm: "admin", finance: "admin", people: "admin", projects: "admin", billing: "admin", integrations: "none" },
    color: "bg-purple-50 border-purple-200",
  },
  {
    id: "admin",
    name: "Administrator",
    description: "Full system access including all integrations",
    permissions: { crm: "admin", finance: "admin", people: "admin", projects: "admin", billing: "admin", integrations: "admin" },
    color: "bg-red-50 border-red-200",
  },
];

const accessControlSchema = z.object({
  roleName: z.string().min(1, "Role name is required").min(2, "Name must be at least 2 characters"),
});

type AccessControlFormData = z.infer<typeof accessControlSchema>;

export default function AccessControlPanel({ tenantSlug }: { tenantSlug?: string | null }) {
  const [accessControls, setAccessControls] = useState<AccessControl[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<{ module: string; read: boolean; write: boolean; admin: boolean }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editModules, setEditModules] = useState<AccessControl["moduleAccess"]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const ts = tenantSlug ?? "kreatix-default";

  const form = useForm<AccessControlFormData>({
    initialValues: {
      roleName: "",
    },
    schema: accessControlSchema,
  });

  async function load() {
    setLoading(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/tenant/access-control?tenantSlug=${encodeURIComponent(ts)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load permissions");
      const payload = await res.json();
      setAccessControls(Array.isArray(payload.accessControls) ? payload.accessControls : []);
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [ts]);

  function applyTemplate(templateId: string) {
    const template = ROLE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    const modules = Object.entries(template.permissions).map(([module, perm]) => ({
      module,
      read: perm === "read" || perm === "write" || perm === "admin",
      write: perm === "write" || perm === "admin",
      admin: perm === "admin",
    }));

    setSelectedModules(modules);
    setSelectedTemplate(templateId);
    form.setFieldValue("roleName", template.name);
  }

  function toggleModulePermission(module: string, permission: "read" | "write" | "admin") {
    setSelectedTemplate(null);
    setSelectedModules((prev) => {
      const existing = prev.find((m) => m.module === module);
      if (existing) {
        return prev.map((m) => (m.module === module ? { ...m, [permission]: !m[permission] } : m));
      } else {
        return [...prev, { module, read: permission === "read", write: permission === "write", admin: permission === "admin" }];
      }
    });
  }

  function toggleEditModulePermission(module: string, permission: "read" | "write" | "admin") {
    setEditModules((prev) => {
      const existing = prev.find((m) => m.module === module);
      if (existing) {
        return prev.map((m) => (m.module === module ? { ...m, [permission]: !m[permission] } : m));
      } else {
        return [...prev, { module, read: permission === "read", write: permission === "write", admin: permission === "admin" }];
      }
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const errors = form.validate();
    if (errors.length > 0) return;

    try {
      const payload = { roleName: form.values.roleName.trim(), moduleAccess: selectedModules };
      const res = await fetch(`/api/tenant/access-control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create role");
      form.resetForm();
      setSelectedModules([]);
      setSelectedTemplate(null);
      setShowCreateForm(false);
      setSuccessMessage("Role created successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      await load();
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    }
  }

  function startEdit(ac: AccessControl) {
    setEditingId(ac.id);
    setEditModules([...ac.moduleAccess]);
  }

  async function saveEdit(id: string) {
    try {
      const payload = { moduleAccess: editModules };
      const res = await fetch(`/api/tenant/access-control/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update role");
      setEditingId(null);
      setSuccessMessage("Role updated successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      await load();
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditModules([]);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this role? Users with this role will lose their access.")) return;
    try {
      const res = await fetch(`/api/tenant/access-control/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete role");
      setSuccessMessage("Role deleted successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      await load();
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    }
  }

  const MODULES = Object.keys(MODULE_INFO);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">People & Access</p>
            <h2 className="text-2xl font-semibold text-slate-900">Team Permissions</h2>
            <p className="mt-2 text-sm text-slate-600">
              Define what team members can do in different areas of the system. Assign roles to control access to CRM, Finance, People Management, Projects, and more.
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              setSelectedTemplate(null);
              form.resetForm();
              setSelectedModules([]);
            }}
            className="whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showCreateForm ? "Cancel" : "+ Create Role"}
          </button>
        </div>

        {serverError && (
          <FormAlert
            type="error"
            title="Error"
            message={serverError}
            onClose={() => setServerError(null)}
          />
        )}
        {successMessage && (
          <FormAlert
            type="success"
            message={successMessage}
            onClose={() => setSuccessMessage(null)}
          />
        )}

        {/* Create Form Section */}
        {showCreateForm && (
          <form className="mt-6 space-y-6 border-t pt-6" onSubmit={handleCreate}>
            <div>
              <h3 className="mb-4 text-base font-semibold text-slate-900">Step 1: Start with a template (optional)</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {ROLE_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template.id)}
                    className={`rounded-lg border-2 p-3 text-left transition-all ${
                      selectedTemplate === template.id
                        ? `${template.color} border-current shadow-md`
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <p className="font-semibold text-slate-900">{template.name}</p>
                    <p className="text-xs text-slate-600">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="mb-4 text-base font-semibold text-slate-900">Step 2: Role details</h3>
              <TextInput
                label="Role Name"
                placeholder="e.g., Sales Manager, Finance Lead"
                required
                {...form.getFieldProps("roleName")}
                error={form.errorMap.roleName}
                hint="Give this role a descriptive name"
              />
            </div>

            <div className="border-t pt-4">
              <h3 className="mb-4 text-base font-semibold text-slate-900">Step 3: Choose permissions for each area</h3>
              <p className="mb-4 text-sm text-slate-600">
                {selectedTemplate
                  ? "Customize the template below or keep these settings"
                  : "Select what this role can do in each area of the system"}
              </p>

              <div className="space-y-4">
                {MODULES.map((mod) => {
                  const info = MODULE_INFO[mod];
                  const selected = selectedModules.find((m) => m.module === mod);
                  return (
                    <div key={mod} className="rounded-lg border border-slate-200 p-4">
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {info.icon} {info.label}
                          </p>
                          <p className="text-xs text-slate-600">{info.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected?.read ?? false}
                            onChange={() => toggleModulePermission(mod, "read")}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className="text-sm font-medium text-slate-700">View</span>
                          <span className="text-xs text-slate-500">(read-only)</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected?.write ?? false}
                            onChange={() => toggleModulePermission(mod, "write")}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className="text-sm font-medium text-slate-700">Edit</span>
                          <span className="text-xs text-slate-500">(create & modify)</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected?.admin ?? false}
                            onChange={() => toggleModulePermission(mod, "admin")}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className="text-sm font-medium text-slate-700">Manage</span>
                          <span className="text-xs text-slate-500">(admin access)</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 border-t pt-4">
              <FormButton type="submit" loading={form.isSubmitting}>
                Create Role
              </FormButton>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  form.resetForm();
                  setSelectedModules([]);
                  setSelectedTemplate(null);
                }}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Existing Roles Section */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Current Roles</p>
          <h3 className="text-lg font-semibold text-slate-900">Manage your team roles</h3>
        </div>

        {loading ? (
          <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-600">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"></div>
            <p className="mt-2">Loading roles…</p>
          </div>
        ) : (accessControls ?? []).length === 0 ? (
          <div className="rounded-lg bg-blue-50 p-4 text-center text-sm">
            <p className="font-medium text-blue-900">No roles created yet</p>
            <p className="mt-1 text-blue-700">Create your first role to define team permissions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accessControls.map((ac) => (
              <div key={ac.id} className={`rounded-lg border transition-all ${editingId === ac.id ? "bg-slate-50 ring-2 ring-blue-200" : "border-slate-200 hover:border-slate-300"}`}>
                {editingId === ac.id ? (
                  <div className="p-4 space-y-4">
                    <div>
                      <p className="font-semibold text-slate-900 mb-2">Edit: {ac.roleName}</p>
                      <p className="text-xs text-slate-600 mb-3">Update what this role can access</p>
                    </div>

                    <div className="space-y-3">
                      {MODULES.map((mod) => {
                        const info = MODULE_INFO[mod];
                        const selected = editModules.find((m) => m.module === mod);
                        return (
                          <div key={mod} className="rounded-lg border border-slate-200 bg-white p-3">
                            <p className="mb-2 text-xs font-semibold text-slate-700">{info.icon} {info.label}</p>
                            <div className="flex flex-wrap gap-3">
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selected?.read ?? false}
                                  onChange={() => toggleEditModulePermission(mod, "read")}
                                  className="h-4 w-4 rounded border-slate-300"
                                />
                                <span className="text-xs text-slate-700">View</span>
                              </label>
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selected?.write ?? false}
                                  onChange={() => toggleEditModulePermission(mod, "write")}
                                  className="h-4 w-4 rounded border-slate-300"
                                />
                                <span className="text-xs text-slate-700">Edit</span>
                              </label>
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selected?.admin ?? false}
                                  onChange={() => toggleEditModulePermission(mod, "admin")}
                                  className="h-4 w-4 rounded border-slate-300"
                                />
                                <span className="text-xs text-slate-700">Manage</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex gap-2 border-t pt-4">
                      <button
                        onClick={() => saveEdit(ac.id)}
                        className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900">{ac.roleName}</h4>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {ac.moduleAccess.map((ma) => {
                            const info = MODULE_INFO[ma.module];
                            const perms = [
                              ma.read && "View",
                              ma.write && "Edit",
                              ma.admin && "Manage",
                            ]
                              .filter(Boolean)
                              .join(", ");
                            return (
                              <div key={ma.module} className="inline-block">
                                <p className="text-xs font-medium text-slate-700">
                                  {info.icon} {info.label}
                                </p>
                                <p className="text-xs text-slate-500">{perms || "No access"}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(ac)}
                          className="rounded-full border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(ac.id)}
                          className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Permission Guide */}
      <div className="rounded-3xl border border-slate-100 bg-gradient-to-br from-blue-50 to-slate-50 p-6 shadow-sm">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Quick Reference</p>
          <h3 className="text-lg font-semibold text-slate-900">Understanding Permissions</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-white p-3">
            <p className="font-semibold text-blue-900">👁️ View</p>
            <p className="mt-1 text-xs text-slate-600">Can see and read information in this area</p>
          </div>
          <div className="rounded-lg bg-white p-3">
            <p className="font-semibold text-green-900">✏️ Edit</p>
            <p className="mt-1 text-xs text-slate-600">Can create new records and modify existing ones</p>
          </div>
          <div className="rounded-lg bg-white p-3">
            <p className="font-semibold text-purple-900">⚙️ Manage</p>
            <p className="mt-1 text-xs text-slate-600">Full admin access including deletion and configuration</p>
          </div>
        </div>
      </div>
    </div>
  );
}
