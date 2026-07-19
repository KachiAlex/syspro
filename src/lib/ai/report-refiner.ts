/**
 * Custom rule-based report refiner.
 * No third-party AI APIs. Uses browser-native SpeechRecognition for transcription
 * and local text-processing heuristics for grammar cleanup, bullet extraction,
 * and section mapping.
 */

export interface Task {
  id: string;
  title: string;
  description?: string;
  expectedOutcome?: string;
  weight?: number;
  isKpi?: boolean;
  frequency?: string;
  dueDate?: string;
  status?: string;
  assignedBy?: string;
}

export interface ReportTemplateSection {
  key: string;
  label: string;
  prompt: string;
  required?: boolean;
  keywords?: string[];
  inputType?: 'textarea' | 'bullets' | 'checklist';
}

export interface ProductivityAppraisal {
  overallScore: number;
  taskCompletionRate: number;
  reportCoverage: number;
  qualityScore: number;
  consistencyScore: number;
  addressedTasks: string[];
  unaddressedTasks: string[];
  completedTasks: string[];
  incompleteTasks: string[];
  summary: string;
}

export interface RefinedReport {
  title: string;
  activities: string;
  meetings: string;
  blockers: string;
  nextSteps: string;
  additionalNotes: string;
  objectives: string;
  achievements: string;
  challenges: string;
  refinedText: string;
  appraisal?: ProductivityAppraisal;
}

function buildKeywordMap(sections?: ReportTemplateSection[]): Record<string, string[]> {
  const base: Record<string, string[]> = {
    activities: ['activity', 'activities', 'work done', 'completed', 'worked on', 'task', 'tasks', 'did', 'done', 'finished'],
    meetings: ['meeting', 'meetings', 'call', 'calls', 'sync', 'discussion', 'discussed', 'conference', 'standup', 'stand-up'],
    blockers: ['blocker', 'blockers', 'blocked', 'issue', 'issues', 'problem', 'problems', 'obstacle', 'challenges', 'challenge', 'difficulty', 'stuck'],
    nextSteps: ['next step', 'next steps', 'tomorrow', 'next week', 'plan', 'plans', 'will do', 'going to', 'upcoming', 'follow up', 'follow-up', 'action item'],
    additionalNotes: ['note', 'notes', 'additional', 'remark', 'remarks', 'fyi', 'mention', 'mentioned'],
    objectives: ['objective', 'objectives', 'goal', 'goals', 'aim', 'target', 'purpose'],
    achievements: ['achievement', 'achievements', 'accomplished', 'milestone', 'win', 'wins', 'success', 'delivered', 'shipped'],
    challenges: ['challenge', 'challenges', 'difficulty', 'difficult', 'hurdle', 'setback', 'roadblock', 'struggle'],
  };
  if (!sections || sections.length === 0) return base;
  const map: Record<string, string[]> = {};
  for (const s of sections) {
    map[s.key] = s.keywords && s.keywords.length > 0
      ? [...s.keywords]
      : (base[s.key] || []);
  }
  return map;
}

const SECTION_KEYWORDS: Record<keyof Omit<RefinedReport, 'title' | 'refinedText'>, string[]> = {
  activities: ['activity', 'activities', 'work done', 'completed', 'worked on', 'task', 'tasks', 'did', 'done', 'finished'],
  meetings: ['meeting', 'meetings', 'call', 'calls', 'sync', 'discussion', 'discussed', 'conference', 'standup', 'stand-up'],
  blockers: ['blocker', 'blockers', 'blocked', 'issue', 'issues', 'problem', 'problems', 'obstacle', 'challenges', 'challenge', 'difficulty', 'stuck'],
  nextSteps: ['next step', 'next steps', 'tomorrow', 'next week', 'plan', 'plans', 'will do', 'going to', 'upcoming', 'follow up', 'follow-up', 'action item'],
  additionalNotes: ['note', 'notes', 'additional', 'remark', 'remarks', 'fyi', 'mention', 'mentioned'],
  objectives: ['objective', 'objectives', 'goal', 'goals', 'aim', 'target', 'purpose'],
  achievements: ['achievement', 'achievements', 'accomplished', 'milestone', 'win', 'wins', 'success', 'delivered', 'shipped'],
  challenges: ['challenge', 'challenges', 'difficulty', 'difficult', 'hurdle', 'setback', 'roadblock', 'struggle'],
};

function toSentences(text: string): string[] {
  return text
    .replace(/([.!?])(\s+)(?=[A-Z])/g, '$1\n')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function fixCommonGrammar(text: string): string {
  let cleaned = text.trim();
  // Ensure first letter is capitalized.
  cleaned = capitalizeFirst(cleaned);
  // Ensure sentence ends with punctuation.
  if (!/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }
  // Common contractions / spoken text cleanup.
  cleaned = cleaned
    .replace(/\bi\.e\b/gi, 'i.e.')
    .replace(/\be\.g\b/gi, 'e.g.')
    .replace(/\b(dont|doesnt|didnt|cant|wont|isnt|arent|wasnt|werent|hasnt|havent|hadnt|wouldnt|couldnt|shouldnt)\b/gi, (m) => m.replace(/t$/, "n't"))
    .replace(/\b(im)\b/gi, "I'm")
    .replace(/\b(ive)\b/gi, "I've")
    .replace(/\b(youre)\b/gi, "you're")
    .replace(/\b(theyre)\b/gi, "they're");
  return cleaned;
}

function sentenceBelongsToSection(sentence: string): keyof Omit<RefinedReport, 'title' | 'refinedText'> | null {
  const lower = sentence.toLowerCase();
  let bestMatch: keyof Omit<RefinedReport, 'title' | 'refinedText'> | null = null;
  let bestScore = 0;

  for (const [section, keywords] of Object.entries(SECTION_KEYWORDS) as [keyof Omit<RefinedReport, 'title' | 'refinedText'>, string[]][]) {
    const score = keywords.reduce((acc, kw) => {
      if (lower.includes(kw)) acc += 1;
      return acc;
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = section;
    }
  }
  return bestMatch;
}

function toBullets(items: string[]): string {
  if (items.length === 0) return '';
  return items.map((item) => `• ${item}`).join('\n');
}

function sentenceBelongsToSectionWithMap(sentence: string, keywordMap: Record<string, string[]>): string | null {
  const lower = sentence.toLowerCase();
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const [section, keywords] of Object.entries(keywordMap)) {
    const score = keywords.reduce((acc, kw) => {
      if (lower.includes(kw.toLowerCase())) acc += 1;
      return acc;
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = section;
    }
  }
  return bestMatch;
}

export function refineReportText(rawText: string, sections?: ReportTemplateSection[]): RefinedReport {
  const sentences = toSentences(rawText).map(fixCommonGrammar);
  const keywordMap = buildKeywordMap(sections);

  const buckets: Record<string, string[]> = {
    activities: [],
    meetings: [],
    blockers: [],
    nextSteps: [],
    additionalNotes: [],
    objectives: [],
    achievements: [],
    challenges: [],
  };

  for (const sentence of sentences) {
    const section = sentenceBelongsToSectionWithMap(sentence, keywordMap);
    if (section && buckets[section] !== undefined) {
      buckets[section].push(sentence);
    } else if (section && sections) {
      // Unknown section from template still gets captured.
      buckets[section] = buckets[section] || [];
      buckets[section].push(sentence);
    } else {
      // Default to activities if no section matches.
      buckets.activities.push(sentence);
    }
  }

  // Build a coherent refined paragraph from all sentences.
  const refinedText = sentences.join(' ');

  // Generate a title from the first sentence or a fallback.
  const title = sentences.length > 0
    ? sentences[0].replace(/\.$/, '').slice(0, 60) + (sentences[0].length > 60 ? '...' : '')
    : 'Untitled Report';

  return {
    title,
    activities: toBullets(buckets.activities),
    meetings: toBullets(buckets.meetings),
    blockers: toBullets(buckets.blockers),
    nextSteps: toBullets(buckets.nextSteps),
    additionalNotes: toBullets(buckets.additionalNotes),
    objectives: toBullets(buckets.objectives),
    achievements: toBullets(buckets.achievements),
    challenges: toBullets(buckets.challenges),
    refinedText,
  };
}

function normalizeTaskText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractKeywords(text: string): string[] {
  return normalizeTaskText(text).split(' ').filter((w) => w.length > 3);
}

function taskIsMentioned(task: Task, reportText: string): boolean {
  const normalizedReport = normalizeTaskText(reportText);
  const titleKeywords = extractKeywords(task.title);
  const descKeywords = task.description ? extractKeywords(task.description) : [];
  const outcomeKeywords = task.expectedOutcome ? extractKeywords(task.expectedOutcome) : [];
  const allKeywords = [...new Set([...titleKeywords, ...descKeywords, ...outcomeKeywords])];

  if (allKeywords.length === 0) return false;
  const matched = allKeywords.filter((kw) => normalizedReport.includes(kw));
  return matched.length / allKeywords.length >= 0.35;
}

function taskIsCompleted(task: Task, reportText: string): boolean {
  if (task.status === 'completed') return true;
  const normalizedReport = normalizeTaskText(reportText);
  const completionPhrases = [
    'completed', 'done', 'finished', 'accomplished', 'wrapped up', 'finalized',
    'achieved', 'resolved', 'closed', 'delivered', 'shipped', 'implemented'
  ];
  const taskKeywords = extractKeywords(task.title);
  if (taskKeywords.length === 0) return false;
  const titleContext = taskKeywords.some((kw) => normalizedReport.includes(kw));
  if (!titleContext) return false;
  return completionPhrases.some((phrase) => normalizedReport.includes(phrase));
}

function weightedAverage(values: number[], weights: number[]): number {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) return 0;
  const sum = values.reduce((acc, v, i) => acc + v * weights[i], 0);
  return Math.round(sum / totalWeight);
}

function calculateQualityScore(refined: RefinedReport): number {
  const sections = [
    refined.activities,
    refined.meetings,
    refined.blockers,
    refined.nextSteps,
    refined.additionalNotes,
  ];
  const filledSections = sections.filter((s) => s.trim().length > 0).length;
  const rawLength = refined.refinedText.length;
  const lengthScore = Math.min(100, Math.round((rawLength / 300) * 100));
  const structureScore = Math.round((filledSections / sections.length) * 100);
  return Math.round(lengthScore * 0.4 + structureScore * 0.6);
}

export function appraiseProductivity(
  refined: RefinedReport,
  tasks: Task[],
  options?: { previousReportCount?: number; onTimeSubmissions?: number }
): ProductivityAppraisal {
  if (tasks.length === 0) {
    return {
      overallScore: 0,
      taskCompletionRate: 0,
      reportCoverage: 0,
      qualityScore: 0,
      consistencyScore: 0,
      addressedTasks: [],
      unaddressedTasks: [],
      completedTasks: [],
      incompleteTasks: [],
      summary: 'No assigned tasks for this period.',
    };
  }

  const reportText = refined.refinedText;
  const addressedTasks: string[] = [];
  const unaddressedTasks: string[] = [];
  const completedTasks: string[] = [];
  const incompleteTasks: string[] = [];

  for (const task of tasks) {
    const mentioned = taskIsMentioned(task, reportText);
    if (mentioned) {
      addressedTasks.push(task.title);
      const completed = taskIsCompleted(task, reportText);
      if (completed) {
        completedTasks.push(task.title);
      } else {
        incompleteTasks.push(task.title);
      }
    } else {
      unaddressedTasks.push(task.title);
      incompleteTasks.push(task.title);
    }
  }

  const weights = tasks.map((t) => t.weight && t.weight > 0 ? t.weight : 1);
  const taskCompletionRate = Math.round(weightedAverage(tasks.map((t) => completedTasks.includes(t.title) ? 100 : 0), weights));
  const reportCoverage = Math.round(weightedAverage(tasks.map((t) => addressedTasks.includes(t.title) ? 100 : 0), weights));
  const qualityScore = calculateQualityScore(refined);

  const totalSubmissions = (options?.previousReportCount ?? 0) + 1;
  const onTime = options?.onTimeSubmissions ?? 1;
  const consistencyScore = Math.round((onTime / totalSubmissions) * 100);

  const overallScore = Math.round(
    taskCompletionRate * 0.35 +
    reportCoverage * 0.25 +
    qualityScore * 0.25 +
    consistencyScore * 0.15
  );

  let summary = '';
  if (overallScore >= 80) {
    summary = `Strong productivity. ${completedTasks.length} of ${tasks.length} tasks completed and ${addressedTasks.length} addressed in the report.`;
  } else if (overallScore >= 50) {
    summary = `Moderate productivity. ${completedTasks.length} of ${tasks.length} tasks completed; ${unaddressedTasks.length} tasks were not addressed in the report.`;
  } else {
    summary = `Low productivity. Only ${completedTasks.length} of ${tasks.length} tasks completed and ${unaddressedTasks.length} tasks were not addressed.`;
  }

  return {
    overallScore,
    taskCompletionRate,
    reportCoverage,
    qualityScore,
    consistencyScore,
    addressedTasks,
    unaddressedTasks,
    completedTasks,
    incompleteTasks,
    summary,
  };
}

export function refineReportWithAppraisal(rawText: string, tasks: Task[], appraisalOptions?: {
  previousReportCount?: number;
  onTimeSubmissions?: number;
}, sections?: ReportTemplateSection[]): RefinedReport {
  const refined = refineReportText(rawText, sections);
  const appraisal = appraiseProductivity(refined, tasks, appraisalOptions);
  return { ...refined, appraisal };
}

export function refineReportWithTemplate(rawText: string, sections: ReportTemplateSection[], tasks: Task[], appraisalOptions?: {
  previousReportCount?: number;
  onTimeSubmissions?: number;
}): RefinedReport {
  const refined = refineReportText(rawText, sections);
  const appraisal = appraiseProductivity(refined, tasks, appraisalOptions);
  return { ...refined, appraisal };
}

/**
 * Browser-native SpeechRecognition wrapper.
 * Returns a transcript string and stops automatically at maxDurationMs.
 */
export type SpeechRecognitionState = 'idle' | 'listening' | 'processing' | 'error';

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

export function createSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null;
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    (window as any).mozSpeechRecognition ||
    (window as any).msSpeechRecognition;
  if (!SpeechRecognition) return null;
  return new SpeechRecognition() as SpeechRecognitionLike;
}

export function listenForTranscript(
  recognition: SpeechRecognitionLike,
  options: { maxDurationMs: number; onInterim?: (text: string) => void; onError?: (err: string) => void }
): { stop: () => void; promise: Promise<string> } {
  let finalTranscript = '';
  let interimTranscript = '';
  let stopped = false;
  let timeoutId: any = null;

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event: any) => {
    interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript += transcript;
      }
    }
    options.onInterim?.(finalTranscript + interimTranscript);
  };

  recognition.onerror = (event: any) => {
    if (event.error !== 'aborted') {
      options.onError?.(event.error || 'Speech recognition error');
    }
  };

  recognition.onend = () => {
    if (!stopped) {
      // Auto-restart until timeout fires.
      recognition.start();
    }
  };

  recognition.start();

  timeoutId = setTimeout(() => {
    stopped = true;
    recognition.stop();
  }, options.maxDurationMs);

  const stop = () => {
    stopped = true;
    clearTimeout(timeoutId);
    recognition.stop();
  };

  const promise = new Promise<string>((resolve) => {
    const checkInterval = setInterval(() => {
      if (stopped) {
        clearInterval(checkInterval);
        resolve(finalTranscript.trim());
      }
    }, 250);
  });

  return { stop, promise };
}
