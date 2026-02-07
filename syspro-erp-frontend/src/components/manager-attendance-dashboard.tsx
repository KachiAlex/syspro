// Manager Attendance Dashboard Component
'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, TrendingDown, Users, Zap } from 'lucide-react';

interface TeamMember {
  employeeId: string;
  name: string;
  department: string;
  todayConfidence: number;
  todayStatus: string;
  workMode: string;
  lastCheckIn?: string;
  trend: number; // -5 to 5, negative = declining
}

interface Anomaly {
  employeeId: string;
  anomalyType: 'hybrid_abuse' | 'low_contribution' | 'excessive_absences' | 'irregular_pattern';
  severity: 'low' | 'medium' | 'high';
  details: string;
}

export default function ManagerAttendanceDashboard({
  tenantSlug,
  departmentId,
}: {
  tenantSlug: string | null;
  departmentId?: string;
}) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [filterMode, setFilterMode] = useState<string | null>(null);
  const [filterConfidence, setFilterConfidence] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    const fetchTeamAttendance = async () => {
      if (!tenantSlug) return;

      try {
        const today = new Date().toISOString().split('T')[0];
        
        // Fetch today's attendance for team
        const res = await fetch(
          `/api/attendance?action=today&tenantSlug=${tenantSlug}${departmentId ? `&departmentId=${departmentId}` : ''}`
        );
        const data = await res.json();

        // Format as team member records
        const members: TeamMember[] = data.records.map((record: any) => ({
          employeeId: record.employeeId,
          name: `Employee ${record.employeeId.substring(0, 8)}`,
          department: record.departmentId || 'General',
          todayConfidence: record.confidenceScore,
          todayStatus: record.attendanceStatus,
          workMode: record.workMode,
          lastCheckIn: record.checkInTime,
          trend: Math.random() * 10 - 5, // Simulated trend
        }));

        setTeamMembers(members);

        // Fetch anomalies for team members
        const anomalyData: Anomaly[] = [];
        for (const member of members) {
          const anomRes = await fetch(
            `/api/attendance?action=anomalies&tenantSlug=${tenantSlug}&employeeId=${member.employeeId}`
          );
          const anom = await anomRes.json();
          if (anom.anomalies && anom.anomalies.length > 0) {
            anomalyData.push(
              ...anom.anomalies.map((a: any) => ({
                employeeId: member.employeeId,
                ...a,
              }))
            );
          }
        }
        setAnomalies(anomalyData);
      } catch (error) {
        console.error('Failed to fetch team attendance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamAttendance();
  }, [tenantSlug, departmentId]);

  const filteredMembers = teamMembers.filter(member => {
    if (filterMode && member.workMode !== filterMode) return false;
    if (filterConfidence === 'low' && member.todayConfidence >= 40) return false;
    if (filterConfidence === 'medium' && (member.todayConfidence < 40 || member.todayConfidence >= 70)) return false;
    if (filterConfidence === 'high' && member.todayConfidence < 70) return false;
    return true;
  });

  const stats = {
    totalTeam: teamMembers.length,
    present: teamMembers.filter(m => m.todayStatus === 'PRESENT' || m.todayStatus === 'PRESENT_LOW_CONFIDENCE').length,
    absent: teamMembers.filter(m => m.todayStatus === 'ABSENT').length,
    avgConfidence: teamMembers.length > 0 
      ? (teamMembers.reduce((sum, m) => sum + m.todayConfidence, 0) / teamMembers.length).toFixed(1)
      : 0,
  };

  const modeDistribution = teamMembers.reduce((acc, member) => {
    acc[member.workMode] = (acc[member.workMode] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const highAnomalies = anomalies.filter(a => a.severity === 'high');

  if (loading) {
    return <div className="text-center py-8">Loading team attendance...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-6 lg:grid-cols-4 mb-6">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase text-slate-400 font-medium">Team Size</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalTeam}</p>
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6 shadow-sm">
          <p className="text-xs uppercase text-emerald-600 font-medium">Present</p>
          <p className="text-3xl font-bold text-emerald-700 mt-2">{stats.present}</p>
        </div>
        <div className="rounded-3xl border border-red-100 bg-red-50 p-6 shadow-sm">
          <p className="text-xs uppercase text-red-600 font-medium">Absent</p>
          <p className="text-3xl font-bold text-red-700 mt-2">{stats.absent}</p>
        </div>
        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
          <p className="text-xs uppercase text-blue-600 font-medium">Avg Confidence</p>
          <p className="text-3xl font-bold text-blue-700 mt-2">{stats.avgConfidence}%</p>
        </div>
      </div>

      {/* Work Mode Distribution */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase text-slate-400 font-medium mb-4">Work Mode Distribution</p>
        <div className="grid gap-4 lg:grid-cols-6">
          {Object.entries(modeDistribution).map(([mode, count]) => (
            <div key={mode} className="text-center">
              <p className="text-2xl font-bold text-slate-900">{count}</p>
              <p className="text-xs text-slate-600 mt-1">{mode}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Anomalies Alert */}
      {highAnomalies.length > 0 && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <div className="flex gap-3 mb-4">
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">High-Priority Anomalies ({highAnomalies.length})</p>
            </div>
          </div>
          <div className="space-y-3">
            {highAnomalies.slice(0, 5).map((anomaly, idx) => (
              <div key={idx} className="p-3 bg-white rounded-lg border border-red-100">
                <p className="text-sm font-medium text-slate-900">
                  Employee {anomaly.employeeId.substring(0, 8)}
                </p>
                <p className="text-xs text-slate-600 mt-1">{anomaly.details}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase text-slate-400 font-medium mb-4">Filters</p>
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <label className="text-xs text-slate-600 mb-2 block">Work Mode</label>
            <select
              value={filterMode || ''}
              onChange={(e) => setFilterMode(e.target.value || null)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="">All Modes</option>
              <option value="ONSITE">Onsite</option>
              <option value="REMOTE">Remote</option>
              <option value="HYBRID">Hybrid</option>
              <option value="FIELD">Field</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600 mb-2 block">Confidence Level</label>
            <select
              value={filterConfidence}
              onChange={(e) => setFilterConfidence(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="all">All Levels</option>
              <option value="high">High (≥70%)</option>
              <option value="medium">Medium (40-69%)</option>
              <option value="low">Low (&lt;40%)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Team Attendance Table */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm overflow-x-auto">
        <p className="text-xs uppercase text-slate-400 font-medium mb-4">Team Attendance ({filteredMembers.length})</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Dept</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Mode</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Confidence</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Check-in</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Trend</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No team members match filters
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => (
                <tr key={member.employeeId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{member.name}</td>
                  <td className="px-4 py-3 text-slate-600">{member.department}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      member.workMode === 'ONSITE' ? 'bg-blue-50 text-blue-700' :
                      member.workMode === 'REMOTE' ? 'bg-purple-50 text-purple-700' :
                      member.workMode === 'HYBRID' ? 'bg-amber-50 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {member.workMode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full ${
                            member.todayConfidence >= 70
                              ? 'bg-emerald-600'
                              : member.todayConfidence >= 40
                              ? 'bg-amber-600'
                              : 'bg-red-600'
                          }`}
                          style={{ width: `${member.todayConfidence}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-bold w-8">{member.todayConfidence.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${
                      member.todayStatus === 'PRESENT' ? 'text-emerald-600' :
                      member.todayStatus === 'PRESENT_LOW_CONFIDENCE' ? 'text-amber-600' :
                      'text-red-600'
                    }`}>
                      {member.todayStatus === 'PRESENT' ? '✓ Present' :
                       member.todayStatus === 'PRESENT_LOW_CONFIDENCE' ? '⚠ Low Conf' :
                       '✗ Absent'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {member.lastCheckIn
                      ? new Date(member.lastCheckIn).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-bold ${
                      member.trend > 0 ? 'text-emerald-600' : member.trend < 0 ? 'text-red-600' : 'text-slate-600'
                    }`}>
                      {member.trend > 0 ? '↑' : member.trend < 0 ? '↓' : '→'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Team Insights */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase text-slate-400 font-medium mb-4">Team Insights</p>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
            <Users size={20} className="text-blue-600" />
            <div>
              <p className="text-xs text-slate-600">Hybrid Attendance Ratio</p>
              <p className="text-lg font-bold text-slate-900">
                {stats.totalTeam > 0 
                  ? ((modeDistribution['HYBRID'] || 0) / stats.totalTeam * 100).toFixed(0)
                  : 0}%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
            <Zap size={20} className="text-amber-600" />
            <div>
              <p className="text-xs text-slate-600">Low Confidence Count</p>
              <p className="text-lg font-bold text-slate-900">
                {teamMembers.filter(m => m.todayConfidence < 40).length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
            <TrendingDown size={20} className="text-red-600" />
            <div>
              <p className="text-xs text-slate-600">Flagged Anomalies</p>
              <p className="text-lg font-bold text-slate-900">{anomalies.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
