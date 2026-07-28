'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Mic, MicOff, Wand2, Send, Clock, Loader2 } from 'lucide-react';
import { HRService } from './hr-service';
import { createSpeechRecognition, listenForTranscript, refineReportWithTemplate, Task, ReportTemplateSection } from '@/lib/ai/report-refiner';

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

const DEFAULT_TEMPLATE = {
  id: 'default',
  name: 'Default Template',
  reportType: 'daily',
  isDefault: true,
  sections: [
    { key: 'objectives', label: 'Objectives', prompt: 'What were your objectives for this period?', inputType: 'textarea', keywords: ['objective', 'goal', 'target'] },
    { key: 'activities', label: 'Key Activities', prompt: 'What activities did you carry out?', inputType: 'textarea', keywords: ['activity', 'work done', 'completed'] },
    { key: 'achievements', label: 'Achievements', prompt: 'What did you accomplish?', inputType: 'textarea', keywords: ['achievement', 'accomplished', 'delivered'] },
    { key: 'meetings', label: 'Meetings', prompt: 'Meetings or calls attended.', inputType: 'textarea', keywords: ['meeting', 'call', 'sync'] },
    { key: 'blockers', label: 'Blockers / Issues', prompt: 'Any blockers or issues faced?', inputType: 'textarea', keywords: ['blocker', 'issue', 'problem'] },
    { key: 'challenges', label: 'Challenges', prompt: 'What challenges did you encounter?', inputType: 'textarea', keywords: ['challenge', 'difficulty', 'setback'] },
    { key: 'nextSteps', label: 'Next Steps', prompt: 'What are your next steps?', inputType: 'textarea', keywords: ['next step', 'plan', 'tomorrow'] },
    { key: 'additionalNotes', label: 'Additional Notes', prompt: 'Any other notes?', inputType: 'textarea', keywords: ['note', 'mention', 'additional'] },
  ] as ReportTemplateSection[],
};

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
  const [refined, setRefined] = useState(refineReportWithTemplate('', DEFAULT_TEMPLATE.sections, []));
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
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [template, setTemplate] = useState<any>(DEFAULT_TEMPLATE);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [inputMode, setInputMode] = useState<'type' | 'voice'>('type');
  const [sectionValues, setSectionValues] = useState<Record<string, string>>({});
  const [templateSnapshot, setTemplateSnapshot] = useState<any>(DEFAULT_TEMPLATE);

  const recognitionRef = useRef<ReturnType<typeof listenForTranscript> | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const hods = useMemo(() => employees.filter((e) => e.role?.toLowerCase() === 'hod'), [employees]);
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
    if (!isOpen || !tenantSlug) return;
    const loadTemplates = async () => {
      setTemplatesLoading(true);
      try {
        const fetched = await HRService.getStaffReportTemplates(tenantSlug, reportType);
        const withDefault = fetched.length > 0 ? fetched : [{ ...DEFAULT_TEMPLATE, reportType }];
        setTemplates(withDefault);
        const preferred = withDefault.find((t) => t.isDefault) || withDefault[0];
        setSelectedTemplateId(preferred.id);
        setTemplate(preferred);
        setTemplateSnapshot(preferred);
        setSectionValues({});
        setRefined(refineReportWithTemplate('', preferred.sections || [], []));
      } catch (err) {
        console.error('Failed to load templates:', err);
        setTemplates([{ ...DEFAULT_TEMPLATE, reportType }]);
        setTemplate({ ...DEFAULT_TEMPLATE, reportType });
        setTemplateSnapshot({ ...DEFAULT_TEMPLATE, reportType });
      } finally {
        setTemplatesLoading(false);
      }
    };
    loadTemplates();
  }, [isOpen, tenantSlug, reportType]);

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
    if (!transcript.trim() && inputMode === 'voice') return;
    const tasksWithStatus = tasks.map((t) => ({ ...t, status: taskStatuses[t.id] || t.status || 'pending' }));
    const result = refineReportWithTemplate(transcript, template?.sections || DEFAULT_TEMPLATE.sections, tasksWithStatus);
    setRefined(result);
    setSectionValues({
      objectives: result.objectives,
      achievements: result.achievements,
      challenges: result.challenges,
      nextSteps: result.nextSteps,
      additionalNotes: result.additionalNotes,
      meetings: result.meetings,
      blockers: result.blockers,
      activities: result.activities,
    });
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
      const submitterEmployee = employees.find((e) => e.id === submitterId);
      const tagged = colleagues.filter((c) => taggedIds.includes(c.id)).map((c) => c.name);
      const tasksWithStatus = tasks.map((t) => ({ ...t, status: taskStatuses[t.id] || t.status || 'pending' }));
      const refinedWithAppraisal = refineReportWithTemplate(transcript, template?.sections || DEFAULT_TEMPLATE.sections, tasksWithStatus);
      const title = refinedWithAppraisal.title || `${reportType} Report`;
      const refinedText = Object.entries(sectionValues)
        .filter(([, v]) => v.trim())
        .map(([k, v]) => `${(template?.sections || DEFAULT_TEMPLATE.sections).find((s: ReportTemplateSection) => s.key === k)?.label || k}:\n${v}`)
        .join('\n\n');
      await HRService.submitStaffReport(tenantSlug, {
        employeeId: submitterId,
        title,
        reportType: reportType as any,
        reportDate,
        rawTranscript: transcript,
        refinedText,
        objectives: sectionValues.objectives || refinedWithAppraisal.objectives,
        achievements: sectionValues.achievements || refinedWithAppraisal.achievements,
        challenges: sectionValues.challenges || refinedWithAppraisal.challenges,
        nextSteps: sectionValues.nextSteps || refinedWithAppraisal.nextSteps,
        additionalNotes: sectionValues.additionalNotes || refinedWithAppraisal.additionalNotes,
        meetings: sectionValues.meetings || refinedWithAppraisal.meetings,
        blockers: sectionValues.blockers || refinedWithAppraisal.blockers,
        activities: sectionValues.activities || refinedWithAppraisal.activities,
        headOfDepartment: hod?.name || '',
        teamMembers: tagged,
        appraisal: refinedWithAppraisal.appraisal,
        templateId: selectedTemplateId === 'default' ? null : selectedTemplateId,
        templateSnapshot,
        departmentId: submitterEmployee?.department || null,
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
    setRefined(refineReportWithTemplate('', DEFAULT_TEMPLATE.sections, []));
    setActiveTab('transcript');
    setError(null);
    setHodId('');
    setTaggedIds([]);
    setSubmitterId(currentEmployeeId || '');
    setTasks([]);
    setTaskStatuses({});
    setTemplates([]);
    setSelectedTemplateId('');
    setTemplate(DEFAULT_TEMPLATE);
    setTemplateSnapshot(DEFAULT_TEMPLATE);
    setSectionValues({});
    setInputMode('type');
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
            <label className="block text-xs font-medium text-theme-text-primary mb-2">
              Report Template {templatesLoading && <Loader2 className="w-3 h-3 inline animate-spin ml-1" />}
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedTemplateId(id);
                const selected = templates.find((t) => t.id === id) || DEFAULT_TEMPLATE;
                setTemplate(selected);
                setTemplateSnapshot(selected);
                setSectionValues({});
              }}
              className="bg-theme-muted w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-2">Input Mode</label>
            <div className="flex gap-2">
              {[
                { value: 'type', label: 'Type from Template' },
                { value: 'voice', label: 'Dictate by Voice' },
              ].map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setInputMode(m.value as 'type' | 'voice')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    inputMode === m.value
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      : 'bg-theme-muted text-theme-text-secondary border-theme-border hover:bg-theme-sidebar-hover'
                  }`}
                >
                  {m.label}
                </button>
              ))}
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

          {inputMode === 'voice' && (
            <div className="bg-theme-muted rounded-lg border border-theme-border p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-theme-text-primary">Voice Dictation</label>
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
          )}

          <div>
            <div className="flex gap-4 border-b border-theme-border mb-3">
              <button
                onClick={() => setActiveTab('transcript')}
                className={`pb-2 text-sm font-medium ${activeTab === 'transcript' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-theme-text-secondary'}`}
              >
                {inputMode === 'voice' ? 'Transcript' : 'Type Report'}
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
                {inputMode === 'voice' ? (
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Your exact dictated transcript appears here. Edit if needed, then click Refine with AI."
                    rows={6}
                    className="bg-theme-muted w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="space-y-4">
                    {(template?.sections || DEFAULT_TEMPLATE.sections).map((section: ReportTemplateSection) => (
                      <div key={section.key}>
                        <label className="block text-xs font-medium text-theme-text-primary mb-1">
                          {section.label} {section.required && <span className="text-red-400">*</span>}
                        </label>
                        <p className="text-xs text-theme-text-tertiary mb-1">{section.prompt}</p>
                        <textarea
                          value={sectionValues[section.key] || ''}
                          onChange={(e) => setSectionValues((prev) => ({ ...prev, [section.key]: e.target.value }))}
                          rows={section.inputType === 'bullets' ? 4 : 3}
                          className="bg-theme-muted w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {inputMode === 'voice' && (
                  <button
                    onClick={handleRefine}
                    disabled={!transcript.trim()}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-muted border border-theme-border rounded-lg hover:bg-theme-sidebar-hover disabled:opacity-50"
                  >
                    <Wand2 className="w-4 h-4" />
                    Refine with AI
                  </button>
                )}
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
                {(template?.sections || DEFAULT_TEMPLATE.sections).map((section: ReportTemplateSection) => (
                  <div key={section.key}>
                    <label className="block text-xs font-medium text-theme-text-primary mb-1">{section.label}</label>
                    <textarea
                      value={sectionValues[section.key] || (refined as any)[section.key] || ''}
                      onChange={(e) => setSectionValues((prev) => ({ ...prev, [section.key]: e.target.value }))}
                      rows={4}
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
