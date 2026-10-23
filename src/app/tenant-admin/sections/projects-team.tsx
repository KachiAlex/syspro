'use client';

import React, { useState, useEffect } from 'react';
import { useCallback } from "react";
import { Plus, Trash2, Users } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Project {
  id: string;
  name: string;
}

interface TeamMember {
  id: string;
  projectId: string;
  name: string;
  email: string;
  role: 'lead' | 'member' | 'viewer';
  joinDate: string;
}

interface ProjectsTeamProps {
  projects: Project[];
  tenantSlug: string;
}

export default function ProjectsTeam({ projects, tenantSlug }: ProjectsTeamProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'member' | 'lead' | 'viewer'>('member');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);



  const fetchTeamMembers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/projects/${selectedProjectId}/team`);
      setTeamMembers(response.data?.members || []);
    } catch (err) {
      console.error('Failed to fetch team members:', err);
      setError('Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchTeamMembers();
    }
  }, [fetchTeamMembers, selectedProjectId]);

  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) return;
    try {
      const response = await apiClient.post(`/api/projects/${selectedProjectId}/team`, {
        email: newMemberEmail,
        role: newMemberRole,
        tenantSlug,
      });
      setTeamMembers([...teamMembers, response.data]);
      setNewMemberEmail('');
      setSuccess('Team member added successfully!');
      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      console.error('Failed to add team member:', err);
      setError('Failed to add team member');
      setTimeout(() => setError(null), 3500);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this team member?')) return;
    try {
      await apiClient.delete(`/api/projects/${selectedProjectId}/team/${memberId}`);
      setTeamMembers(teamMembers.filter(m => m.id !== memberId));
      setSuccess('Team member removed successfully!');
      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      console.error('Failed to remove team member:', err);
      setError('Failed to remove team member');
      setTimeout(() => setError(null), 3500);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: TeamMember['role']) => {
    try {
      await apiClient.patch(`/api/projects/${selectedProjectId}/team/${memberId}`, {
        role: newRole,
        tenantSlug,
      });
      setTeamMembers(teamMembers.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      setSuccess('Role updated successfully!');
      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      console.error('Failed to update role:', err);
      setError('Failed to update role');
      setTimeout(() => setError(null), 3500);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'lead': return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'member': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'viewer': return 'bg-theme-muted text-theme-text-primary border border-theme-border';
      default: return 'bg-theme-muted text-theme-text-primary border border-theme-border';
    }
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-sm">{success}</div>}

      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-theme-text-primary mb-2">Select Project</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-theme-text-primary focus:border-theme-accent focus:outline-none focus:ring-2 focus:ring-theme-accent/20 transition"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-theme-border bg-theme-muted p-6">
        <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Add Team Member</h3>
        <div className="flex gap-2 flex-col md:flex-row">
          <input
            type="email"
            placeholder="Enter email address..."
            value={newMemberEmail}
            onChange={(e) => setNewMemberEmail(e.target.value)}
            className="flex-1 rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-theme-text-primary placeholder-theme-text-tertiary focus:border-theme-accent focus:outline-none focus:ring-2 focus:ring-theme-accent/20 transition"
          />
          <select
            value={newMemberRole}
            onChange={(e) => setNewMemberRole(e.target.value as TeamMember['role'])}
            className="rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-theme-text-primary focus:border-theme-accent focus:outline-none focus:ring-2 focus:ring-theme-accent/20 transition"
          >
            <option value="member">Member</option>
            <option value="lead">Lead</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            onClick={handleAddMember}
            className="inline-flex items-center gap-2 rounded-lg bg-theme-accent px-4 py-2 text-sm font-semibold text-white hover:bg-theme-accent-hover transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Member
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-theme-text-secondary">Loading team members...</div>
      ) : teamMembers.length === 0 ? (
        <div className="rounded-lg border border-theme-border bg-theme-muted p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-theme-muted mx-auto mb-4">
            <Users className="w-8 h-8 text-theme-text-tertiary" />
          </div>
          <h3 className="text-lg font-semibold text-theme-text-primary mb-2">No team members yet</h3>
          <p className="text-theme-text-secondary">Add team members to collaborate on this project</p>
        </div>
      ) : (
        <div className="rounded-lg border border-theme-border bg-theme-muted overflow-hidden">
          <table className="w-full">
            <thead className="bg-theme-muted border-b border-theme-border">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-theme-text-primary">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-theme-text-primary">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-theme-text-primary">Role</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-theme-text-primary">Joined</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-theme-text-primary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {teamMembers.map(member => (
                <tr key={member.id} className="hover:bg-theme-muted transition">
                  <td className="px-6 py-4 text-sm text-theme-text-primary font-medium">{member.name}</td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{member.email}</td>
                  <td className="px-6 py-4">
                    <select
                      value={member.role}
                      onChange={(e) => handleUpdateRole(member.id, e.target.value as TeamMember['role'])}
                      className={`bg-theme-surface px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(member.role)} border cursor-pointer`}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="member">Member</option>
                      <option value="lead">Lead</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{new Date(member.joinDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-red-600 hover:text-theme-danger transition font-medium text-sm"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
