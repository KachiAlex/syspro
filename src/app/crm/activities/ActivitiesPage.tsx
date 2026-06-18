"use client";

import React, { useEffect, useState } from "react";
import { Plus, Download, Filter, Calendar, Search, X, Edit2, AlertCircle, Clock, MapPin, User } from "lucide-react";
import NewActivityModal from "./NewActivityModal";

type Activity = {
  id: string;
  type: string; // 'call', 'email', 'meeting', 'task', 'note'
  title: string;
  description?: string;
  relatedTo: string; // 'lead', 'contact', 'deal'
  relatedId: string;
  relatedName: string;
  assignedTo?: string;
  dueDate?: string;
  completedAt?: string;
  status?: string; // 'pending', 'completed', 'cancelled'
  createdAt: string;
  updatedAt: string;
};

type ViewType = "timeline" | "list";

const ACTIVITY_TYPES = ["call", "email", "meeting", "task", "note"];
const ACTIVITY_STATUSES = ["pending", "completed", "cancelled"];

const ACTIVITY_COLORS: Record<string, string> = {
  call: "bg-blue-100 text-blue-800 border-blue-200",
  email: "bg-green-100 text-green-800 border-green-200",
  meeting: "bg-purple-100 text-purple-800 border-purple-200",
  task: "bg-orange-100 text-orange-800 border-orange-200",
  note: "bg-gray-100 text-gray-800 border-gray-200",
};

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  call: "☎️",
  email: "📧",
  meeting: "👥",
  task: "✓",
  note: "📝",
};

export default function ActivitiesPage({ tenantSlug }: { tenantSlug?: string | null }) {
  const ts = tenantSlug ;
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterRelatedTo, setFilterRelatedTo] = useState<string>("all");

  // UI
  const [viewType, setViewType] = useState<ViewType>("timeline");
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const loadActivities = () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      tenantSlug: ts ?? '',
      ...(filterType !== "all" && { type: filterType }),
      ...(filterStatus !== "all" && { status: filterStatus }),
      ...(filterRelatedTo !== "all" && { relatedTo: filterRelatedTo }),
      ...(searchTerm && { search: searchTerm }),
    });

    fetch(`/api/crm/activities?${params}`)
      .then((res) => res.json())
      .then((data) => {
        const activityList = Array.isArray(data.activities) ? data.activities : [];
        setActivities(activityList.sort((a: Activity, b: Activity) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load activities");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadActivities();
  }, [ts, filterType, filterStatus, filterRelatedTo, searchTerm]);

  const handleCreateActivity = async (activityData: any) => {
    try {
      const res = await fetch("/api/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: ts,
          ...activityData,
        }),
      });

      if (res.ok) {
        setSuccess("Activity created successfully");
        setShowNewModal(false);
        loadActivities();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Failed to create activity");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating activity");
    }
  };

  const handleUpdateActivity = async (id: string, updates: Partial<Activity>) => {
    try {
      const res = await fetch(`/api/crm/activities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        setSuccess("Activity updated successfully");
        setShowEditModal(false);
        setSelectedActivity(null);
        loadActivities();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Failed to update activity");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating activity");
    }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!window.confirm("Delete this activity?")) return;

    try {
      const res = await fetch(`/api/crm/activities/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ tenantSlug: ts }),
      });

      if (res.ok) {
        setSuccess("Activity deleted successfully");
        loadActivities();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Failed to delete activity");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting activity");
    }
  };

  const handleExportActivities = () => {
    const headers = ["Type", "Title", "Related To", "Related Name", "Status", "Due Date", "Completed", "Created"];
    const data = activities.map((a) => [
      a.type.charAt(0).toUpperCase() + a.type.slice(1),
      a.title,
      a.relatedTo,
      a.relatedName,
      a.status || "pending",
      a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "-",
      a.completedAt ? new Date(a.completedAt).toLocaleDateString() : "-",
      new Date(a.createdAt).toLocaleDateString(),
    ]);

    const csv = [headers, ...data].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activities-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading && activities.length === 0) {
    return <div className="flex items-center justify-center h-96">Loading activities...</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Activities</h2>
          <p className="text-sm text-gray-600">Track all leads, contacts, and deals interactions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportActivities}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Log Activity
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            {ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            {ACTIVITY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={filterRelatedTo}
            onChange={(e) => setFilterRelatedTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Related To</option>
            <option value="lead">Leads</option>
            <option value="contact">Contacts</option>
            <option value="deal">Deals</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {activities.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No activities found</p>
        </div>
      ) : viewType === "timeline" ? (
        <div className="space-y-6">
          {activities.map((activity, index) => (
            <div key={activity.id} className="flex gap-4">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${ACTIVITY_COLORS[activity.type]}`}>
                  {ACTIVITY_ICONS[activity.type]}
                </div>
                {index < activities.length - 1 && <div className="w-0.5 h-20 bg-gray-300 my-2"></div>}
              </div>

              {/* Activity card */}
              <div className="flex-1 pt-1">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${ACTIVITY_COLORS[activity.type]}`}>
                          {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                        </span>
                        {activity.status && (
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            activity.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : activity.status === "cancelled"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}>
                            {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">{activity.title}</h3>
                      {activity.description && <p className="text-sm text-gray-600 mb-2">{activity.description}</p>}
                      <div className="flex gap-4 flex-wrap text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>
                            {activity.relatedTo.charAt(0).toUpperCase() + activity.relatedTo.slice(1)}: {activity.relatedName}
                          </span>
                        </div>
                        {activity.assignedTo && (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{activity.assignedTo}</span>
                          </div>
                        )}
                        {activity.dueDate && !activity.completedAt && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>Due: {new Date(activity.dueDate).toLocaleDateString()}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(activity.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => {
                          setSelectedActivity(activity);
                          setShowEditModal(true);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteActivity(activity.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-lg">{ACTIVITY_ICONS[activity.type]}</span>
                  <h3 className="font-semibold text-gray-900">{activity.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ACTIVITY_COLORS[activity.type]}`}>
                    {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {activity.relatedTo.charAt(0).toUpperCase() + activity.relatedTo.slice(1)}: {activity.relatedName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{new Date(activity.createdAt).toLocaleDateString()}</span>
                <button
                  onClick={() => {
                    setSelectedActivity(activity);
                    setShowEditModal(true);
                  }}
                  className="p-1 text-gray-400 hover:text-blue-600"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteActivity(activity.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showNewModal && (
        <NewActivityModal
          isEdit={false}
          onClose={() => setShowNewModal(false)}
          onSave={handleCreateActivity}
        />
      )}

      {showEditModal && selectedActivity && (
        <NewActivityModal
          isEdit={true}
          initialData={selectedActivity}
          onClose={() => {
            setShowEditModal(false);
            setSelectedActivity(null);
          }}
          onSave={(data) => handleUpdateActivity(selectedActivity.id, data)}
        />
      )}
    </div>
  );
}
