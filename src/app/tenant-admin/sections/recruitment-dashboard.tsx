'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, RefreshCw, Briefcase, UserCheck, FileText, Calendar, Award, ClipboardCheck, Filter, MoreHorizontal, CheckCircle, XCircle, Clock, AlertCircle, Eye, Trash2, Edit3, Sparkles, ChevronRight, Users, Link2, Check, Settings, SlidersHorizontal, Bot, BarChart3
} from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { HRService } from './hr-service';
import {
  RequisitionModal,
  CandidateModal,
  ApplicationModal,
  InterviewModal,
  OfferModal,
  OnboardingTaskModal,
} from './recruitment-modals';
import type {
  JobRequisitionRecord,
  CandidateRecord,
  ApplicationRecord,
  InterviewRecord,
  OfferRecord,
  OnboardingTaskRecord,
  ScreeningConfigRecord,
  BatchScreeningResult,
} from '@/lib/hr/types';

type RecruitmentSubTab = 'requisitions' | 'candidates' | 'applications' | 'interviews' | 'offers' | 'onboarding';

export const RecruitmentDashboard: React.FC = () => {
  const { tenantSlug } = useTenantContext();
  const [activeSubTab, setActiveSubTab] = useState<RecruitmentSubTab>('requisitions');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [requisitions, setRequisitions] = useState<JobRequisitionRecord[]>([]);
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [onboardingTasks, setOnboardingTasks] = useState<OnboardingTaskRecord[]>([]);
  const [departmentRecords, setDepartmentRecords] = useState<{ id: string; name: string }[]>([]);

  // Modal states per entity
  const [showReqModal, setShowReqModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCandModal, setShowCandModal] = useState(false);
  const [showAppModal, setShowAppModal] = useState(false);
  const [showIntModal, setShowIntModal] = useState(false);
  const [showOffModal, setShowOffModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // AI Screening state
  const [screeningReqId, setScreeningReqId] = useState<string | null>(null);
  const [screeningReqTitle, setScreeningReqTitle] = useState('');
  const [showScreeningConfig, setShowScreeningConfig] = useState(false);
  const [screeningMode, setScreeningMode] = useState<'percentage' | 'fixed_number'>('percentage');
  const [screeningValue, setScreeningValue] = useState(20);
  const [screeningThreshold, setScreeningThreshold] = useState(0);
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [showScreeningResults, setShowScreeningResults] = useState(false);
  const [screeningResult, setScreeningResult] = useState<BatchScreeningResult | null>(null);

  const loadData = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const [deptRes, reqRes, candRes, appRes, intRes, offRes, taskRes] = await Promise.all([
        HRService.getDepartmentRecords(tenantSlug).catch(() => []),
        HRService.getRequisitions(tenantSlug).catch(() => ({ requisitions: [], total: 0 })),
        HRService.getCandidates(tenantSlug).catch(() => ({ candidates: [], total: 0 })),
        HRService.getApplications(tenantSlug).catch(() => ({ applications: [], total: 0 })),
        HRService.getInterviews(tenantSlug).catch(() => []),
        HRService.getOffers(tenantSlug).catch(() => []),
        HRService.getOnboardingTasks(tenantSlug).catch(() => []),
      ]);

      setDepartmentRecords(deptRes);
      setRequisitions(reqRes.requisitions);
      setCandidates(candRes.candidates);
      setApplications(appRes.applications);
      setInterviews(intRes);
      setOffers(offRes);
      setOnboardingTasks(taskRes);
    } catch (err) {
      console.error('Failed to load recruitment data:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const deptMap = React.useMemo(() => {
    const map = new Map<string, string>();
    departmentRecords.forEach((d) => map.set(d.id, d.name));
    return map;
  }, [departmentRecords]);

  const handleDeleteRequisition = async (id: string) => {
    if (!tenantSlug) return;
    if (!confirm('Delete this requisition?')) return;
    await HRService.deleteRequisition(tenantSlug, id);
    setRequisitions((prev) => prev.filter((r) => r.id !== id));
  };

  const handleCopyLink = (id: string) => {
    if (!tenantSlug) return;
    const url = `${window.location.origin}/apply/${id}?tenantSlug=${encodeURIComponent(tenantSlug)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleDeleteCandidate = async (id: string) => {
    if (!tenantSlug) return;
    if (!confirm('Delete this candidate?')) return;
    await HRService.deleteCandidate(tenantSlug, id);
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  };

  const handleDeleteInterview = async (id: string) => {
    if (!tenantSlug) return;
    if (!confirm('Delete this interview?')) return;
    await HRService.deleteInterview(tenantSlug, id);
    setInterviews((prev) => prev.filter((i) => i.id !== id));
  };

  const handleDeleteOffer = async (id: string) => {
    if (!tenantSlug) return;
    if (!confirm('Delete this offer?')) return;
    await HRService.deleteOffer(tenantSlug, id);
    setOffers((prev) => prev.filter((o) => o.id !== id));
  };

  const handleDeleteOnboardingTask = async (id: string) => {
    if (!tenantSlug) return;
    if (!confirm('Delete this task?')) return;
    await HRService.deleteOnboardingTask(tenantSlug, id);
    setOnboardingTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleCreateRequisition = async (data: any) => {
    if (!tenantSlug) return;
    const created = await HRService.createRequisition(tenantSlug, data);
    setRequisitions((prev) => [created, ...prev]);
  };

  const handleCreateCandidate = async (data: any) => {
    if (!tenantSlug) return;
    const created = await HRService.createCandidate(tenantSlug, data);
    setCandidates((prev) => [created, ...prev]);
  };

  const handleCreateApplication = async (data: any) => {
    if (!tenantSlug) return;
    const created = await HRService.createApplication(tenantSlug, data);
    setApplications((prev) => [created, ...prev]);
  };

  const handleCreateInterview = async (data: any) => {
    if (!tenantSlug) return;
    const created = await HRService.createInterview(tenantSlug, data);
    setInterviews((prev) => [created, ...prev]);
  };

  const handleCreateOffer = async (data: any) => {
    if (!tenantSlug) return;
    const created = await HRService.createOffer(tenantSlug, data);
    setOffers((prev) => [created, ...prev]);
  };

  const handleCreateOnboardingTask = async (data: any) => {
    if (!tenantSlug) return;
    const created = await HRService.createOnboardingTask(tenantSlug, data);
    setOnboardingTasks((prev) => [created, ...prev]);
  };

  const handleScreenApplication = async (id: string) => {
    if (!tenantSlug) return;
    try {
      await HRService.screenApplication(tenantSlug, id);
      const res = await HRService.getApplications(tenantSlug);
      setApplications(res.applications);
    } catch (err) {
      console.error('Screening failed:', err);
      alert('Screening failed. See console for details.');
    }
  };

  const handleOpenScreeningConfig = async (req: JobRequisitionRecord) => {
    if (!tenantSlug) return;
    setScreeningReqId(req.id);
    setScreeningReqTitle(req.title);
    setScreeningLoading(true);
    try {
      const config = await HRService.getScreeningConfig(tenantSlug, req.id);
      if (config) {
        setScreeningMode(config.selectionMode);
        setScreeningValue(config.selectionValue);
        setScreeningThreshold(config.minScoreThreshold);
      } else {
        setScreeningMode('percentage');
        setScreeningValue(20);
        setScreeningThreshold(0);
      }
      setShowScreeningConfig(true);
    } catch (err) {
      console.error('Failed to load screening config:', err);
      setShowScreeningConfig(true);
    } finally {
      setScreeningLoading(false);
    }
  };

  const handleSaveScreeningConfig = async () => {
    if (!tenantSlug || !screeningReqId) return;
    setScreeningLoading(true);
    try {
      await HRService.saveScreeningConfig(tenantSlug, screeningReqId, {
        selectionMode: screeningMode,
        selectionValue: screeningValue,
        minScoreThreshold: screeningThreshold,
        isEnabled: true,
      });
      setShowScreeningConfig(false);
    } catch (err) {
      console.error('Failed to save screening config:', err);
      alert('Failed to save config. See console.');
    } finally {
      setScreeningLoading(false);
    }
  };

  const handleRunBatchScreening = async () => {
    if (!tenantSlug || !screeningReqId) return;
    setScreeningLoading(true);
    try {
      const result = await HRService.runBatchAIScreening(tenantSlug, screeningReqId);
      setScreeningResult(result);
      setShowScreeningConfig(false);
      setShowScreeningResults(true);
      // Refresh applications
      const res = await HRService.getApplications(tenantSlug);
      setApplications(res.applications);
    } catch (err) {
      console.error('Batch screening failed:', err);
      alert('Batch screening failed. See console.');
    } finally {
      setScreeningLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const classes: Record<string, string> = {
      active: 'bg-green-500/10 text-green-400 border-green-500/20',
      filled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      closed: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
      pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      approved: 'bg-green-500/10 text-green-400 border-green-500/20',
      rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
      accepted: 'bg-green-500/10 text-green-400 border-green-500/20',
      declined: 'bg-red-500/10 text-red-400 border-red-500/20',
      revoked: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      shortlisted: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      shortlist: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      interviewing: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      offered: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      hired: 'bg-green-500/10 text-green-400 border-green-500/20',
      completed: 'bg-green-500/10 text-green-400 border-green-500/20',
      scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'in-progress': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      passed: 'bg-green-500/10 text-green-400 border-green-500/20',
      failed: 'bg-red-500/10 text-red-400 border-red-500/20',
      screened: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
      under_review: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      applied: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    };
    return classes[status.toLowerCase()] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  };

  const subTabs: { id: RecruitmentSubTab; label: string; icon: React.ElementType }[] = [
    { id: 'requisitions', label: 'Requisitions', icon: Briefcase },
    { id: 'candidates', label: 'Candidates', icon: Users },
    { id: 'applications', label: 'Applications', icon: FileText },
    { id: 'interviews', label: 'Interviews', icon: Calendar },
    { id: 'offers', label: 'Offers', icon: Award },
    { id: 'onboarding', label: 'Onboarding', icon: ClipboardCheck },
  ];

  // ─── Requisitions ───
  const renderRequisitions = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-theme-text-primary">Job Requisitions</h3>
        <button
          onClick={() => setShowReqModal(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> New Requisition
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-theme-border">
        <table className="w-full text-sm">
          <thead className="bg-theme-muted">
            <tr>
              {['Title', 'Department', 'Status', 'Headcount', 'Posted', 'AI Screening', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-theme-text-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {requisitions.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-theme-text-tertiary">No requisitions found.</td></tr>
            )}
            {requisitions.map((r) => (
              <tr key={r.id} className="hover:bg-theme-sidebar-hover">
                <td className="px-4 py-3 text-theme-text-primary font-medium">{r.title}</td>
                <td className="px-4 py-3 text-theme-text-secondary">{deptMap.get(r.departmentId) || r.departmentId}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${statusBadge(r.status)}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-theme-text-secondary">{r.headcount ?? 1}</td>
                <td className="px-4 py-3 text-theme-text-secondary">{r.createdAt ? r.createdAt.split('T')[0] : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenScreeningConfig(r)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20"
                      title="Configure AI Screening"
                    >
                      <SlidersHorizontal className="w-3 h-3" /> Configure
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyLink(r.id)}
                      className="p-1.5 rounded-md hover:bg-blue-500/10 text-theme-text-tertiary hover:text-blue-400"
                      title="Copy application link"
                    >
                      {copiedId === r.id ? <Check className="w-4 h-4 text-green-500" /> : <Link2 className="w-4 h-4" />}
                    </button>
                    {r.status === 'active' && (
                      <button
                        onClick={() => handleDeleteRequisition(r.id)}
                        className="p-1.5 rounded-md hover:bg-red-500/10 text-theme-text-tertiary hover:text-red-400"
                        title="Close / Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ─── Candidates ───
  const renderCandidates = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-theme-text-primary">Candidates</h3>
        <button
          onClick={() => setShowCandModal(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Add Candidate
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-theme-border">
        <table className="w-full text-sm">
          <thead className="bg-theme-muted">
            <tr>
              {['Name', 'Email', 'Stage', 'Experience', 'Skills', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-theme-text-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {candidates.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-theme-text-tertiary">No candidates found.</td></tr>
            )}
            {candidates.map((c) => (
              <tr key={c.id} className="hover:bg-theme-sidebar-hover">
                <td className="px-4 py-3 text-theme-text-primary font-medium">{c.fullName}</td>
                <td className="px-4 py-3 text-theme-text-secondary">{c.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${statusBadge(c.currentStage || 'new')}`}>
                    {c.currentStage || 'new'}
                  </span>
                </td>
                <td className="px-4 py-3 text-theme-text-secondary">{c.experienceYears ?? 0} yrs</td>
                <td className="px-4 py-3 text-theme-text-secondary max-w-xs truncate">{(c.skills || []).join(', ')}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteCandidate(c.id)}
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-theme-text-tertiary hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ─── Applications ───
  const renderApplications = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-theme-text-primary">Applications</h3>
        <button
          onClick={() => setShowAppModal(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> New Application
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-theme-border">
        <table className="w-full text-sm">
          <thead className="bg-theme-muted">
            <tr>
              {['Candidate', 'Requisition', 'Status', 'AI Score', 'Shortlist', 'Applied', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-theme-text-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {applications.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-theme-text-tertiary">No applications found.</td></tr>
            )}
            {applications.map((a) => {
              const candidate = candidates.find((c) => c.id === a.candidateId);
              const req = requisitions.find((r) => r.id === a.requisitionId);
              return (
                <tr key={a.id} className="hover:bg-theme-sidebar-hover">
                  <td className="px-4 py-3 text-theme-text-primary font-medium">{candidate?.fullName || a.candidateId}</td>
                  <td className="px-4 py-3 text-theme-text-secondary max-w-xs truncate">{req?.title || a.requisitionId}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${statusBadge(a.status)}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-theme-text-secondary">
                    {a.aiScore !== null ? `${a.aiScore}/100` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {a.shortlistedBy ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${a.shortlistedBy === 'ai' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                        <Bot className="w-3 h-3" /> {a.shortlistedBy === 'ai' ? 'AI' : 'HR'}
                      </span>
                    ) : (
                      <span className="text-theme-text-tertiary text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-theme-text-secondary">{a.appliedAt ? a.appliedAt.split('T')[0] : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleScreenApplication(a.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20"
                        title="Run AI Screening"
                      >
                        <Sparkles className="w-3 h-3" /> Screen
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ─── Interviews ───
  const renderInterviews = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-theme-text-primary">Interviews</h3>
        <button
          onClick={() => setShowIntModal(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Schedule Interview
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-theme-border">
        <table className="w-full text-sm">
          <thead className="bg-theme-muted">
            <tr>
              {['Application', 'Round', 'Type', 'Scheduled', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-theme-text-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {interviews.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-theme-text-tertiary">No interviews found.</td></tr>
            )}
            {interviews.map((i) => {
              const app = applications.find((a) => a.id === i.applicationId);
              const candidateName = app ? candidates.find((c) => c.id === app.candidateId)?.fullName || i.applicationId : i.applicationId;
              return (
                <tr key={i.id} className="hover:bg-theme-sidebar-hover">
                  <td className="px-4 py-3 text-theme-text-primary font-medium">{candidateName}</td>
                  <td className="px-4 py-3 text-theme-text-secondary">{i.roundNumber ?? 1}</td>
                  <td className="px-4 py-3 text-theme-text-secondary capitalize">{i.type}</td>
                  <td className="px-4 py-3 text-theme-text-secondary">{i.scheduledAt ? new Date(i.scheduledAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${statusBadge(i.status)}`}>
                      {i.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeleteInterview(i.id)}
                        className="p-1.5 rounded-md hover:bg-red-500/10 text-theme-text-tertiary hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ─── Offers ───
  const renderOffers = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-theme-text-primary">Offers</h3>
        <button
          onClick={() => setShowOffModal(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Create Offer
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-theme-border">
        <table className="w-full text-sm">
          <thead className="bg-theme-muted">
            <tr>
              {['Candidate', 'Salary', 'Start Date', 'Expires', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-theme-text-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {offers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-theme-text-tertiary">No offers found.</td></tr>
            )}
            {offers.map((o) => {
              const app = applications.find((a) => a.id === o.applicationId);
              const candidateName = app ? candidates.find((c) => c.id === app.candidateId)?.fullName || o.applicationId : o.applicationId;
              return (
                <tr key={o.id} className="hover:bg-theme-sidebar-hover">
                  <td className="px-4 py-3 text-theme-text-primary font-medium">{candidateName}</td>
                  <td className="px-4 py-3 text-theme-text-secondary">${Number(o.salary).toLocaleString()}</td>
                  <td className="px-4 py-3 text-theme-text-secondary">{o.startDate ? o.startDate.split('T')[0] : '—'}</td>
                  <td className="px-4 py-3 text-theme-text-secondary">{o.expiresAt ? o.expiresAt.split('T')[0] : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${statusBadge(o.status)}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeleteOffer(o.id)}
                        className="p-1.5 rounded-md hover:bg-red-500/10 text-theme-text-tertiary hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ─── Onboarding ───
  const renderOnboarding = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-theme-text-primary">Onboarding Tasks</h3>
        <button
          onClick={() => setShowTaskModal(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-theme-border">
        <table className="w-full text-sm">
          <thead className="bg-theme-muted">
            <tr>
              {['Employee ID', 'Task', 'Category', 'Assigned To', 'Due', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-theme-text-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {onboardingTasks.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-theme-text-tertiary">No onboarding tasks found.</td></tr>
            )}
            {onboardingTasks.map((t) => (
              <tr key={t.id} className="hover:bg-theme-sidebar-hover">
                <td className="px-4 py-3 text-theme-text-primary font-medium">{t.employeeId}</td>
                <td className="px-4 py-3 text-theme-text-secondary">{t.task}</td>
                <td className="px-4 py-3 text-theme-text-secondary capitalize">{t.category}</td>
                <td className="px-4 py-3 text-theme-text-secondary">{t.assignedToUserId}</td>
                <td className="px-4 py-3 text-theme-text-secondary">{t.dueDate ? t.dueDate.split('T')[0] : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${statusBadge(t.status)}`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteOnboardingTask(t.id)}
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-theme-text-tertiary hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSubContent = () => {
    switch (activeSubTab) {
      case 'requisitions': return renderRequisitions();
      case 'candidates': return renderCandidates();
      case 'applications': return renderApplications();
      case 'interviews': return renderInterviews();
      case 'offers': return renderOffers();
      case 'onboarding': return renderOnboarding();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-theme-text-primary">Talent Acquisition & Onboarding</h2>
          <p className="text-theme-text-secondary mt-1">Recruitment pipeline from requisition to hire</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-muted border border-theme-border rounded-lg hover:bg-theme-sidebar-hover disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Open Reqs', value: requisitions.filter((r) => r.status === 'active').length, icon: Briefcase },
          { label: 'Candidates', value: candidates.length, icon: Users },
          { label: 'Applications', value: applications.length, icon: FileText },
          { label: 'Interviews', value: interviews.filter((i) => i.status === 'scheduled').length, icon: Calendar },
          { label: 'Pending Offers', value: offers.filter((o) => o.status === 'pending').length, icon: Award },
          { label: 'Onboarding', value: onboardingTasks.filter((t) => t.status === 'pending' || t.status === 'in-progress').length, icon: ClipboardCheck },
        ].map((s) => (
          <div key={s.label} className="bg-theme-muted rounded-xl border border-theme-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-theme-text-secondary">{s.label}</p>
                <p className="text-2xl font-bold text-theme-text-primary mt-1">{s.value}</p>
              </div>
              <s.icon className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="border-b border-theme-border">
        <div className="flex gap-1">
          {subTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeSubTab === tab.id
                  ? 'border-blue-600 text-theme-accent'
                  : 'border-transparent text-theme-text-tertiary hover:text-theme-text-secondary'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div>{renderSubContent()}</div>

      <RequisitionModal
        isOpen={showReqModal}
        onClose={() => setShowReqModal(false)}
        onSubmit={handleCreateRequisition}
        departments={departmentRecords}
        tenantSlug={tenantSlug || ''}
        onDepartmentCreated={(dept) => setDepartmentRecords((prev) => [...prev, dept])}
      />
      <CandidateModal
        isOpen={showCandModal}
        onClose={() => setShowCandModal(false)}
        onSubmit={handleCreateCandidate}
      />
      <ApplicationModal
        isOpen={showAppModal}
        onClose={() => setShowAppModal(false)}
        onSubmit={handleCreateApplication}
        candidates={candidates.map((c) => ({ id: c.id, fullName: c.fullName }))}
        requisitions={requisitions.map((r) => ({ id: r.id, title: r.title }))}
      />
      <InterviewModal
        isOpen={showIntModal}
        onClose={() => setShowIntModal(false)}
        onSubmit={handleCreateInterview}
        applications={applications.map((a) => {
          const c = candidates.find((x) => x.id === a.candidateId);
          return { id: a.id, candidateName: c?.fullName || a.candidateId };
        })}
      />
      <OfferModal
        isOpen={showOffModal}
        onClose={() => setShowOffModal(false)}
        onSubmit={handleCreateOffer}
        applications={applications.map((a) => {
          const c = candidates.find((x) => x.id === a.candidateId);
          return { id: a.id, candidateName: c?.fullName || a.candidateId };
        })}
      />
      {/* AI Screening Config Modal */}
      {showScreeningConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-theme-card border border-theme-border rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-theme-text-primary flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-400" />
                Configure AI Screening
              </h3>
              <button onClick={() => setShowScreeningConfig(false)} className="text-theme-text-tertiary hover:text-theme-text-primary">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-theme-text-secondary mb-4">Role: <span className="font-medium text-theme-text-primary">{screeningReqTitle}</span></p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">Selection Mode</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setScreeningMode('percentage')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${screeningMode === 'percentage' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-theme-muted text-theme-text-secondary border-theme-border hover:bg-theme-sidebar-hover'}`}
                  >
                    Top %
                  </button>
                  <button
                    onClick={() => setScreeningMode('fixed_number')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${screeningMode === 'fixed_number' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-theme-muted text-theme-text-secondary border-theme-border hover:bg-theme-sidebar-hover'}`}
                  >
                    Top N
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  {screeningMode === 'percentage' ? 'Percentage of Applicants' : 'Number of Candidates'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={screeningMode === 'percentage' ? 100 : 999}
                  value={screeningValue}
                  onChange={(e) => setScreeningValue(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-theme-muted border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Minimum AI Score Threshold (0–100)
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={screeningThreshold}
                  onChange={(e) => setScreeningThreshold(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-theme-text-tertiary mt-1">
                  <span>0</span>
                  <span className="font-medium text-theme-text-primary">{screeningThreshold}</span>
                  <span>100</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <button
                onClick={handleSaveScreeningConfig}
                disabled={screeningLoading}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {screeningLoading ? 'Saving...' : 'Save Config'}
              </button>
              <button
                onClick={handleRunBatchScreening}
                disabled={screeningLoading}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {screeningLoading ? 'Running...' : 'Run AI Screening'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Screening Results Modal */}
      {showScreeningResults && screeningResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-theme-card border border-theme-border rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-theme-text-primary flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                AI Screening Results
              </h3>
              <button onClick={() => setShowScreeningResults(false)} className="text-theme-text-tertiary hover:text-theme-text-primary">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-theme-muted rounded-lg p-3 text-center">
                <p className="text-xs text-theme-text-secondary">Screened</p>
                <p className="text-xl font-bold text-theme-text-primary">{screeningResult.screened}</p>
              </div>
              <div className="bg-theme-muted rounded-lg p-3 text-center">
                <p className="text-xs text-theme-text-secondary">Shortlisted</p>
                <p className="text-xl font-bold text-green-400">{screeningResult.shortlisted}</p>
              </div>
              <div className="bg-theme-muted rounded-lg p-3 text-center">
                <p className="text-xs text-theme-text-secondary">Cutoff Score</p>
                <p className="text-xl font-bold text-purple-400">{screeningResult.thresholdScore}</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-theme-border">
              <table className="w-full text-sm">
                <thead className="bg-theme-muted">
                  <tr>
                    {['Candidate', 'AI Score', 'Status', 'Top Criteria'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-theme-text-secondary">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {screeningResult.results.map((r) => (
                    <tr key={r.applicationId} className="hover:bg-theme-sidebar-hover">
                      <td className="px-3 py-2 text-theme-text-primary font-medium">{r.candidateName}</td>
                      <td className="px-3 py-2 text-theme-text-secondary">{r.aiScore}/100</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${statusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-theme-text-secondary text-xs">
                        {r.breakdown.slice(0, 2).map((b) => `${b.criteria}: ${b.score}`).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowScreeningResults(false)}
                className="px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-muted border border-theme-border rounded-lg hover:bg-theme-sidebar-hover"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <OnboardingTaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onSubmit={handleCreateOnboardingTask}
      />
    </div>
  );
};
