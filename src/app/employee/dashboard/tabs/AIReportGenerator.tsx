'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Loader2, Mic, MicOff, Sparkles, X, CheckCircle, AlertCircle,
  RefreshCw, Type, Wand2, ChevronRight, ArrowRight, ArrowLeft,
} from 'lucide-react';

type ReportType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';

interface KpiTask { id: string; title: string; description: string | null; expected_outcome: string | null; }
interface AIGeneratedReport {
  title: string; objectives: string; achievements: string; challenges: string;
  next_steps: string; meetings: string; blockers: string; activities: string;
  additional_notes: string; kpiMetrics: { name: string; target: string; actual: string; status: string }[];
  raw_transcript: string;
}

type Step = 'setup' | 'dictate' | 'generating' | 'review';

interface DictationSection {
  key: string;
  label: string;
  prompt: string;
  placeholder: string;
  required: boolean;
  icon: string;
}

const DICTATION_SECTIONS: DictationSection[] = [
  {
    key: 'activities',
    label: 'Activities',
    prompt: "What did you do today? Describe the main tasks and activities you worked on.",
    placeholder: "e.g., I worked on the quarterly financial report, attended a team meeting about the new project, and reviewed three vendor proposals...",
    required: true,
    icon: '📋',
  },
  {
    key: 'achievements',
    label: 'Achievements',
    prompt: "What did you accomplish or complete? Mention any milestones, deliverables, or successes.",
    placeholder: "e.g., I completed the financial analysis ahead of schedule, resolved the client billing issue, and got approval for the new budget...",
    required: true,
    icon: '🎯',
  },
  {
    key: 'objectives',
    label: 'Objectives',
    prompt: "What were your goals or objectives for this period? What did you set out to achieve?",
    placeholder: "e.g., My main objective was to finalize the Q3 report, close out the vendor selection process, and prepare the team presentation...",
    required: true,
    icon: '📌',
  },
  {
    key: 'challenges',
    label: 'Challenges',
    prompt: "Did you face any challenges or difficulties? Describe what was hard and how you handled it.",
    placeholder: "e.g., The main challenge was missing data from the finance team which delayed the report. I had to follow up multiple times...",
    required: false,
    icon: '⚠️',
  },
  {
    key: 'meetings',
    label: 'Meetings',
    prompt: "What meetings did you attend? Briefly mention who they were with and what was discussed.",
    placeholder: "e.g., I had a 1-on-1 with my manager about project priorities, and a team standup where we discussed the sprint progress...",
    required: false,
    icon: '👥',
  },
  {
    key: 'blockers',
    label: 'Blockers',
    prompt: "Is anything blocking your progress? Are you waiting on anything or anyone?",
    placeholder: "e.g., I'm blocked on the vendor selection because I'm waiting for the procurement team to approve the shortlist...",
    required: false,
    icon: '🚫',
  },
  {
    key: 'next_steps',
    label: 'Next Steps',
    prompt: "What are your next steps? What will you work on next?",
    placeholder: "e.g., Tomorrow I'll start on the monthly reconciliation, follow up with procurement, and prepare the board presentation draft...",
    required: false,
    icon: '➡️',
  },
  {
    key: 'additional_notes',
    label: 'Additional Notes',
    prompt: "Anything else you'd like to add? Any notes, observations, or context for your manager?",
    placeholder: "e.g., I'd like to flag that the current reporting tool is slowing us down and we should consider upgrading...",
    required: false,
    icon: '📝',
  },
];

export function AIReportGenerator({ kpis, onClose, onSubmit }: {
  kpis: KpiTask[];
  onClose: () => void;
  onSubmit: (data: { reportType: ReportType; reportDate: string; report: AIGeneratedReport }) => void;
}) {
  const [step, setStep] = useState<Step>('setup');
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  const [generatedReport, setGeneratedReport] = useState<AIGeneratedReport | null>(null);

  // Dictation state
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [sectionTranscripts, setSectionTranscripts] = useState<Record<string, string>>({});
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
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

  useEffect(() => { transcriptRef.current = currentTranscript; }, [currentTranscript]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setSpeechSupported(!!SR);
    }
  }, []);

  const currentSection = DICTATION_SECTIONS[currentSectionIdx];
  const completedSections = DICTATION_SECTIONS.filter(s => sectionTranscripts[s.key]?.trim().length > 0).length;
  const totalSections = DICTATION_SECTIONS.length;

  const startRecording = useCallback(async () => {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone access requires HTTPS. Please switch to text mode.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone access denied. Please allow microphone permissions in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone or switch to text mode.');
      } else {
        setError('Could not access microphone. Please try again or switch to text mode.');
      }
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge, or switch to text mode.');
      setSpeechSupported(false);
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    let finalTranscript = transcriptRef.current;
    let networkRetryCount = 0;
    let restartDelay = 1000; // Start with 1s delay, increase exponentially

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
      setCurrentTranscript(finalTranscript.trim());
      setInterimText(interim);
      // Reset retry state on successful result
      networkRetryCount = 0;
      restartDelay = 1000;
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone access denied. Please allow microphone permissions.');
        setIsRecording(false);
        isRecordingRef.current = false;
        return;
      }
      if (event.error === 'network' || event.error === 'audio-capture') {
        // Unlimited retries with exponential backoff — don't stop recording
        // The onend handler will fire and restart after a delay
        networkRetryCount++;
        restartDelay = Math.min(restartDelay * 1.5, 5000); // Cap at 5s
        console.log(`Speech network error, will retry in ${Math.round(restartDelay)}ms (attempt ${networkRetryCount})`);
        // Don't show error to user — just silently retry
        // Transcript so far is preserved in finalTranscript
        return;
      }
      // For other errors, don't stop — let onend handle restart
      console.error('Speech recognition error:', event.error);
      return;
    };

    recognition.onend = () => {
      if (isRecordingRef.current) {
        // Restart with delay — longer if we've had network errors
        const delay = networkRetryCount > 0 ? restartDelay : 100;
        setTimeout(() => {
          if (!isRecordingRef.current) return;
          try {
            recognition.start();
          } catch {
            // If already started, try again after a longer delay
            setTimeout(() => {
              if (isRecordingRef.current) {
                try { recognition.start(); } catch {}
              }
            }, 500);
          }
        }, delay);
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

  useEffect(() => {
    return () => { if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} } };
  }, []);

  const goToSection = (idx: number) => {
    stopRecording();
    if (idx < 0 || idx >= DICTATION_SECTIONS.length) return;
    if (currentTranscript.trim()) {
      setSectionTranscripts(prev => ({ ...prev, [currentSection.key]: currentTranscript.trim() }));
    }
    setCurrentSectionIdx(idx);
    const sectionKey = DICTATION_SECTIONS[idx].key;
    setCurrentTranscript(sectionTranscripts[sectionKey] || '');
    setError(null);
  };

  const handleNextSection = () => {
    stopRecording();
    if (currentTranscript.trim()) {
      setSectionTranscripts(prev => ({ ...prev, [currentSection.key]: currentTranscript.trim() }));
    }
    if (currentSectionIdx < DICTATION_SECTIONS.length - 1) {
      const nextIdx = currentSectionIdx + 1;
      setCurrentSectionIdx(nextIdx);
      const nextKey = DICTATION_SECTIONS[nextIdx].key;
      setCurrentTranscript(sectionTranscripts[nextKey] || '');
      setError(null);
    } else {
      const allTranscripts = { ...sectionTranscripts };
      if (currentTranscript.trim()) {
        allTranscripts[currentSection.key] = currentTranscript.trim();
      }
      setSectionTranscripts(allTranscripts);
      handleGenerate(allTranscripts);
    }
  };

  const handlePrevSection = () => {
    stopRecording();
    if (currentTranscript.trim()) {
      setSectionTranscripts(prev => ({ ...prev, [currentSection.key]: currentTranscript.trim() }));
    }
    if (currentSectionIdx > 0) {
      const prevIdx = currentSectionIdx - 1;
      setCurrentSectionIdx(prevIdx);
      const prevKey = DICTATION_SECTIONS[prevIdx].key;
      setCurrentTranscript(sectionTranscripts[prevKey] || '');
      setError(null);
    }
  };

  const handleSkipSection = () => {
    stopRecording();
    setCurrentTranscript('');
    if (currentSectionIdx < DICTATION_SECTIONS.length - 1) {
      handleNextSection();
    } else {
      handleGenerate({ ...sectionTranscripts, [currentSection.key]: '' });
    }
  };

  const buildCombinedTranscript = (transcripts: Record<string, string>) => {
    const parts: string[] = [];
    for (const section of DICTATION_SECTIONS) {
      const text = transcripts[section.key]?.trim();
      if (text) {
        parts.push(`[${section.label.toUpperCase()}]\n${text}`);
      }
    }
    return parts.join('\n\n');
  };

  const handleGenerate = async (transcripts?: Record<string, string>) => {
    const allTranscripts = transcripts || sectionTranscripts;
    const combined = buildCombinedTranscript(allTranscripts);

    if (combined.trim().length < 10) {
      setError('Please dictate or type content for at least one section before generating.');
      setStep('dictate');
      return;
    }

    setStep('generating');
    setError(null);
    try {
      const res = await fetch('/api/hr/employees/portal/reports/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: combined,
          reportType,
          reportDate,
          kpiContext: kpis.map(k => ({ title: k.title, description: k.description, expected_outcome: k.expected_outcome })),
          sectioned: true,
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
        setStep('dictate');
      }
    } catch {
      setError('Network error. Please try again.');
      setStep('dictate');
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
        raw_transcript: buildCombinedTranscript(sectionTranscripts),
      },
    });
  };

  const handleRegenerate = () => {
    setStep('dictate');
    setGeneratedReport(null);
    setCurrentSectionIdx(0);
    setCurrentTranscript(sectionTranscripts[DICTATION_SECTIONS[0].key] || '');
  };

  const reportTypes: { value: ReportType; label: string; desc: string }[] = [
    { value: 'daily', label: 'Daily', desc: 'End of day summary' },
    { value: 'weekly', label: 'Weekly', desc: 'Week in review' },
    { value: 'monthly', label: 'Monthly', desc: 'Month summary' },
    { value: 'quarterly', label: 'Quarterly', desc: 'Quarterly review' },
    { value: 'annual', label: 'Annual', desc: 'Yearly review' },
  ];

  const wordCount = currentTranscript.trim().split(/\s+/).filter(Boolean).length;

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
          <StepBadge num={1} label="Setup" active={step === 'setup'} done={step !== 'setup'} />
          <div className={`h-px flex-1 ${step !== 'setup' ? 'bg-green-400' : 'bg-gray-200'}`} />
          <StepBadge num={2} label="Dictate" active={step === 'dictate'} done={step === 'generating' || step === 'review'} />
          <div className={`h-px flex-1 ${step === 'generating' || step === 'review' ? 'bg-green-400' : 'bg-gray-200'}`} />
          <StepBadge num={3} label="AI Process" active={step === 'generating'} done={step === 'review'} />
          <div className={`h-px flex-1 ${step === 'review' ? 'bg-green-400' : 'bg-gray-200'}`} />
          <StepBadge num={4} label="Review" active={step === 'review'} done={false} />
        </div>

        <div className="p-6">
          {error && <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span></div>}

          {/* Step 1: Setup */}
          {step === 'setup' && (
            <div className="space-y-5">
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Wand2 className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">Generate a Report with AI</h3>
                <p className="text-sm text-gray-500 mt-1">Dictate or type your report section by section, and AI will structure it into a professional report.</p>
              </div>

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

              {kpis.length > 0 && (
                <div className="rounded-xl bg-purple-50 border border-purple-200 p-3">
                  <p className="text-xs font-semibold text-purple-700 mb-1">Your KPIs — mention progress on these during dictation:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {kpis.map(k => <span key={k.id} className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{k.title}</span>)}
                  </div>
                </div>
              )}

              {/* Section preview */}
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">You'll be guided through {DICTATION_SECTIONS.length} sections:</p>
                <div className="grid grid-cols-2 gap-2">
                  {DICTATION_SECTIONS.map((s, i) => (
                    <div key={s.key} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">{i + 1}</span>
                      <span>{s.icon}</span>
                      <span>{s.label}</span>
                      {s.required && <span className="text-red-400">*</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => setInputMode('voice')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${inputMode === 'voice' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  <Mic className="w-3.5 h-3.5" />Voice Dictation
                </button>
                <button onClick={() => setInputMode('text')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${inputMode === 'text' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  <Type className="w-3.5 h-3.5" />Type / Paste
                </button>
              </div>

              <button onClick={() => { setStep('dictate'); setCurrentSectionIdx(0); setCurrentTranscript(''); setSectionTranscripts({}); }} className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all">
                Start Guided Dictation <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 2: Dictate (section by section) */}
          {step === 'dictate' && (
            <div className="space-y-4">
              {/* Progress bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-blue-600 rounded-full transition-all duration-300" style={{ width: `${(completedSections / totalSections) * 100}%` }} />
                </div>
                <span className="text-xs font-medium text-gray-500">{completedSections}/{totalSections}</span>
              </div>

              {/* Section tabs */}
              <div className="flex flex-wrap gap-1">
                {DICTATION_SECTIONS.map((s, i) => {
                  const isDone = sectionTranscripts[s.key]?.trim().length > 0;
                  const isCurrent = i === currentSectionIdx;
                  return (
                    <button key={s.key} onClick={() => goToSection(i)} className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${isCurrent ? 'bg-blue-600 text-white' : isDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {isDone && <CheckCircle className="w-3 h-3" />}
                      <span>{s.icon}</span>
                      <span>{s.label}</span>
                      {s.required && !isDone && <span className="text-red-400">*</span>}
                    </button>
                  );
                })}
              </div>

              {/* Current section prompt */}
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{currentSection.icon}</div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900">Section {currentSectionIdx + 1}: {currentSection.label}{currentSection.required && <span className="text-red-500 ml-1">*</span>}</h4>
                    <p className="text-sm text-blue-700 mt-1">{currentSection.prompt}</p>
                  </div>
                </div>
              </div>

              {/* Voice input */}
              {inputMode === 'voice' && (
                <div className="flex items-center justify-center py-4">
                  <button onClick={isRecording ? stopRecording : startRecording}
                    className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'} text-white`}>
                    {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    {isRecording && <span className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping" />}
                  </button>
                </div>
              )}

              {/* Transcript */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-700">
                    {currentSection.label} {isRecording && <span className="text-red-500 ml-1">● Recording</span>}
                  </label>
                  {wordCount > 0 && <span className="text-xs text-gray-400">{wordCount} words</span>}
                </div>
                <textarea
                  value={currentTranscript + (interimText ? ' ' + interimText : '')}
                  onChange={(e) => { setCurrentTranscript(e.target.value); setInterimText(''); }}
                  rows={5}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 resize-y"
                  placeholder={currentSection.placeholder}
                />
                {currentTranscript && (
                  <button onClick={() => { setCurrentTranscript(''); setInterimText(''); }} className="mt-1 text-xs text-gray-400 hover:text-gray-600">Clear this section</button>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <button onClick={handlePrevSection} disabled={currentSectionIdx === 0} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                  <ArrowLeft className="w-3.5 h-3.5" />Previous
                </button>

                <div className="flex items-center gap-2">
                  {!currentSection.required && (
                    <button onClick={handleSkipSection} className="px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-600">Skip</button>
                  )}
                  {currentSectionIdx < DICTATION_SECTIONS.length - 1 ? (
                    <button onClick={handleNextSection} className="inline-flex items-center gap-1 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                      Next Section <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button onClick={handleNextSection} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:from-purple-700 hover:to-blue-700">
                      <Sparkles className="w-3.5 h-3.5" />Generate Report
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Generating */}
          {step === 'generating' && (
            <div className="py-16 text-center">
              <div className="relative inline-block">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                  <Wand2 className="w-8 h-8 text-white animate-pulse" />
                </div>
                <div className="absolute -inset-2 border-4 border-purple-200 rounded-2xl animate-ping opacity-75" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mt-4">AI is refining your report...</h3>
              <p className="text-xs text-gray-500 mt-1">Structuring your dictation into a professional {reportType} report</p>
              <div className="flex items-center justify-center gap-1.5 mt-4">
                <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                <span className="text-xs text-gray-400">This usually takes 5-10 seconds</span>
              </div>
            </div>
          )}

          {/* Step 4: Review & Edit */}
          {step === 'review' && generatedReport && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-xs text-green-700">AI generated your report from {completedSections} sections. Review and edit before submitting.</span>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={handleRegenerate} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                  <RefreshCw className="w-3.5 h-3.5" />Back to Dictation
                </button>
              </div>

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

              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <button onClick={handleSubmit} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                  <CheckCircle className="w-4 h-4" />Submit Report
                </button>
                <button onClick={handleRegenerate} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                  <RefreshCw className="w-4 h-4" />Back to Dictation
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
