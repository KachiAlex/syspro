"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, X, Send, Loader2, Bot, User, ChevronDown, ChevronRight } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  capability?: string;
  metadata?: { source: string; durationMs: number; conversationId?: string };
  result?: unknown;
  timestamp: string;
}

const CAPABILITY_OPTIONS = [
  { value: "summarize", label: "Summarize", description: "Summarize a department, CRM pipeline, or reports" },
  { value: "proactive_insights", label: "Insights", description: "Detect anomalies and actionable patterns" },
  { value: "generate_report", label: "Report", description: "Convert transcript to structured report" },
  { value: "appraise_performance", label: "Appraise", description: "Generate a performance appraisal" },
  { value: "generate_training_plan", label: "Training Plan", description: "Create a training plan from appraisal" },
  { value: "screen_candidates", label: "Screen", description: "Score and rank job candidates" },
];

export function AIChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedCapability, setSelectedCapability] = useState("summarize");
  const [showCapabilityMenu, setShowCapabilityMenu] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const toggleResult = (idx: number) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const convId = conversationId || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      if (!conversationId) setConversationId(convId);

      const payload = buildPayload(selectedCapability, userMsg.content);

      const res = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capability: selectedCapability,
          payload,
          conversationId: convId,
        }),
      });

      const data = await res.json();

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: formatResult(data),
        capability: selectedCapability,
        metadata: data.metadata,
        result: data.result,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err.message || "Failed to get response"}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, selectedCapability, conversationId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setExpandedResults(new Set());
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col border-l border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">AI Assistant</h2>
              <p className="text-xs text-blue-100">
                {conversationId ? "Conversation active" : "New conversation"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewConversation}
              className="text-xs text-blue-100 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
              title="New conversation"
            >
              New
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Capability selector */}
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 relative">
          <button
            onClick={() => setShowCapabilityMenu(!showCapabilityMenu)}
            className="flex items-center gap-2 w-full text-left text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <Bot className="w-4 h-4 text-blue-600" />
            <span className="flex-1">
              {CAPABILITY_OPTIONS.find((c) => c.value === selectedCapability)?.label || "Select capability"}
            </span>
            {showCapabilityMenu ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {showCapabilityMenu && (
            <div className="absolute left-4 right-4 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 py-1">
              {CAPABILITY_OPTIONS.map((cap) => (
                <button
                  key={cap.value}
                  onClick={() => {
                    setSelectedCapability(cap.value);
                    setShowCapabilityMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
                    selectedCapability === cap.value ? "bg-blue-50 dark:bg-blue-900/30" : ""
                  }`}
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{cap.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{cap.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ask the AI Agent
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                Select a capability above and type your request. The agent will analyze your data and respond with insights, reports, or recommendations.
              </p>
              <div className="mt-4 space-y-1.5 text-left max-w-xs mx-auto">
                {CAPABILITY_OPTIONS.slice(0, 3).map((cap) => (
                  <button
                    key={cap.value}
                    onClick={() => setSelectedCapability(cap.value)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs"
                  >
                    <span className="font-medium text-slate-700 dark:text-slate-300">{cap.label}:</span>{" "}
                    <span className="text-slate-500 dark:text-slate-400">{cap.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                msg.role === "user"
                  ? "bg-slate-200 dark:bg-slate-700"
                  : "bg-gradient-to-br from-blue-500 to-indigo-600"
              }`}>
                {msg.role === "user" ? (
                  <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                ) : (
                  <Bot className="w-4 h-4 text-white" />
                )}
              </div>
              <div className={`flex-1 min-w-0 ${msg.role === "user" ? "text-right" : ""}`}>
                <div className={`inline-block text-left rounded-xl px-3 py-2 text-sm max-w-full ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                }`}>
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>

                {/* Metadata */}
                {msg.metadata && (
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                    <span className="capitalize">{String(msg.metadata.source)}</span>
                    <span>·</span>
                    <span>{(Number(msg.metadata.durationMs) / 1000).toFixed(1)}s</span>
                    {msg.capability && (
                      <>
                        <span>·</span>
                        <span className="capitalize">{msg.capability.replace(/_/g, " ")}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Expandable result */}
                {msg.result != null ? (
                  <button
                    onClick={() => toggleResult(idx)}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 mt-1 flex items-center gap-1"
                  >
                    {expandedResults.has(idx) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    {expandedResults.has(idx) ? "Hide" : "Show"} raw result
                  </button>
                ) : null}
                {msg.result != null && expandedResults.has(idx) ? (
                  <pre className="mt-1 text-xs bg-slate-900 text-slate-300 rounded-lg p-2 overflow-x-auto max-h-48 overflow-y-auto">
                    {JSON.stringify(msg.result, null, 2)}
                  </pre>
                ) : null}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-3">
          <div className="flex items-end gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl p-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask about ${CAPABILITY_OPTIONS.find((c) => c.value === selectedCapability)?.label?.toLowerCase() || "anything"}...`}
              rows={1}
              className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none resize-none max-h-32"
              style={{ minHeight: "24px" }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 text-center">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
}

// ─── Helpers ───

function buildPayload(capability: string, userMessage: string): Record<string, unknown> {
  const msg = userMessage.toLowerCase();

  switch (capability) {
    case "summarize": {
      if (msg.includes("crm") || msg.includes("lead") || msg.includes("deal") || msg.includes("pipeline")) {
        return { scope: "crm_pipeline" };
      }
      if (msg.includes("procurement") || msg.includes("requisition") || msg.includes("purchase")) {
        return { scope: "procurement" };
      }
      if (msg.includes("report")) {
        return { scope: "reports" };
      }
      if (msg.includes("employee") || msg.includes("staff") || msg.includes("person")) {
        return { scope: "department" };
      }
      return { scope: "department" };
    }

    case "proactive_insights": {
      const categories: string[] = [];
      if (msg.includes("appraisal") || msg.includes("performance")) categories.push("appraisals");
      if (msg.includes("report")) categories.push("reports");
      if (msg.includes("candidate") || msg.includes("recruit") || msg.includes("hiring")) categories.push("recruitment");
      if (msg.includes("crm") || msg.includes("lead")) categories.push("crm");
      if (msg.includes("procurement") || msg.includes("budget")) categories.push("procurement");
      if (msg.includes("attendance") || msg.includes("absent")) categories.push("attendance");
      return categories.length > 0 ? { categories } : {};
    }

    case "generate_report": {
      return {
        transcript: userMessage,
        reportType: msg.includes("weekly") ? "weekly" : msg.includes("monthly") ? "monthly" : msg.includes("quarterly") ? "quarterly" : msg.includes("annual") ? "annual" : "daily",
        reportDate: new Date().toISOString().split("T")[0],
      };
    }

    case "appraise_performance": {
      return {
        employeeId: extractId(userMessage) || userMessage,
        period: msg.includes("weekly") ? "weekly" : msg.includes("quarterly") ? "quarterly" : msg.includes("annual") ? "annual" : "monthly",
      };
    }

    case "generate_training_plan": {
      return {
        employeeId: extractId(userMessage) || userMessage,
        timelineWeeks: msg.includes("week") ? parseInt(msg.match(/(\d+)\s*week/)?.[1] || "12") : 12,
      };
    }

    case "screen_candidates": {
      const id = extractId(userMessage);
      if (id) return { requisitionId: id };
      return { requisitionId: userMessage };
    }

    default:
      return { text: userMessage };
  }
}

function extractId(text: string): string | null {
  const uuidMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidMatch) return uuidMatch[0];
  const idMatch = text.match(/\b([a-z0-9]{20,})\b/i);
  if (idMatch) return idMatch[1];
  return null;
}

function formatResult(data: any): string {
  if (!data.success) {
    return data.error || "The agent encountered an error.";
  }

  const result = data.result;

  if (result?.headline) {
    let parts = [result.headline];
    if (result.keyMetrics?.length > 0) {
      parts.push("\nKey Metrics:");
      parts.push(...result.keyMetrics.map((m: any) => `  • ${m.label}: ${m.value}`));
    }
    if (result.highlights?.length > 0) {
      parts.push("\nHighlights:");
      parts.push(...result.highlights.map((h: string) => `  • ${h}`));
    }
    if (result.concerns?.length > 0) {
      parts.push("\nConcerns:");
      parts.push(...result.concerns.map((c: string) => `  • ${c}`));
    }
    if (result.recommendedActions?.length > 0) {
      parts.push("\nRecommended Actions:");
      parts.push(...result.recommendedActions.map((a: any) => `  • [${a.priority}] ${a.action}`));
    }
    return parts.join("\n");
  }

  if (result?.insights?.length > 0) {
    let parts = [`Found ${result.totalInsights} insight(s):`];
    for (const insight of result.insights) {
      parts.push(`\n[${insight.severity.toUpperCase()}] ${insight.title}`);
      parts.push(`  ${insight.description}`);
      parts.push(`  → ${insight.recommendedAction}`);
    }
    return parts.join("\n");
  }

  if (result?.modules?.length > 0) {
    let parts = [`Training plan for ${result.employeeName || "employee"}:`];
    parts.push(result.summary || "");
    for (const mod of result.modules) {
      parts.push(`\n${mod.title} (Week ${mod.startWeek}-${mod.startWeek + mod.durationWeeks - 1})`);
      parts.push(`  ${mod.description}`);
      parts.push(`  Format: ${mod.format}`);
      parts.push(`  Success: ${mod.successMetrics?.join(", ")}`);
    }
    return parts.join("\n");
  }

  if (result?.title) {
    return `Report generated: ${result.title}`;
  }

  if (result?.overallScore != null) {
    return `Appraisal complete. Overall score: ${result.overallScore}/100 (${result.rating || "N/A"})`;
  }

  if (result?.rankedCandidates?.length > 0 || result?.candidates?.length > 0) {
    const candidates = result.rankedCandidates || result.candidates;
    let parts = [`Screened ${candidates.length} candidate(s):`];
    for (const c of candidates.slice(0, 5)) {
      parts.push(`  • ${c.name || c.candidateName || c.id}: ${c.score || c.aiScore || "N/A"} points`);
    }
    return parts.join("\n");
  }

  return JSON.stringify(result, null, 2).slice(0, 500);
}
