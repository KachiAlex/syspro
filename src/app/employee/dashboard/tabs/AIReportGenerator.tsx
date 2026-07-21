'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Loader2, Mic, MicOff, Sparkles, FileText, X, CheckCircle, AlertCircle,
  RefreshCw, Edit3, Volume2, Type, ChevronRight, ChevronLeft, Wand2,
} from 'lucide-react';

type ReportType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';

interface KpiTask { id: string; title: string; description: string | null; expected_outcome: string | null; }
interface AIGeneratedReport {
  title: string; objectives: string; achievements: string; challenges: string;
  next_steps: string; meetings: string; blockers: string; activities: string;
  additional_notes: string; kpiMetrics: { name: string; target: string; actual: string; status: string }[];
  raw_transcript: string;
}

type Step = 'input' | 'generating' | 'review';

export function AIReportGenerator({ kpis, onClose, onSubmit }: {
  kpis: KpiTask[];
  onClose: () => void;
  onSubmit: (data: { reportType: ReportType; reportDate: string; report: AIGeneratedReport }) => void;
}) {
  const [step, setStep] = useState<Step>('input');
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedReport, setGeneratedReport] = useState<AIGeneratedReport | null>(null);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');

  // Editable fields for review step
  const [editTitle, setEditTitle] = useState('');
  const [editObjectives, setEditObjectives] = useState('');
  const [editAchievements, setEditAchievements] = useState('');
  const [editChallenges, setEditChallenges] = useState('');
  const [editNextSteps, setEditNextSteps] = useState('');
  const [editMeetings, setEditMeetings] = useState('');
  const [editBlockers, setEditBlockers] = useState('');
  const [editActivities, setEditActivities] = useState('');
  const [editAdditionalNotes, setEditAdditionalNotes] = useState('');
  const [editKpiMetrics, setEditKpiMetrics] = useState<{ name: string; target: string; actual: string; status: string }[]>([]);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const isRecordingRef = useRef(false);
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

  // Keep refs in sync
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  // Check Web Speech API support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setSpeechSupported(!!SR);
    }
  }, []);

  // Setup speech recognition
  const startRecording = useCallback(async () => {
    setError(null);

    // Explicitly request mic permission first — this triggers the browser prompt
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately — we just needed the permission prompt
      stream.getTracks().forEach(t => t.stop());
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone access denied. Please allow microphone permissions in your browser settings and try again.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone or switch to text mode.');
      } else {
        setError('Could not access microphone. Please try again or switch to text mode.');
      }
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError('Speech recognition is not supported in this browser. Please use Chrome or Edge, or switch to text mode.'); setSpeechSupported(false); return; }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = transcriptRef.current;

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      setTranscript(finalTranscript.trim());
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return;
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone permissions and try again.');
      } else if (event.error === 'network') {
        setError('Network error during speech recognition. Please try again.');
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
      setIsRecording(false);
      isRecordingRef.current = false;
    };

    recognition.onend = () => {
      // Auto-restart if still recording (handles browser timeout)
      if (isRecordingRef.current) {
        try { recognition.start(); } catch {}
      } else {
        setIsRecording(false);
        setInterimText('');
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
    isRecordingRef.current = true;
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    isRecordingRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setInterimText('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const handleGenerate = async () => {
    if (transcript.trim().length < 10) { setError('Please dictate or type at least a few sentences before generating.'); return; }
    setStep('generating');
    setError(null);
    try {
      const res = await fetch('/api/hr/employees/portal/reports/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          reportType,
          reportDate,
          kpiContext: kpis.map(k => ({ title: k.title, description: k.description, expected_outcome: k.expected_outcome })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const report = data.report as AIGeneratedReport;
        setGeneratedReport(report);
        setEditTitle(report.title);
        setEditObjectives(report.objectives);
        setEditAchievements(report.achievements);
        setEditChallenges(report.challenges);
        setEditNextSteps(report.next_steps);
        setEditMeetings(report.meetings);
        setEditBlockers(report.blockers);
        setEditActivities(report.activities);
        setEditAdditionalNotes(report.additional_notes);
        setEditKpiMetrics(report.kpiMetrics || []);
        setStep('review');
      } else {
        setError(data.error || 'Failed to generate report. Please try again.');
        setStep('input');
      }
    } catch {
      setError('Network error. Please try again.');
      setStep('input');
    }
  };

  const handleSubmit = () => {
    if (!editObjectives || !editAchievements) { setError('Objectives and achievements are required'); return; }
    onSubmit({
      reportType,
      reportDate,
      report: {
        title: editTitle,
        objectives: editObjectives,
        achievements: editAchievements,
        challenges: editChallenges,
        next_steps: editNextSteps,
        meetings: editMeetings,
        blockers: editBlockers,
        activities: editActivities,
        additional_notes: editAdditionalNotes,
        kpiMetrics: editKpiMetrics,
        raw_transcript: transcript,
      },
    });
  };

  const handleRegenerate = () => {
    setStep('input');
    setGeneratedReport(null);
  };

  const reportTypes: { value: ReportType; label: string; desc: string }[] = [
    { value: 'daily', label: 'Daily', desc: 'End of day summary' },
    { value: 'weekly', label: 'Weekly', desc: 'Week in review' },
    { value: 'monthly', label: 'Monthly', desc: 'Month summary' },
    { value: 'quarterly', label: 'Quarterly', desc: 'Quarterly review' },
    { value: 'annual', label: 'Annual', desc: 'Yearly review' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full my-4 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center"><Wand2 className="w-4 h-4 text-white" /></div>
            <h3 className="text-sm font-semibold text-gray-900">AI Report Generator</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2">
          <StepBadge num={1} label="Dictate" active={step === 'input'} done={step !== 'input'} />
          <div className={`h-px flex-1 ${step !== 'input' ? 'bg-green-400' : 'bg-gray-200'}`} />
          <StepBadge num={2} label="AI Process" active={step === 'generating'} done={step === 'review'} />
          <div className={`h-px flex-1 ${step === 'review' ? 'bg-green-400' : 'bg-gray-200'}`} />
          <StepBadge num={3} label="Review & Edit" active={step === 'review'} done={false} />
        </div>

        <div className="p-6">
          {error && <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span></div>}

          {/* Step 1: Input */}
          {step === 'input' && (
            <div className="space-y-5">
              {/* Report config */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Report Type</label>
                  <select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500">
                    {reportTypes.map(rt => <option key={rt.value} value={rt.value}>{rt.label} — {rt.desc}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Report Date</label>
                  <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" />
                </div>
              </div>

              {/* KPI context */}
              {kpis.length > 0 && (
                <div className="rounded-xl bg-purple-50 border border-purple-200 p-3">
                  <p className="text-xs font-semibold text-purple-700 mb-1">AI will match your dictation to these KPIs:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {kpis.map(k => <span key={k.id} className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{k.title}</span>)}
                  </div>
                </div>
              )}

              {/* Input mode toggle */}
              <div className="flex items-center gap-2">
                <button onClick={() => setInputMode('voice')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${inputMode === 'voice' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  <Mic className="w-3.5 h-3.5" />Voice Dictation
                </button>
                <button onClick={() => { stopRecording(); setInputMode('text'); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${inputMode === 'text' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  <Type className="w-3.5 h-3.5" />Type / Paste
                </button>
              </div>

              {/* Voice input */}
              {inputMode === 'voice' && (
                <div className="space-y-3">
                  {!speechSupported && <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">Speech recognition not supported in this browser. Use Chrome or Edge, or switch to text mode.</div>}
                  <div className="flex items-center justify-center py-6">
                    <button onClick={isRecording ? stopRecording : startRecording} disabled={!speechSupported}
                      className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'} text-white disabled:opacity-40 disabled:cursor-not-allowed`}>
                      {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                      {isRecording && <span className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping" />}
                    </button>
                  </div>
                  <p className="text-center text-xs text-gray-500">{isRecording ? 'Listening... Click to stop' : 'Click the mic to start dictating'}</p>
                </div>
              )}

              {/* Transcript display */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-700">Transcript {inputMode === 'voice' && isRecording && <span className="text-red-500 ml-1">● Recording</span>}</label>
                  {wordCount > 0 && <span className="text-xs text-gray-400">{wordCount} words</span>}
                </div>
                <textarea
                  value={transcript + (interimText ? ' ' + interimText : '')}
                  onChange={(e) => { setTranscript(e.target.value); setInterimText(''); }}
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 resize-y"
                  placeholder={inputMode === 'voice' ? 'Your dictation will appear here. You can also edit manually...' : 'Type or paste your report content here. Describe what you did, what you achieved, challenges faced, and next steps...'}
                />
                {transcript && (
                  <button onClick={() => { setTranscript(''); setInterimText(''); }} className="mt-1 text-xs text-gray-400 hover:text-gray-600">Clear transcript</button>
                )}
              </div>

              {/* Tips */}
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
                <p className="text-xs font-semibold text-blue-700 mb-1">Tips for best results:</p>
                <ul className="text-xs text-blue-600 space-y-0.5">
                  <li>• Speak naturally — mention your objectives, achievements, challenges, and next steps</li>
                  <li>• Include specific numbers and metrics for KPI tracking</li>
                  <li>• Mention meetings attended and any blockers encountered</li>
                  <li>• You can edit the transcript before generating</li>
                </ul>
              </div>

              {/* Generate button */}
              <button onClick={handleGenerate} disabled={transcript.trim().length < 10}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <Sparkles className="w-4 h-4" />Generate Report with AI
              </button>
            </div>
          )}

          {/* Step 2: Generating */}
          {step === 'generating' && (
            <div className="py-16 text-center">
              <div className="relative inline-block">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                  <Wand2 className="w-8 h-8 text-white animate-pulse" />
                </div>
                <div className="absolute -inset-2 border-4 border-purple-200 rounded-2xl animate-ping opacity-75" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mt-4">AI is processing your dictation...</h3>
              <p className="text-xs text-gray-500 mt-1">Structuring your transcript into a professional {reportType} report</p>
              <div className="flex items-center justify-center gap-1.5 mt-4">
                <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                <span className="text-xs text-gray-400">This usually takes 5-10 seconds</span>
              </div>
            </div>
          )}

          {/* Step 3: Review & Edit */}
          {step === 'review' && generatedReport && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-xs text-green-700">AI generated your report. Review and edit each field below before submitting.</span>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={handleRegenerate} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />Regenerate
                </button>
                <span className="text-xs text-gray-400">Go back to edit transcript and regenerate</span>
              </div>

              {/* Editable fields */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Title</label>
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" />
              </div>

              <EditField label="Objectives" value={editObjectives} onChange={setEditObjectives} required />
              <EditField label="Achievements" value={editAchievements} onChange={setEditAchievements} required />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EditField label="Challenges" value={editChallenges} onChange={setEditChallenges} />
                <EditField label="Next Steps" value={editNextSteps} onChange={setEditNextSteps} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <EditField label="Meetings" value={editMeetings} onChange={setEditMeetings} />
                <EditField label="Blockers" value={editBlockers} onChange={setEditBlockers} />
                <EditField label="Activities" value={editActivities} onChange={setEditActivities} />
              </div>
              <EditField label="Additional Notes" value={editAdditionalNotes} onChange={setEditAdditionalNotes} />

              {/* KPI Metrics */}
              {editKpiMetrics.length > 0 && (
                <div className="border-t border-gray-200 pt-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">KPI Metrics (AI-detected)</label>
                  <div className="space-y-2">
                    {editKpiMetrics.map((m, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-gray-50">
                        <input type="text" value={m.name} onChange={(e) => setEditKpiMetrics(editKpiMetrics.map((mm, i) => i === idx ? { ...mm, name: e.target.value } : mm))} className="col-span-4 border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500" placeholder="KPI name" />
                        <input type="text" value={m.target} onChange={(e) => setEditKpiMetrics(editKpiMetrics.map((mm, i) => i === idx ? { ...mm, target: e.target.value } : mm))} className="col-span-3 border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500" placeholder="Target" />
                        <input type="text" value={m.actual} onChange={(e) => setEditKpiMetrics(editKpiMetrics.map((mm, i) => i === idx ? { ...mm, actual: e.target.value } : mm))} className="col-span-3 border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500" placeholder="Actual" />
                        <select value={m.status} onChange={(e) => setEditKpiMetrics(editKpiMetrics.map((mm, i) => i === idx ? { ...mm, status: e.target.value } : mm))} className="col-span-2 border border-gray-300 rounded px-1 py-1 text-xs outline-none">
                          <option value="not_started">—</option><option value="on_track">On Track</option><option value="ahead">Ahead</option><option value="behind">Behind</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <button onClick={handleSubmit} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                  <CheckCircle className="w-4 h-4" />Submit Report
                </button>
                <button onClick={handleRegenerate} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  <RefreshCw className="w-4 h-4" />Back to Transcript
                </button>
                <button onClick={onClose} className="ml-auto px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepBadge({ num, label, active, done }: { num: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
        {done ? <CheckCircle className="w-3.5 h-3.5" /> : num}
      </div>
      <span className={`text-xs font-medium ${active || done ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
    </div>
  );
}

function EditField({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={value ? Math.min(Math.max(value.split('\n').length, 2), 6) : 2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 resize-y" />
    </div>
  );
}
