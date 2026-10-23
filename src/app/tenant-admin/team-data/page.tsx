'use client';

import React, { useState, useEffect } from 'react';
import { useCallback } from "react";
import Link from 'next/link';
import { Users, BarChart3, Settings, Plus, Search, Filter, MoreVertical, Eye, Edit, Trash2, Shield, Activity, Award, AlertTriangle } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { TeamManagement } from '../components/team-management';
import { TeamDataSubmissionPortal } from '../components/team-data-submission-portal';
import { TeamDataService } from '../services/team-data-service';
import { TeamMember, TeamAnalytics } from '../types/team-data';

export default function TeamDataPage() {
  const { tenantSlug } = useTenantContext();
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'submissions' | 'analytics'>('overview');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamAnalytics, setTeamAnalytics] = useState<TeamAnalytics[]>([]);
  const [loading, setLoading] = useState(false);
  const currentUser = useCurrentUser();



  const loadTeamData = useCallback(async () => {
    setLoading(true);
    try {
      const [members, analytics] = await Promise.all([
        TeamDataService.getTeamMembers(tenantSlug || ''),
        TeamDataService.getTeamAnalytics(tenantSlug || '')
      ]);
      
      setTeamMembers(members);
      setTeamAnalytics(analytics);
    } catch (error) {
      console.error('Failed to load team data:', error);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    if (tenantSlug) {
      loadTeamData();
    }
  }, [loadTeamData, tenantSlug]);

  const getOverallStats = () => {
    const totalMembers = teamMembers.length;
    const activeMembers = teamMembers.filter(m => m.isActive).length;
    const totalSubmissions = teamAnalytics.reduce((sum, a) => sum + a.metrics.submissionsCount, 0);
    const avgQuality = teamAnalytics.length > 0 
      ? teamAnalytics.reduce((sum, a) => sum + a.metrics.averageQualityScore, 0) / teamAnalytics.length 
      : 0;

    return {
      totalMembers,
      activeMembers,
      totalSubmissions,
      avgQuality: avgQuality.toFixed(1)
    };
  };

  const getTopPerformers = () => {
    return teamAnalytics
      .sort((a, b) => b.metrics.averageQualityScore - a.metrics.averageQualityScore)
      .slice(0, 3)
      .map(analytics => {
        const member = teamMembers.find(m => m.id === analytics.teamMemberId);
        return {
          name: member ? `${member.firstName} ${member.lastName}` : 'Unknown',
          score: analytics.metrics.averageQualityScore,
          submissions: analytics.metrics.submissionsCount,
          department: member?.department || 'Unknown'
        };
      });
  };

  const getDepartmentStats = () => {
    const departments = ['sales', 'finance', 'hr', 'operations'];
    return departments.map(dept => {
      const deptMembers = teamMembers.filter(m => m.department === dept);
      const deptAnalytics = teamAnalytics.filter(a => {
        const member = teamMembers.find(m => m.id === a.teamMemberId);
        return member?.department === dept;
      });
      
      return {
        name: dept.charAt(0).toUpperCase() + dept.slice(1),
        members: deptMembers.length,
        submissions: deptAnalytics.reduce((sum, a) => sum + a.metrics.submissionsCount, 0),
        avgQuality: deptAnalytics.length > 0
          ? deptAnalytics.reduce((sum, a) => sum + a.metrics.averageQualityScore, 0) / deptAnalytics.length
          : 0
      };
    });
  };

  const stats = getOverallStats();
  const topPerformers = getTopPerformers();
  const departmentStats = getDepartmentStats();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-theme-text-primary">Team Data Management</h2>
          <p className="text-theme-text-secondary">Manage team members, data submissions, and analytics</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/tenant-admin"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-surface border border-theme-border rounded-lg hover:bg-theme-muted"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-theme-surface rounded-lg border border-theme-border">
        <div className="border-b border-theme-border">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-theme-accent text-theme-accent'
                  : 'border-transparent text-theme-text-secondary hover:text-theme-text-primary'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'team'
                  ? 'border-theme-accent text-theme-accent'
                  : 'border-transparent text-theme-text-secondary hover:text-theme-text-primary'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Team Management
            </button>
            <button
              onClick={() => setActiveTab('submissions')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'submissions'
                  ? 'border-theme-accent text-theme-accent'
                  : 'border-transparent text-theme-text-secondary hover:text-theme-text-primary'
              }`}
            >
              <Activity className="w-4 h-4 inline mr-2" />
              Data Submissions
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'analytics'
                  ? 'border-theme-accent text-theme-accent'
                  : 'border-transparent text-theme-text-secondary hover:text-theme-text-primary'
              }`}
            >
              <Award className="w-4 h-4 inline mr-2" />
              Analytics
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-theme-surface rounded-lg border border-theme-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-theme-text-secondary">Team Members</p>
                      <p className="text-2xl font-bold text-theme-text-primary">{stats.totalMembers}</p>
                      <p className="text-xs text-green-600">{stats.activeMembers} active</p>
                    </div>
                    <Users className="w-8 h-8 text-theme-accent" />
                  </div>
                </div>
                <div className="bg-theme-surface rounded-lg border border-theme-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-theme-text-secondary">Total Submissions</p>
                      <p className="text-2xl font-bold text-theme-text-primary">{stats.totalSubmissions}</p>
                      <p className="text-xs text-theme-text-secondary">This month</p>
                    </div>
                    <Activity className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <div className="bg-theme-surface rounded-lg border border-theme-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-theme-text-secondary">Avg Quality Score</p>
                      <p className="text-2xl font-bold text-theme-text-primary">{stats.avgQuality}</p>
                      <p className="text-xs text-green-600">+2.3% vs last month</p>
                    </div>
                    <Award className="w-8 h-8 text-purple-600" />
                  </div>
                </div>
                <div className="bg-theme-surface rounded-lg border border-theme-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-theme-text-secondary">Data Sources</p>
                      <p className="text-2xl font-bold text-theme-text-primary">12</p>
                      <p className="text-xs text-green-600">3 active</p>
                    </div>
                    <Settings className="w-8 h-8 text-orange-600" />
                  </div>
                </div>
              </div>

              {/* Top Performers */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
                  <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Top Performers</h3>
                  <div className="space-y-3">
                    {topPerformers.map((performer, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-theme-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-800">{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium text-theme-text-primary">{performer.name}</p>
                            <p className="text-sm text-theme-text-secondary">{performer.department}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-theme-text-primary">{performer.score}</p>
                          <p className="text-sm text-theme-text-secondary">{performer.submissions} submissions</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
                  <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Department Performance</h3>
                  <div className="space-y-3">
                    {departmentStats.map((dept, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-theme-muted rounded-lg">
                        <div>
                          <p className="font-medium text-theme-text-primary">{dept.name}</p>
                          <p className="text-sm text-theme-text-secondary">{dept.members} members</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-theme-text-primary">{dept.submissions} submissions</p>
                          <p className="text-sm text-theme-text-secondary">Quality: {dept.avgQuality.toFixed(1)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
                <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-theme-muted rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm text-theme-text-primary">John Smith submitted sales data for March</p>
                      <p className="text-xs text-theme-text-secondary">2 hours ago</p>
                    </div>
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Approved</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-theme-muted rounded-lg">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm text-theme-text-primary">Jane Doe submitted financial data for Q1</p>
                      <p className="text-xs text-theme-text-secondary">4 hours ago</p>
                    </div>
                    <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">Under Review</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-theme-muted rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm text-theme-text-primary">Mike Johnson configured new data source</p>
                      <p className="text-xs text-theme-text-secondary">1 day ago</p>
                    </div>
                    <span className="text-xs text-theme-accent bg-blue-100 px-2 py-1 rounded">System</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Team Management Tab */}
          {activeTab === 'team' && (
            <TeamManagement
              tenantSlug={tenantSlug || ''}
              currentUserId={currentUser?.id}
            />
          )}

          {/* Data Submissions Tab */}
          {activeTab === 'submissions' && currentUser && (
            <TeamDataSubmissionPortal
              tenantSlug={tenantSlug || ''}
              currentUserId={currentUser.id}
              userDepartment={currentUser.department || 'general'}
              userRole={currentUser.roleId}
            />
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-theme-muted rounded-lg p-4">
                  <h4 className="font-medium text-theme-text-primary mb-2">Total Submissions</h4>
                  <p className="text-2xl font-bold text-theme-text-primary">{stats.totalSubmissions}</p>
                </div>
                <div className="bg-theme-muted rounded-lg p-4">
                  <h4 className="font-medium text-theme-text-primary mb-2">Avg Quality Score</h4>
                  <p className="text-2xl font-bold text-theme-text-primary">{stats.avgQuality}</p>
                </div>
                <div className="bg-theme-muted rounded-lg p-4">
                  <h4 className="font-medium text-theme-text-primary mb-2">Top Performer</h4>
                  <p className="text-xl font-bold text-theme-text-primary">{topPerformers[0]?.name || 'N/A'}</p>
                  <p className="text-sm text-theme-text-secondary">Score: {topPerformers[0]?.score || 0}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Top Performers</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-theme-surface border border-theme-border rounded-lg">
                    <thead>
                      <tr className="bg-theme-muted">
                        <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Name</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Department</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-theme-text-primary">Submissions</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-theme-text-primary">Quality Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topPerformers.map((p, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-4 py-2 text-sm text-theme-text-primary">{p.name}</td>
                          <td className="px-4 py-2 text-sm text-theme-text-secondary capitalize">{p.department}</td>
                          <td className="px-4 py-2 text-sm text-theme-text-primary text-right">{p.submissions}</td>
                          <td className="px-4 py-2 text-sm text-theme-text-primary text-right">{p.score.toFixed(1)}</td>
                        </tr>
                      ))}
                      {topPerformers.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-theme-text-secondary">No analytics data available</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Department Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-theme-surface border border-theme-border rounded-lg">
                    <thead>
                      <tr className="bg-theme-muted">
                        <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Department</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-theme-text-primary">Members</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-theme-text-primary">Submissions</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-theme-text-primary">Avg Quality</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departmentStats.map((dept) => (
                        <tr key={dept.name} className="border-t">
                          <td className="px-4 py-2 text-sm text-theme-text-primary">{dept.name}</td>
                          <td className="px-4 py-2 text-sm text-theme-text-primary text-right">{dept.members}</td>
                          <td className="px-4 py-2 text-sm text-theme-text-primary text-right">{dept.submissions}</td>
                          <td className="px-4 py-2 text-sm text-theme-text-primary text-right">{dept.avgQuality.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
