'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Mic, MicOff, Wand2, Send, Clock, Loader2 } from 'lucide-react';
import { HRService } from './hr-service';
import { createSpeechRecognition, listenForTranscript, refineReportWithAppraisal, Task } from '@/lib/ai/report-refiner';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
}

interface StaffReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  employees: Employee[];
  currentEmployeeId?: string;
  onSubmitted?: () => void;
}

const REPORT_TYPES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

const MAX_RECORDING_MS = 5 * 60 * 1000; // 5 minutes hard cap

export const StaffReportModal: React.FC<StaffReportModalProps> = ({
  isOpen,
  onClose,
  tenantSlug,
  employees,
  currentEmployeeId,
  onSubmitted,
}) => {
  const [reportType, setReportType] = useState('daily');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [refined, setRefined] = useState(refineReportWithAppraisal('', []));
  const [activeTab, setActiveTab] = useState<'transcript' | 'refined' | 'appraisal'>('transcript');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitterId, setSubmitterId] = useState(currentEmployeeId || '');
  const [hodId, setHodId] = useState('');
  const [taggedIds, setTaggedIds] = useState<string[]>([]);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, string>>({});

  const recognitionRef = useRef<ReturnType<typeof listenForTranscript> | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const hods = useMemo(() => employees.filter((e) => e.role.toLowerCase() === 'hod'), [employees]);
  const colleagues = useMemo(() => employees.filter((e) => e.id !== submitterId), [employees, submitterId]);
  const submitter = useMemo(() => employees.find((e) => e.id === submitterId), [employees, submitterId]);
  const autoHod = useMemo(() => {
    if (!submitter) return undefined;
    return hods.find((h) => h.department === submitter.department);
  }, [submitter, hods]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSpeechSupported(!!createSpeechRecognition());
    }
  }, []);

  useEffect(() => {
    if (autoHod && !hodId) {
      setHodId(autoHod.id);
    }
  }, [autoHod, hodId]);

  useEffect(() => {
    if (currentEmployeeId && !submitterId) {
      setSubmitterId(currentEmployeeId);
    }
  }, [currentEmployeeId, submitterId]);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  useEffect(() => {
    if (!submitterId || !tenantSlug) {
      setTasks([]);
      return;
    }
    const loadTasks = async () => {
      setLoadingTasks(true);
      try {
        const fetched = await HRService.getStaffTasks(tenantSlug, {
          employeeId: submitterId,
          dueBefore: reportDate,
        });
        setTasks(fetched || []);
        setTaskStatuses((prev) => {
          const next: Record<string, string> = { ...prev };
          (fetched || []).forEach((t) => {
            if (next[t.id] === undefined) next[t.id] = t.status || 'pending';
          });
          return next;
        });
      } catch (err) {
        console.error('Failed to load tasks:', err);
      } finally {
        setLoadingTasks(false);
      }
    };
    loadTasks();
  }, [submitterId, tenantSlug, reportDate]);

  const startRecording = () => {
    const recognition = createSpeechRecognition();
    if (!recognition) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }
    setError(null);
    setIsListening(true);
    setRecordingMs(0);

    timerRef.current = setInterval(() => {
      setRecordingMs((prev) => {
        if (prev >= MAX_RECORDING_MS) {
          stopRecording();
          return MAX_RECORDING_MS;
        }
        return prev + 1000;
      });
    }, 1000);

    recognitionRef.current = listenForTranscript(recognition, {
      maxDurationMs: MAX_RECORDING_MS,
      onInterim: (text) => setTranscript(text),
      onError: (err) => setError(`Speech error: ${err}`),
    });

    recognitionRef.current.promise.then((final) => {
      setTranscript(final);
      setIsListening(false);
      if (timerRef.current) clearInterval(timerRef.current);
    });
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsListening(false);
  };

  const handleRefine = () => {
    if (!transcript.trim()) return;
    const tasksWithStatus = tasks.map((t) => ({ ...t, status: taskStatuses[t.id] || t.status || 'pending' }));
    setRefined(refineReportWithAppraisal(transcript, tasksWithStatus));
    setActiveTab('refined');
  };

  const handleSubmit = async () => {
    if (!submitterId) {
      setError('Please select yourself as the submitter.');
      return;
    }
    if (!hodId) {
      setError('Please select a Head of Department.');
      return;
    }
    if (!reportDate) {
      setError('Please select a report date.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const hod = hods.find((h) => h.id === hodId);
      const tagged = colleagues.filter((c) => taggedIds.includes(c.id)).map((c) => c.name);
      const tasksWithStatus = tasks.map((t) => ({ ...t, status: taskStatuses[t.id] || t.status || 'pending' }));
      const refinedWithAppraisal = refineReportWithAppraisal(transcript, tasksWithStatus);
      await HRService.submitStaffReport(tenantSlug, {
        employeeId: submitterId,
        title: refinedWithAppraisal.title || `${reportType} Report`,
        reportType: reportType as any,
        reportDate,
        rawTranscript: transcript,
        refinedText: refinedWithAppraisal.refinedText,
        objectives: refinedWithAppraisal.objectives,
        achievements: refinedWithAppraisal.achievements,
        challenges: refinedWithAppraisal.challenges,
        nextSteps: refinedWithAppraisal.nextSteps,
        additionalNotes: refinedWithAppraisal.additionalNotes,
        meetings: refinedWithAppraisal.meetings,
        blockers: refinedWithAppraisal.blockers,
        activities: refinedWithAppraisal.activities,
        headOfDepartment: hod?.name || '',
        teamMembers: tagged,
        appraisal: refinedWithAppraisal.appraisal,
      });
      onSubmitted?.();
      handleClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    stopRecording();
    setReportType('daily');
    setReportDate(new Date().toISOString().split('T')[0]);
    setTranscript('');
    setRefined(refineReportWithAppraisal('', []));
    setActiveTab('transcript');
    setError(null);
    setHodId('');
    setTaggedIds([]);
    setSubmitterId(currentEmployeeId || '');
    setTasks([]);
    setTaskStatuses({});
    onClose();
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-theme-bg w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-theme-border shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-theme-border">
          <div>
            <h3 className="text-lg font-semibold text-theme-text-primary">Submit Staff Report</h3>
            <p className="text-sm text-theme-text-secondary">Record or type your report. 5-minute max.</p>
          </div>
          <button onClick={handleClose} className="text-theme-text-tertiary hover:text-theme-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-theme-text-primary mb-2">Report Timeline</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="bg-theme-muted w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {REPORT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-theme-text-primary mb-2">Report Date</label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="bg-theme-muted w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-2">Submitter</label>
            <select
              value={submitterId}
              onChange={(e) => setSubmitterId(e.target.value)}
              className="bg-theme-muted w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select yourself</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name} — {e.department}</option>
              ))}
            </select>
          </div>

          <div className="bg-theme-muted rounded-lg border border-theme-border p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-theme-text-primary">Voice Input</label>
              <div className="flex items-center gap-2 text-xs text-theme-text-secondary">
                <Clock className="w-3 h-3" />
                <span>{formatTime(recordingMs)} / {formatTime(MAX_RECORDING_MS)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={isListening ? stopRecording : startRecording}
                disabled={!speechSupported}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isListening
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {isListening ? 'Stop Recording' : 'Start Recording'}
              </button>
              {!speechSupported && (
                <span className="text-xs text-amber-400">Speech recognition not supported in this browser.</span>
              )}
            </div>
          </div>

          <div>
            <div className="flex gap-4 border-b border-theme-border mb-3">
              <button
                onClick={() => setActiveTab('transcript')}
                className={`pb-2 text-sm font-medium ${activeTab === 'transcript' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-theme-text-secondary'}`}
              >
                Transcript
              </button>
              <button
                onClick={() => setActiveTab('refined')}
                className={`pb-2 text-sm font-medium ${activeTab === 'refined' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-theme-text-secondary'}`}
              >
                Refined Report
              </button>
              <button
                onClick={() => setActiveTab('appraisal')}
                className={`pb-2 text-sm font-medium ${activeTab === 'appraisal' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-theme-text-secondary'}`}
              >
                AI Appraisal
              </button>
            </div>

            {activeTab === 'transcript' ? (
              <div className="space-y-2">
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Speak or type your report here..."
                  rows={6}
                  className="bg-theme-muted w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleRefine}
                  disabled={!transcript.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-muted border border-theme-border rounded-lg hover:bg-theme-sidebar-hover disabled:opacity-50"
                >
                  <Wand2 className="w-4 h-4" />
                  Refine with AI
                </button>
              </div>
            ) : activeTab === 'refined' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-theme-text-primary mb-1">Title</label>
                  <input
                    type="text"
                    value={refined.title}
                    onChange={(e) => setRefined({ ...refined, title: e.target.value })}
                    className="bg-theme-muted w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {[
                  { key: 'activities', label: 'Activities' },
                  { key: 'meetings', label: 'Meetings' },
                  { key: 'blockers', label: 'Blockers' },
                  { key: 'nextSteps', label: 'Next Steps' },
                  { key: 'additionalNotes', label: 'Additional Notes' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-theme-text-primary mb-1">{label}</label>
                    <textarea
                      value={(refined as any)[key]}
                      onChange={(e) => setRefined({ ...refined, [key]: e.target.value })}
                      rows={3}
                      className="bg-theme-muted w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            ) : activeTab === 'appraisal' ? (
              <div className="space-y-4">
                {!refined.appraisal || refined.appraisal.overallScore === 0 ? (
                  <p className="text-sm text-theme-text-secondary">
                    No assigned tasks for this period, or refine the report first to see the appraisal.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-theme-muted p-3 rounded-lg border border-theme-border">
                        <div className="text-xs text-theme-text-secondary">Overall Score</div>
                        <div className="text-2xl font-bold text-theme-text-primary">{refined.appraisal.overallScore}/100</div>
                      </div>
                      <div className="bg-theme-muted p-3 rounded-lg border border-theme-border">
                        <div className="text-xs text-theme-text-secondary">Task Completion</div>
                        <div className="text-2xl font-bold text-theme-text-primary">{refined.appraisal.taskCompletionRate}%</div>
                      </div>
                      <div className="bg-theme-muted p-3 rounded-lg border border-theme-border">
                        <div className="text-xs text-theme-text-secondary">Report Coverage</div>
                        <div className="text-2xl font-bold text-theme-text-primary">{refined.appraisal.reportCoverage}%</div>
                      </div>
                      <div className="bg-theme-muted p-3 rounded-lg border border-theme-border">
                        <div className="text-xs text-theme-text-secondary">Quality Score</div>
                        <div className="text-2xl font-bold text-theme-text-primary">{refined.appraisal.qualityScore}%</div>
                      </div>
                    </div>
                    <p className="text-sm text-theme-text-primary">{refined.appraisal.summary}</p>
                    {refined.appraisal.unaddressedTasks.length > 0 && (
                      <div className="text-sm">
                        <span className="text-amber-400 font-medium">Unaddressed tasks:</span>
                        <ul className="list-disc list-inside mt-1 text-theme-text-secondary">
                          {refined.appraisal.unaddressedTasks.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                      </div>
                    )}
                    {refined.appraisal.completedTasks.length > 0 && (
                      <div className="text-sm">
                        <span className="text-green-400 font-medium">Completed tasks:</span>
                        <ul className="list-disc list-inside mt-1 text-theme-text-secondary">
                          {refined.appraisal.completedTasks.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : null}
          </div>

          <div className="bg-theme-muted rounded-lg border border-theme-border p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-theme-text-primary">Assigned Tasks</label>
              {loadingTasks && <Loader2 className="w-4 h-4 animate-spin text-theme-text-secondary" />}
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-theme-text-secondary">No assigned tasks for this period.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-3 p-2 rounded-lg border border-theme-border bg-theme-bg">
                    <input
                      type="checkbox"
                      checked={(taskStatuses[task.id] || task.status || 'pending') === 'completed'}
                      onChange={(e) => {
                        const next = e.target.checked ? 'completed' : 'pending';
                        setTaskStatuses((prev) => ({ ...prev, [task.id]: next }));
                      }}
                      className="mt-1 rounded border-theme-border"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-theme-text-primary">{task.title}</div>
                      <div className="text-xs text-theme-text-secondary">
                        {task.frequency} {task.dueDate ? `• due ${task.dueDate}` : ''}
                      </div>
                      {task.description && <div className="text-xs text-theme-text-secondary mt-1">{task.description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-2">Head of Department (required)</label>
            <select
              value={hodId}
              onChange={(e) => setHodId(e.target.value)}
              className="bg-theme-muted w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select HOD</option>
              {hods.map((h) => (
                <option key={h.id} value={h.id}>{h.name} — {h.department}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-2">Tag Colleagues (optional)</label>
            <div className="bg-theme-muted border border-theme-border rounded-lg p-3 max-h-40 overflow-y-auto">
              {colleagues.length === 0 ? (
                <p className="text-sm text-theme-text-secondary">No colleagues available.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {colleagues.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm text-theme-text-primary">
                      <input
                        type="checkbox"
                        checked={taggedIds.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTaggedIds((prev) => [...prev, c.id]);
                          } else {
                            setTaggedIds((prev) => prev.filter((id) => id !== c.id));
                          }
                        }}
                        className="rounded border-theme-border"
                      />
                      {c.name} — {c.department}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-theme-border">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-theme-text-secondary hover:text-theme-text-primary"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffReportModal;
