// Staff Reports Component
'use client';

import { useState, useEffect, useRef } from 'react';
import { Calendar, FileText, Send, CheckCircle, AlertCircle, User, Mic, MicOff, Wand2, Loader2 } from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
}

interface ReportData {
  reportType: 'daily' | 'weekly' | 'monthly';
  reportDate: string;
  objectives: string;
  achievements: string;
  challenges: string;
  nextSteps: string;
  additionalNotes: string;
  headOfDepartment: string;
  teamMembers: string[];
}

export default function StaffReports({
  tenantSlug: propTenantSlug,
  employeeId: propEmployeeId,
}: {
  tenantSlug?: string | null;
  employeeId?: string;
} = {}) {
  const [tenantSlug] = useState(() => propTenantSlug || "default");
  const [employeeId] = useState(() => propEmployeeId || `user-${Date.now()}`);

  const [reportData, setReportData] = useState<ReportData>({
    reportType: 'daily',
    reportDate: new Date().toISOString().split('T')[0],
    objectives: '',
    achievements: '',
    challenges: '',
    nextSteps: '',
    additionalNotes: '',
    headOfDepartment: '',
    teamMembers: [],
  });

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [toast, setToast] = useState<string | null>(null);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [aiTranscript, setAiTranscript] = useState('');
  const [aiStatus, setAiStatus] = useState<'idle' | 'listening' | 'processing' | 'success' | 'error'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const fetchStaffMembers = async () => {
      try {
        const response = await fetch(`/api/hr/employees?tenantSlug=${tenantSlug}`);
        if (response.ok) {
          const data = await response.json();
          const employees = data.employees?.[tenantSlug] || [];
          setStaffMembers(employees);
        }
      } catch (error) {
        console.error('Failed to fetch staff members:', error);
      } finally {
        setLoadingStaff(false);
      }
    };

    fetchStaffMembers();
  }, [tenantSlug]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setSpeechSupported(Boolean(SpeechRecognition));
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleInputChange = (field: keyof ReportData, value: string | string[]) => {
    setReportData(prev => ({ ...prev, [field]: value }));
  };

  const handleTeamMemberToggle = (memberId: string) => {
    setReportData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.includes(memberId)
        ? prev.teamMembers.filter(id => id !== memberId)
        : [...prev.teamMembers, memberId]
    }));
  };

  const startVoiceCapture = () => {
    if (typeof window === 'undefined') {
      setAiError('Voice capture is only available in the browser.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setAiError('This browser does not support microphone transcription.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join(' ')
          .trim();

        setAiTranscript(transcript);
        setAiError(null);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event);
        setAiStatus('error');
        setAiError(event?.error === 'not-allowed'
          ? 'Microphone permission denied. Please allow mic access and try again.'
          : 'Voice capture ran into an issue. Try recording again.');
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        setAiStatus(prev => (prev === 'listening' ? 'idle' : prev));
      };

      recognition.start();
      recognitionRef.current = recognition;
      setAiTranscript('');
      setAiError(null);
      setAiMessage(null);
      setAiStatus('listening');
      setIsRecording(true);
    } catch (error) {
      console.error('Unable to start voice capture:', error);
      setAiError('Unable to start voice capture. Please refresh and try again.');
    }
  };

  const stopVoiceCapture = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const generateDraftFromTranscript = async () => {
    const cleanedTranscript = aiTranscript.trim();

    if (!cleanedTranscript) {
      setAiStatus('error');
      setAiError('No transcript detected. Record or type your update first.');
      return;
    }

    setAiStatus('processing');
    setAiError(null);
    setAiMessage(null);

    try {
      const response = await fetch('/api/hr/staff-reports/ai-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: cleanedTranscript,
          reportType: reportData.reportType,
        }),
      });

      if (!response.ok) {
        throw new Error('AI draft failed');
      }

      const data = await response.json();

      if (!data.reportDraft) {
        throw new Error('AI response missing draft payload');
      }

      setReportData(prev => ({
        ...prev,
        ...data.reportDraft,
      }));

      setAiStatus('success');
      const source = data.metadata?.source;
      const modelName = data.metadata?.model;
      const successMessage = source === 'llama'
        ? `Report structured by Llama ${modelName || ''}`.trim()
        : 'Fallback summarizer applied. Review sections before submitting.';
      setAiMessage(successMessage);

      setTimeout(() => setAiMessage(null), 4000);
    } catch (error) {
      console.error('AI draft generation error:', error);
      setAiStatus('error');
      setAiError('AI could not map the transcript. Please tweak the transcript and try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch('/api/hr/staff-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantSlug,
          employeeId,
          ...reportData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit report');
      }

      setSubmitStatus('success');
      setToast('Report submitted successfully!');

      // Reset form after successful submission
      setReportData({
        reportType: 'daily',
        reportDate: new Date().toISOString().split('T')[0],
        objectives: '',
        achievements: '',
        challenges: '',
        nextSteps: '',
        additionalNotes: '',
        headOfDepartment: '',
        teamMembers: [],
      });

      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      setSubmitStatus('error');
      setToast('Failed to submit report. Please try again.');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'daily': return 'Daily Report';
      case 'weekly': return 'Weekly Report';
      case 'monthly': return 'Monthly Report';
      default: return 'Report';
    }
  };

  const getDateLabel = () => {
    switch (reportData.reportType) {
      case 'daily': return 'Report Date';
      case 'weekly': return 'Week Starting';
      case 'monthly': return 'Month';
      default: return 'Date';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-slate-100 p-3">
            <FileText className="h-6 w-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Staff Reports</h1>
            <p className="text-sm text-slate-500">Submit your daily, weekly, or monthly progress reports</p>
          </div>
        </div>
      </div>

      {/* Report Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Report Configuration */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Report Configuration</h2>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Report Type */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Report Type
              </label>
              <select
                value={reportData.reportType}
                onChange={(e) => handleInputChange('reportType', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:outline-none"
                required
              >
                <option value="daily">Daily Report</option>
                <option value="weekly">Weekly Report</option>
                <option value="monthly">Monthly Report</option>
              </select>
            </div>

            {/* Report Date */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                {getDateLabel()}
              </label>
              <input
                type="date"
                value={reportData.reportDate}
                onChange={(e) => handleInputChange('reportDate', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:outline-none"
                required
              />
            </div>
          </div>
        </div>

        {/* Team & Stakeholders */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Team & Stakeholders</h2>

          <div className="space-y-6">
            {/* Head of Department */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Head of Department
                <span className="text-slate-400 text-xs ml-1">(Required - will receive this report)</span>
              </label>
              <select
                value={reportData.headOfDepartment}
                onChange={(e) => handleInputChange('headOfDepartment', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:outline-none"
                required
                disabled={loadingStaff}
              >
                <option value="">
                  {loadingStaff ? 'Loading staff members...' : 'Select Head of Department'}
                </option>
                {staffMembers
                  .filter(member => member.position.toLowerCase().includes('head') ||
                                   member.position.toLowerCase().includes('director') ||
                                   member.position.toLowerCase().includes('manager'))
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} - {member.position} ({member.department})
                    </option>
                  ))}
              </select>
            </div>

            {/* Team Members */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Team Members Involved
                <span className="text-slate-400 text-xs ml-1">(Optional - other staff who contributed to this work)</span>
              </label>

              {loadingStaff ? (
                <div className="text-sm text-slate-500">Loading staff members...</div>
              ) : (
                <div className="grid gap-2 max-h-48 overflow-y-auto border border-slate-200 rounded-2xl p-4">
                  {staffMembers
                    .filter(member => member.id !== employeeId) // Don't show current user
                    .map((member) => (
                      <label key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={reportData.teamMembers.includes(member.id)}
                          onChange={() => handleTeamMemberToggle(member.id)}
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                        />
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400" />
                          <div>
                            <span className="text-sm font-medium text-slate-900">{member.name}</span>
                            <span className="text-xs text-slate-500 ml-2">
                              {member.position} • {member.department}
                            </span>
                          </div>
                        </div>
                      </label>
                    ))}
                </div>
              )}

              {reportData.teamMembers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs text-slate-500">Selected team members:</span>
                  {reportData.teamMembers.map((memberId) => {
                    const member = staffMembers.find(m => m.id === memberId);
                    return member ? (
                      <span key={memberId} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-xs text-slate-700">
                        <User className="h-3 w-3" />
                        {member.name}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Voice Draft */}
        <div className="rounded-3xl border border-slate-900/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-6 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-lg font-semibold">Generate Report with AI</p>
              <p className="text-sm text-white/70">
                Hit record, speak freely, and let the assistant map your rant to the structured template.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {speechSupported && (
                <button
                  type="button"
                  onClick={isRecording ? stopVoiceCapture : startVoiceCapture}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isRecording
                      ? 'bg-rose-500/20 text-rose-100 ring-1 ring-rose-200/40'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {isRecording ? 'Stop Recording' : 'Start Voice Capture'}
                </button>
              )}
              <button
                type="button"
                onClick={generateDraftFromTranscript}
                disabled={aiStatus === 'processing' || !aiTranscript.trim()}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {aiStatus === 'processing' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                {aiStatus === 'processing' ? 'Summarizing...' : 'Generate Draft'}
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {!speechSupported && (
              <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80">
                Your browser does not expose the Web Speech API. Paste your typed notes into the transcript box and the AI will still structure it for you.
              </div>
            )}

            <textarea
              value={aiTranscript}
              onChange={(e) => setAiTranscript(e.target.value)}
              placeholder="Record or paste your raw report. Mention objectives, wins, blockers, and next steps in plain language."
              className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 min-h-[140px]"
            />

            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide text-white/70">
              {aiStatus === 'listening' && (
                <div className="inline-flex items-center gap-2 text-amber-200">
                  <span className="h-2 w-2 rounded-full bg-amber-300 animate-ping" />
                  Listening...
                </div>
              )}
              {aiStatus === 'processing' && (
                <div className="inline-flex items-center gap-2 text-slate-200">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Converting to template
                </div>
              )}
              {aiStatus === 'success' && (
                <div className="inline-flex items-center gap-2 text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  Draft applied
                </div>
              )}
              {aiStatus === 'error' && aiError && (
                <div className="inline-flex items-center gap-2 text-rose-200">
                  <span className="h-2 w-2 rounded-full bg-rose-300" />
                  Needs attention
                </div>
              )}
            </div>

            {(aiMessage || aiError) && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  aiError
                    ? 'border-rose-200/40 bg-rose-500/10 text-rose-100'
                    : 'border-emerald-200/40 bg-emerald-500/10 text-emerald-100'
                }`}
              >
                {aiError || aiMessage}
              </div>
            )}
          </div>
        </div>

        {/* Report Content */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {getReportTypeLabel(reportData.reportType)} Content
          </h2>

          <div className="space-y-6">
            {/* Objectives */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Objectives / Goals
                <span className="text-slate-400 text-xs ml-1">(What were you planning to achieve?)</span>
              </label>
              <textarea
                value={reportData.objectives}
                onChange={(e) => handleInputChange('objectives', e.target.value)}
                placeholder="List your objectives or goals for this period..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:outline-none min-h-[100px] resize-vertical"
                required
              />
            </div>

            {/* Achievements */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Achievements / Progress
                <span className="text-slate-400 text-xs ml-1">(What did you accomplish?)</span>
              </label>
              <textarea
                value={reportData.achievements}
                onChange={(e) => handleInputChange('achievements', e.target.value)}
                placeholder="Describe what you achieved or completed..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:outline-none min-h-[100px] resize-vertical"
                required
              />
            </div>

            {/* Challenges */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Challenges / Blockers
                <span className="text-slate-400 text-xs ml-1">(What obstacles did you face?)</span>
              </label>
              <textarea
                value={reportData.challenges}
                onChange={(e) => handleInputChange('challenges', e.target.value)}
                placeholder="Describe any challenges, issues, or blockers encountered..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:outline-none min-h-[80px] resize-vertical"
              />
            </div>

            {/* Next Steps */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Next Steps / Action Items
                <span className="text-slate-400 text-xs ml-1">(What will you do next?)</span>
              </label>
              <textarea
                value={reportData.nextSteps}
                onChange={(e) => handleInputChange('nextSteps', e.target.value)}
                placeholder="Outline your next steps or action items..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:outline-none min-h-[80px] resize-vertical"
              />
            </div>

            {/* Additional Notes */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Additional Notes
                <span className="text-slate-400 text-xs ml-1">(Optional)</span>
              </label>
              <textarea
                value={reportData.additionalNotes}
                onChange={(e) => handleInputChange('additionalNotes', e.target.value)}
                placeholder="Any additional information, feedback, or comments..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:outline-none min-h-[60px] resize-vertical"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Report will be submitted for review by your manager
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Report
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`rounded-2xl px-4 py-3 shadow-lg ${
            submitStatus === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {submitStatus === 'success' ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <span className="text-sm font-medium">{toast}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}