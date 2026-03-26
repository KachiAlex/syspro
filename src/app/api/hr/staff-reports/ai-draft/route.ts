import { NextRequest, NextResponse } from 'next/server';

interface ReportDraft {
  objectives: string;
  achievements: string;
  challenges: string;
  nextSteps: string;
  additionalNotes: string;
}

const SECTION_CONFIG = [
  { key: 'objectives', labels: ['objective', 'objectives', 'goal', 'goals', 'plan'] },
  { key: 'achievements', labels: ['achievement', 'achievements', 'progress', 'completed', 'delivered'] },
  { key: 'challenges', labels: ['challenge', 'challenges', 'blocker', 'issue', 'risk'] },
  { key: 'nextSteps', labels: ['next step', 'next steps', 'upcoming', 'plan next', 'action item'] },
  { key: 'additionalNotes', labels: ['note', 'notes', 'feedback', 'remark'] },
] as const;

const FALLBACK_COPY: ReportDraft = {
  objectives: 'Summarize the main goals you mentioned during your recording.',
  achievements: 'Highlight the work you completed or progress made.',
  challenges: 'List blockers, risks, or support you may need.',
  nextSteps: 'Outline what you will focus on next.',
  additionalNotes: 'Add any extra context, dependencies, or shout-outs.',
};

const LLAMA_API_URL = process.env.LLAMA_API_URL || 'http://localhost:11434/api/generate';
const LLAMA_MODEL = process.env.LLAMA_MODEL || 'llama3.1:70b';
const LLAMA_TIMEOUT_MS = Number(process.env.LLAMA_TIMEOUT_MS || 8000);
const ENABLE_LLAMA = process.env.DISABLE_LLAMA_AGENT !== 'true';

function sanitizeTranscript(transcript: string): string {
  return transcript.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();
}

function sliceByMarkers(transcript: string) {
  const lowered = transcript.toLowerCase();
  const markerPositions: { key: keyof ReportDraft; start: number; end: number }[] = [];

  SECTION_CONFIG.forEach(({ key, labels }) => {
    for (const label of labels) {
      const indicator = `${label}:`;
      const idx = lowered.indexOf(indicator);
      if (idx !== -1) {
        markerPositions.push({ key: key as keyof ReportDraft, start: idx, end: idx + indicator.length });
        break;
      }
    }
  });

  if (markerPositions.length === 0) {
    return null;
  }

  markerPositions.sort((a, b) => a.start - b.start);

  const sections: Partial<ReportDraft> = {};

  markerPositions.forEach((marker, index) => {
    const nextMarker = markerPositions[index + 1];
    const chunk = transcript.slice(marker.end, nextMarker ? nextMarker.start : transcript.length).trim();
    if (chunk) {
      sections[marker.key] = chunk;
    }
  });

  return sections;
}

function chunkTranscript(transcript: string): ReportDraft {
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return { ...FALLBACK_COPY };
  }

  const quarter = Math.max(1, Math.ceil(sentences.length / 4));

  const buildChunk = (start: number, end: number) => sentences.slice(start, end).join(' ').trim();

  const objectives = buildChunk(0, quarter) || FALLBACK_COPY.objectives;
  const achievements = buildChunk(quarter, quarter * 2) || FALLBACK_COPY.achievements;
  const challenges = buildChunk(quarter * 2, quarter * 3) || FALLBACK_COPY.challenges;
  const nextSteps = buildChunk(quarter * 3, sentences.length) || FALLBACK_COPY.nextSteps;

  const leftovers = sentences.slice(quarter * 4).join(' ').trim();

  return {
    objectives,
    achievements,
    challenges,
    nextSteps,
    additionalNotes: leftovers || FALLBACK_COPY.additionalNotes,
  };
}

function deriveDraft(transcript: string): ReportDraft {
  const markerSections = sliceByMarkers(transcript);
  if (markerSections) {
    return {
      objectives: markerSections.objectives || FALLBACK_COPY.objectives,
      achievements: markerSections.achievements || FALLBACK_COPY.achievements,
      challenges: markerSections.challenges || FALLBACK_COPY.challenges,
      nextSteps: markerSections.nextSteps || FALLBACK_COPY.nextSteps,
      additionalNotes: markerSections.additionalNotes || FALLBACK_COPY.additionalNotes,
    };
  }

  return chunkTranscript(transcript);
}

function buildLlamaPrompt(transcript: string): string {
  return `You are an expert HR reporting assistant. Convert the provided staff transcript into a structured JSON object with these exact keys:
{
  "objectives": string,
  "achievements": string,
  "challenges": string,
  "nextSteps": string,
  "additionalNotes": string
}

Guidelines:
- Rephrase content in professional tone suitable for a manager or HR review.
- Preserve every important detail (metrics, blockers, names) when possible.
- If a section is not mentioned, infer a short helpful summary such as "No blockers reported" rather than leaving it blank.
- NEVER include commentary outside of the JSON object. No markdown, no prose, no explanations.

Transcript:
"""
${transcript}
"""`;
}

function extractJsonPayload(text: string): string | null {
  if (!text) {
    return null;
  }

  const sanitized = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const start = sanitized.indexOf('{');
  const end = sanitized.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return sanitized.slice(start, end + 1);
}

async function generateDraftWithLlama(transcript: string): Promise<ReportDraft | null> {
  if (!ENABLE_LLAMA) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLAMA_TIMEOUT_MS);

    const response = await fetch(LLAMA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: LLAMA_MODEL,
        prompt: buildLlamaPrompt(transcript),
        stream: false,
        temperature: 0.2,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error('Llama API error:', await response.text());
      return null;
    }

    const data = await response.json();
    const rawOutput = data?.response || data?.message || '';
    const jsonPayload = extractJsonPayload(rawOutput);

    if (!jsonPayload) {
      return null;
    }

    let parsed: Partial<ReportDraft> = {};

    try {
      parsed = JSON.parse(jsonPayload);
    } catch (parseError) {
      console.error('Failed to parse Llama output as JSON:', parseError);
      return null;
    }

    return {
      objectives: parsed.objectives || FALLBACK_COPY.objectives,
      achievements: parsed.achievements || FALLBACK_COPY.achievements,
      challenges: parsed.challenges || FALLBACK_COPY.challenges,
      nextSteps: parsed.nextSteps || FALLBACK_COPY.nextSteps,
      additionalNotes: parsed.additionalNotes || FALLBACK_COPY.additionalNotes,
    };
  } catch (error) {
    console.error('Llama draft generation error:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcript, reportType } = body;

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json(
        { error: 'Transcript is required' },
        { status: 400 }
      );
    }

    const cleanedTranscript = sanitizeTranscript(transcript);

    if (!cleanedTranscript) {
      return NextResponse.json(
        { error: 'Transcript is empty after cleaning' },
        { status: 400 }
      );
    }

    const llamaDraft = await generateDraftWithLlama(cleanedTranscript);
    const reportDraft = llamaDraft || deriveDraft(cleanedTranscript);

    return NextResponse.json({
      reportDraft,
      metadata: {
        reportType: reportType || 'daily',
        transcriptLength: cleanedTranscript.length,
        source: llamaDraft ? 'llama' : 'heuristic',
        model: llamaDraft ? LLAMA_MODEL : null,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('AI draft generation error:', error);
    return NextResponse.json(
      { error: 'Unable to generate report draft' },
      { status: 500 }
    );
  }
}
