"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "@/lib/use-form";
import { TextInput, FormButton, FormAlert } from "@/components/form";
import { usePermissions, useCanAction } from "@/hooks/use-permissions";

type Role = {
  id: string;
  name: string;
  scope: "tenant" | "region" | "branch";
  permissions: string[];
  createdAt: string;
};

// Permission groups organized by module
const PERMISSION_GROUPS = {
  crm: {
    label: "Sales & CRM",
    description: "Customer relationships and opportunities",
    permissions: [
      { id: "crm.read", label: "View", description: "See CRM data" },
      { id: "crm.write", label: "Edit", description: "Create and modify CRM records" },
    ],
  },
  finance: {
    label: "Finance & Accounting",
    description: "Financial management and reporting",
    permissions: [
      { id: "finance.read", label: "View", description: "See financial data" },
      { id: "finance.write", label: "Edit", description: "Create and modify financial records" },
    ],
  },
  people: {
    label: "People & HR",
    description: "Employee and team management",
    permissions: [
      { id: "people.read", label: "View", description: "See employee information" },
      { id: "people.write", label: "Edit", description: "Manage employee records" },
    ],
  },
  billing: {
    label: "Billing & Invoicing",
    description: "Billing and payment management",
    permissions: [
      { id: "billing.read", label: "View", description: "See billing data" },
      { id: "billing.write", label: "Edit", description: "Create and modify billing records" },
    ],
  },
};

const SCOPE_INFO = {
  tenant: {
    label: "Tenant-wide",
    description: "Access applies to the entire organization",
    icon: "🏢",
  },
  region: {
    label: "Regional",
    description: "Access limited to a specific region",
    icon: "🗺️",
  },
  branch: {
    label: "Branch",
    description: "Access limited to a specific branch",
    icon: "🏪",
  },
};

const ADMIN_PERMISSION = {
  id: "all",
  label: "Full Admin Access",
  description: "Complete access to all modules and features",
};

const roleSchema = z.object({
  name: z.string().min(1, "Role name is required").min(3, "Name must be at least 3 characters"),
  scope: z.enum(["tenant", "region", "branch"]),
  permissions: z.array(z.string()).min(1, "Select at least one permission"),
});

type RoleFormData = z.infer<typeof roleSchema>;

export default function RoleBuilder({ tenantSlug }: { tenantSlug?: string | null }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const ts = tenantSlug ?? "kreatix-default";
  
  // Get user permissions
  const permissions = usePermissions();
  const { canCreate, canEdit, canDelete } = useCanAction(permissions, "admin");

  const form = useForm<RoleFormData>({
    initialValues: {
      name: "",
      scope: "tenant",
      permissions: [],
    },
    schema: roleSchema,
  });

  const [editForm, setEditForm] = useState<RoleFormData>({
    name: "",
    scope: "tenant",
    permissions: [],
  });

  async function load() {
    setLoading(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/tenant/roles?tenantSlug=${encodeURIComponent(ts)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load roles");
      const payload = await res.json();
      setRoles(Array.isArray(payload.roles) ? payload.roles : []);
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

  function togglePerm(perm: string) {
    form.setFieldValues({
      permissions: form.values.permissions.includes(perm)
        ? form.values.permissions.filter((p) => p !== perm)
        : [...form.values.permissions, perm],
    });
  }

  function toggleEditPerm(perm: string) {
    setEditForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const errors = form.validate();
    if (errors.length > 0) return;

    try {
      const payload = { name: form.values.name.trim(), scope: form.values.scope, permissions: form.values.permissions };
      const res = await fetch(`/api/tenant/roles?tenantSlug=${encodeURIComponent(ts)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create role");
      form.resetForm();
      setShowCreateForm(false);
      setServerError(null);
      setSuccessMessage("Role created successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
      await load();
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    }
  }

  function startEdit(role: Role) {
    setEditingId(role.id);
    setEditForm({
      name: role.name,
      scope: role.scope,
      permissions: Array.isArray(role.permissions) ? [...role.permissions] : [],
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({
      name: "",
      scope: "tenant",
      permissions: [],
    });
  }

  async function saveEdit(id: string) {
    try {
      const payload = { name: editForm.name.trim(), scope: editForm.scope, permissions: editForm.permissions };
      const res = await fetch(`/api/tenant/roles?id=${encodeURIComponent(id)}&type=role&tenantSlug=${encodeURIComponent(ts)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update role");
      cancelEdit();
      setSuccessMessage("Role updated successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
      await load();
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this role? Users with this role will lose access.")) return;
    try {
      const res = await fetch(`/api/tenant/roles?id=${encodeURIComponent(id)}&type=role&tenantSlug=${encodeURIComponent(ts)}`, { 
        method: "DELETE" 
      });
      if (!res.ok) throw new Error("Failed to delete role");
      setSuccessMessage("Role deleted successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
      await load();
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    }
  }

  const allModules = Object.keys(PERMISSION_GROUPS);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">People & Access</p>
            <h2 className="text-2xl font-semibold text-slate-900">Organizational Roles</h2>
            <p className="mt-2 text-sm text-slate-600">
              Create roles with specific access levels. Each role can be scoped to your organization, regions, or branches.
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              form.resetForm();
            }}
            disabled={!canCreate || permissions.loading}
            className="whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canCreate ? "You don't have permission to create roles" : undefined}
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

        {/* Create Form */}
        {showCreateForm && (
          <form className="mt-6 space-y-6 border-t pt-6" onSubmit={handleCreate}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Role Name</label>
                <input
                  {...form.getFieldProps("name")}
                  placeholder="e.g., Regional Sales Manager"
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${
                    form.errorMap.name ? "border-rose-300 bg-rose-50" : "border-slate-200"
                  }`}
                />
                {form.errorMap.name && <p className="mt-1 text-xs text-rose-600">{form.errorMap.name}</p>}
                <p className="mt-1 text-xs text-slate-500">Choose a descriptive name for this organizational role</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Scope Level</label>
                <select
                  value={form.values.scope}
                  onChange={(e) => form.setValue("scope", e.target.value as Role["scope"])}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="tenant">🏢 Tenant-wide (entire organization)</option>
                  <option value="region">🗺️ Regional (specific region only)</option>
                  <option value="branch">🏪 Branch (specific branch only)</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {SCOPE_INFO[form.values.scope as keyof typeof SCOPE_INFO].description}
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="mb-4 text-base font-semibold text-slate-900">Permissions</h3>
              
              {/* Admin Option */}
              <div className="mb-6 rounded-lg border-2 border-purple-200 bg-purple-50 p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={form.values.permissions.includes("all")}
                    onChange={() => {
                      if (form.values.permissions.includes("all")) {
                        form.setFieldValues({ permissions: [] });
                      } else {
                        form.setFieldValues({ permissions: ["all"] });
                      }
                    }}
                    className="mt-1 h-5 w-5 rounded border-slate-300"
                  />
                  <div>
                    <p className="font-semibold text-purple-900">⚡ {ADMIN_PERMISSION.label}</p>
                    <p className="text-xs text-purple-700">{ADMIN_PERMISSION.description}</p>
                  </div>
                </label>
              </div>

              {/* Module Permissions */}
              {form.values.permissions.includes("all") ? (
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-medium">Full admin access selected</p>
                  <p className="mt-1">This role has access to all modules and features.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {allModules.map((moduleKey) => {
                    const module = PERMISSION_GROUPS[moduleKey as keyof typeof PERMISSION_GROUPS];
                    return (
                      <div key={moduleKey} className="rounded-lg border border-slate-200 p-4">
                        <div className="mb-3">
                          <p className="font-semibold text-slate-900">{module.label}</p>
                          <p className="text-xs text-slate-600">{module.description}</p>
                        </div>
                        <div className="space-y-2">
                          {module.permissions.map((perm) => (
                            <label key={perm.id} className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={form.values.permissions.includes(perm.id)}
                                onChange={() => togglePerm(perm.id)}
                                className="mt-1 h-4 w-4 rounded border-slate-300"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-slate-900">{perm.label}</p>
                                <p className="text-xs text-slate-600">{perm.description}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {form.errorMap.permissions && (
                <p className="mt-2 text-xs text-rose-600">{form.errorMap.permissions}</p>
              )}
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
          <h3 className="text-lg font-semibold text-slate-900">Manage organizational roles</h3>
        </div>

        {loading ? (
          <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-600">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"></div>
            <p className="mt-2">Loading roles…</p>
          </div>
        ) : (roles ?? []).length === 0 ? (
          <div className="rounded-lg bg-blue-50 p-4 text-center text-sm">
            <p className="font-medium text-blue-900">No roles created yet</p>
            <p className="mt-1 text-blue-700">Create your first role to define organizational access levels</p>
          </div>
        ) : (
          <div className="space-y-3">
            {roles.map((role) => {
              const scopeInfo = SCOPE_INFO[role.scope as keyof typeof SCOPE_INFO];
              const isFullAdmin = role.permissions.includes("all");
              
              return (
                <div
                  key={role.id}
                  className={`rounded-lg border transition-all ${
                    editingId === role.id
                      ? "bg-slate-50 ring-2 ring-blue-200"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {editingId === role.id ? (
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Role Name</label>
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Scope</label>
                        <select
                          value={editForm.scope}
                          onChange={(e) => setEditForm({ ...editForm, scope: e.target.value as Role["scope"] })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        >
                          <option value="tenant">🏢 Tenant-wide</option>
                          <option value="region">🗺️ Regional</option>
                          <option value="branch">🏪 Branch</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Permissions</label>
                        <div className="mb-4 rounded-lg border-2 border-purple-200 bg-purple-50 p-3">
                          <label className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={editForm.permissions.includes("all")}
                              onChange={() => {
                                if (editForm.permissions.includes("all")) {
                                  setEditForm({ ...editForm, permissions: [] });
                                } else {
                                  setEditForm({ ...editForm, permissions: ["all"] });
                                }
                              }}
                              className="mt-1 h-4 w-4 rounded border-slate-300"
                            />
                            <div>
                              <p className="text-sm font-semibold text-purple-900">⚡ Full Admin Access</p>
                              <p className="text-xs text-purple-700">Complete access to all modules</p>
                            </div>
                          </label>
                        </div>

                        {!editForm.permissions.includes("all") && (
                          <div className="space-y-3">
                            {allModules.map((moduleKey) => {
                              const module = PERMISSION_GROUPS[moduleKey as keyof typeof PERMISSION_GROUPS];
                              return (
                                <div key={moduleKey} className="rounded-lg border border-slate-200 p-3">
                                  <p className="mb-2 text-xs font-semibold text-slate-900">{module.label}</p>
                                  <div className="space-y-1">
                                    {module.permissions.map((perm) => (
                                      <label key={perm.id} className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={editForm.permissions.includes(perm.id)}
                                          onChange={() => toggleEditPerm(perm.id)}
                                          className="h-4 w-4 rounded border-slate-300"
                                        />
                                        <span className="text-xs text-slate-700">{perm.label}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 border-t pt-4">
                        <button
                          onClick={() => saveEdit(role.id)}
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
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900">{role.name}</h4>
                          <p className="text-xs text-slate-600 mt-1">
                            {scopeInfo.icon} {scopeInfo.label}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(role)}
                            disabled={!canEdit || permissions.loading}
                            className="rounded-full border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!canEdit ? "You don't have permission to edit roles" : undefined}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(role.id)}
                            disabled={!canDelete || permissions.loading}
                            className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!canDelete ? "You don't have permission to delete roles" : undefined}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="mt-3">
                        {isFullAdmin ? (
                          <div className="inline-block rounded-lg bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-900">
                            ⚡ Full Admin Access
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {allModules.map((moduleKey) => {
                              const module = PERMISSION_GROUPS[moduleKey as keyof typeof PERMISSION_GROUPS];
                              const modulePerms = module.permissions.filter((p) =>
                                role.permissions.includes(p.id)
                              );
                              if (modulePerms.length === 0) return null;
                              return (
                                <div key={moduleKey} className="text-xs">
                                  <span className="font-semibold text-slate-900">{module.label}:</span>{" "}
                                  <span className="text-slate-600">{modulePerms.map((p) => p.label).join(" + ")}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Support Section */}
      <div className="rounded-3xl border border-slate-100 bg-gradient-to-br from-blue-50 to-slate-50 p-6 shadow-sm">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Scope Levels Explained</p>
          <h3 className="text-lg font-semibold text-slate-900">Which scope should you use?</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-white p-3">
            <p className="font-semibold text-slate-900">🏢 Tenant-wide</p>
            <p className="mt-1 text-xs text-slate-600">
              Access applies to all regions and branches in your organization
            </p>
          </div>
          <div className="rounded-lg bg-white p-3">
            <p className="font-semibold text-slate-900">🗺️ Regional</p>
            <p className="mt-1 text-xs text-slate-600">
              Access limited to a specific region only (useful for regional managers)
            </p>
          </div>
          <div className="rounded-lg bg-white p-3">
            <p className="font-semibold text-slate-900">🏪 Branch</p>
            <p className="mt-1 text-xs text-slate-600">
              Access limited to a specific branch only (useful for branch managers)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
