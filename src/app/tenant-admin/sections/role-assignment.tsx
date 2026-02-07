"use client";

import { useState, useEffect } from "react";
import { Check, AlertCircle, Loader, ChevronDown, History } from "lucide-react";
import { FormAlert, FormButton } from "@/components/form";

interface User {
  id: string;
  email: string;
  name: string;
  roleId: string;
  isActive: boolean;
  createdAt: string;
}

interface RoleHistoryEntry {
  id: string;
  userId: string;
  userEmail: string;
  oldRoleId: string | null;
  newRoleId: string;
  assignedAt: string;
  assignedByUserId: string | null;
  assignedByEmail: string | null;
}

const ROLES = [
  {
    id: "admin",
    name: "Administrator",
    description: "Full system access",
    color: "bg-red-50 border-red-200 text-red-900",
  },
  {
    id: "manager",
    name: "Manager",
    description: "Write access to most modules",
    color: "bg-purple-50 border-purple-200 text-purple-900",
  },
  {
    id: "editor",
    name: "Editor",
    description: "Write access with restrictions",
    color: "bg-green-50 border-green-200 text-green-900",
  },
  {
    id: "viewer",
    name: "Viewer",
    description: "Read-only access",
    color: "bg-blue-50 border-blue-200 text-blue-900",
  },
];

interface Props {
  tenantSlug?: string | null;
}

export default function RoleAssignmentPanel({ tenantSlug }: Props) {
  const ts = tenantSlug ?? "kreatix-default";

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [history, setHistory] = useState<RoleHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setServerError(null);
      const response = await fetch(`/api/tenant/users?tenantSlug=${ts}`);

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Failed to fetch users"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await fetch(`/api/tenant/role-history?tenantSlug=${ts}`);

      if (!response.ok) {
        throw new Error("Failed to fetch history");
      }

      const data = await response.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error("Error fetching history:", error);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRole) {
      setServerError("Please select a user and role");
      return;
    }

    const user = users.find((u) => u.id === selectedUser);
    if (!user) {
      setServerError("User not found");
      return;
    }

    if (user.roleId === selectedRole) {
      setServerError("User already has this role");
      return;
    }

    try {
      setAssigning(true);
      setServerError(null);
      setSuccessMessage(null);

      const response = await fetch("/api/tenant/users/assign-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser,
          oldRoleId: user.roleId,
          newRoleId: selectedRole,
          tenantSlug: ts,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to assign role");
      }

      const result = await response.json();

      // Update user in list
      setUsers(
        users.map((u) =>
          u.id === selectedUser ? { ...u, roleId: selectedRole } : u
        )
      );

      setSuccessMessage(result.message || `Role assigned to ${user.name}`);
      setSelectedRole(null);
      setSelectedUser(null);

      // Refresh history
      setTimeout(() => {
        if (showHistory) {
          fetchHistory();
        }
      }, 500);
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Failed to assign role"
      );
    } finally {
      setAssigning(false);
    }
  };

  const toggleHistory = async () => {
    if (!showHistory) {
      await fetchHistory();
    }
    setShowHistory(!showHistory);
  };

  const getRoleLabel = (roleId: string) => {
    const role = ROLES.find((r) => r.id === roleId);
    return role?.name || roleId;
  };

  const getRoleColor = (roleId: string) => {
    const role = ROLES.find((r) => r.id === roleId);
    return role?.color || "bg-gray-50 border-gray-200";
  };

  return (
    <div className="space-y-6">
      {/* Assignment Section */}
      <div className="border rounded-lg p-6 bg-white">
        <h3 className="text-lg font-semibold mb-4">Assign Users to Roles</h3>

        {serverError && <FormAlert type="error" message={serverError} />}
        {successMessage && <FormAlert type="success" message={successMessage} />}

        <div className="space-y-4">
          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Select User
            </label>
            <div className="relative">
              <select
                value={selectedUser || ""}
                onChange={(e) => setSelectedUser(e.target.value)}
                disabled={loading || assigning}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg appearance-none cursor-pointer disabled:bg-gray-100"
              >
                <option value="">
                  {loading ? "Loading users..." : "Choose a user..."}
                </option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email}) - Current: {getRoleLabel(user.roleId)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Role Selection */}
          {selectedUser && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Assign New Role
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLES.map((role) => {
                  const isSelected =
                    selectedRole === role.id;
                  const isCurrent =
                    users.find((u) => u.id === selectedUser)?.roleId ===
                    role.id;

                  return (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRole(role.id)}
                      disabled={isCurrent || assigning}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-50"
                          : isCurrent
                            ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
                            : "border-gray-200 hover:border-blue-300"
                      } ${role.color}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{role.name}</div>
                          <div className="text-xs opacity-75">
                            {role.description}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 mt-0.5" />
                        )}
                        {isCurrent && (
                          <div className="text-xs bg-white px-2 py-1 rounded border border-gray-300">
                            Current
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Button */}
          {selectedUser && selectedRole && (
            <div className="pt-2">
              <FormButton
                onClick={handleAssignRole}
                disabled={assigning || loading}
                className="w-full"
              >
                {assigning ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  "Assign Role"
                )}
              </FormButton>
            </div>
          )}
        </div>
      </div>

      {/* Users List */}
      <div className="border rounded-lg p-6 bg-white">
        <h3 className="text-lg font-semibold mb-4">Users by Role</h3>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-gray-500 py-4">No users found</p>
        ) : (
          <div className="space-y-3">
            {users
              .filter((u) => u.isActive)
              .sort((a, b) => a.email.localeCompare(b.email))
              .map((user) => (
                <div
                  key={user.id}
                  className={`p-3 border rounded-lg flex items-center justify-between ${getRoleColor(user.roleId)}`}
                >
                  <div>
                    <div className="font-medium">{user.name || user.email}</div>
                    <div className="text-sm opacity-75">{user.email}</div>
                  </div>
                  <div className="text-sm font-medium px-3 py-1 bg-white rounded border border-current">
                    {getRoleLabel(user.roleId)}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* History Section */}
      <div className="border rounded-lg p-6 bg-white">
        <button
          onClick={toggleHistory}
          className="flex items-center justify-between w-full mb-4 hover:text-blue-600 transition-colors"
        >
          <div className="flex items-center gap-2">
            <History className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Role Assignment History</h3>
          </div>
          <ChevronDown
            className={`w-5 h-5 transition-transform ${showHistory ? "rotate-180" : ""}`}
          />
        </button>

        {showHistory && (
          <div className="space-y-3">
            {historyLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-gray-500 py-4">No role changes recorded</p>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 border border-gray-200 rounded-lg bg-gray-50 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{entry.userEmail}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {entry.oldRoleId ? (
                            <>
                              <span className="inline-block px-2 py-1 bg-blue-100 rounded mx-1">
                                {entry.oldRoleId}
                              </span>
                              <span>→</span>
                              <span className="inline-block px-2 py-1 bg-green-100 rounded mx-1">
                                {entry.newRoleId}
                              </span>
                            </>
                          ) : (
                            <>
                              Initial role assignment:{" "}
                              <span className="inline-block px-2 py-1 bg-green-100 rounded mx-1">
                                {entry.newRoleId}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {entry.assignedByEmail
                            ? `Assigned by ${entry.assignedByEmail}`
                            : "System assignment"}{" "}
                          · {new Date(entry.assignedAt).toLocaleDateString()} at{" "}
                          {new Date(entry.assignedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
