"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send, Loader2, CheckCircle2, XCircle, Clock, RefreshCw,
  ExternalLink, Code2, Search, TrendingUp, Scale, Megaphone,
  BookOpen, Layers, Bot,
  BarChart3, ShieldCheck, FlaskConical, ScrollText, Lightbulb,
  ArrowRight, CircleDot,
} from "lucide-react";
import Link from "next/link";
import { BUILTIN_PRESETS, loadCustomPresets, loadActivePresetId, type Preset } from "@/lib/presets";

/* ─── API config ─────────────────────────────────────────── */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS  = process.env.NEXT_PUBLIC_WS_URL  ?? "ws://localhost:8000";

/* ─── Types ──────────────────────────────────────────────── */

type TaskStatus = "pending" | "planning" | "executing" | "reviewing" | "done" | "failed";

interface Task {
  id: string;
  goal: string;
  status: TaskStatus;
  created_at: string;
  preset_id?: string;
}

interface Message {
  id: string;
  agent_role: string;
  type: string;
  content: string;
  created_at: string;
  isLive?: boolean;
}

interface LiveEvent {
  type: string;
  agent: string;
  content: string;
}

/* ─── Preset category icons ──────────────────────────────── */

const PRESET_ICONS: Record<string, React.ElementType> = {
  "software-dev": Code2,
  "research-intelligence": Search,
  "investment-analysis": TrendingUp,
  "legal-review": Scale,
  "content-marketing": Megaphone,
  "academic-review": BookOpen,
};

const AGENT_COLORS: Record<string, string> = {
  ceo: "#4f46e5", planner: "#7c3aed", developer: "#0284c7", qa: "#059669",
  writer: "#d97706", researcher: "#7c3aed", fact_checker: "#059669",
  devils_advocate: "#dc2626", editor: "#d97706", analyst: "#059669",
  bear_case: "#dc2626", data_agent: "#0284c7", risk_agent: "#d97706",
  synthesizer: "#7c3aed", reader: "#64748b", clause_flagger: "#dc2626",
  protection_checker: "#7c3aed", legal_editor: "#d97706",
  content_writer: "#ec4899", seo_agent: "#0284c7", brand_voice: "#7c3aed",
  content_editor: "#d97706", summarizer: "#7c3aed", critic: "#dc2626",
  literature_synthesizer: "#059669", citation_agent: "#64748b",
  system: "#64748b",
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; spin?: boolean }> = {
  pending:   { label: "Pending",   color: "#94a3b8" },
  planning:  { label: "Planning",  color: "#4f46e5", spin: true },
  executing: { label: "Executing", color: "#0284c7", spin: true },
  reviewing: { label: "Reviewing", color: "#d97706", spin: true },
  done:      { label: "Done",      color: "#059669" },
  failed:    { label: "Failed",    color: "#dc2626" },
};

/* ─── Helper: extract quality report from messages ────────── */

interface QualityReport {
  reviewer: string;
  score?: number;
  verdict: "pass" | "fail" | "unknown";
  findings: string[];
  revisions: number;
}

function extractQualityReport(messages: Message[]): QualityReport | null {
  const reviewRoles = ["qa", "fact_checker", "critic", "clause_flagger", "protection_checker", "bear_case"];
  const reviewMessages = messages.filter(m => reviewRoles.includes(m.agent_role));
  if (reviewMessages.length === 0) return null;

  const revisions = messages.filter(m => m.agent_role === "qa" || m.agent_role === "critic").length;
  const lastReview = reviewMessages[reviewMessages.length - 1];
  const content = lastReview.content;

  // Try to extract a score
  const scoreMatch = content.match(/score[:\s]+(\d+(?:\.\d+)?)/i) ||
    content.match(/(\d+(?:\.\d+)?)\s*\/\s*10/i) ||
    content.match(/(\d+(?:\.\d+)?)\s*out of\s*10/i);
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : undefined;

  const verdict = content.toLowerCase().includes("pass") ? "pass"
    : content.toLowerCase().includes("fail") ? "fail"
    : score !== undefined ? (score >= 7 ? "pass" : "fail")
    : "unknown";

  // Extract bullet-point findings (lines starting with - or •)
  const findings = content
    .split("\n")
    .filter(l => l.trim().match(/^[-•*]/))
    .map(l => l.trim().replace(/^[-•*]\s*/, ""))
    .filter(l => l.length > 0)
    .slice(0, 5);

  return {
    reviewer: lastReview.agent_role.replace(/_/g, " "),
    score,
    verdict,
    findings,
    revisions,
  };
}

/* ─── Helper: extract final deliverable from messages ─────── */

function extractDeliverable(messages: Message[]): Message | null {
  const deliverableRoles = ["writer", "editor", "synthesizer", "legal_editor", "content_editor", "literature_synthesizer", "citation_agent"];
  const deliverables = messages.filter(m => deliverableRoles.includes(m.agent_role) && m.type !== "tool_call");
  return deliverables[deliverables.length - 1] ?? null;
}

/* ─── Preset selector ────────────────────────────────────── */

function PresetSelector({ presets, selected, onSelect }: {
  presets: Preset[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {presets.map(p => {
        const Icon = PRESET_ICONS[p.id] ?? Layers;
        const active = p.id === selected;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: active ? p.categoryColor : "var(--card)",
              color: active ? "#fff" : "var(--muted)",
              border: active ? "none" : "1px solid var(--card-border)",
              boxShadow: active ? `0 2px 8px ${p.categoryColor}40` : "none",
            }}
          >
            <Icon size={12} />
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Delivery panel ─────────────────────────────────────── */

function DeliveryPanel({ task, messages, preset }: {
  task: Task;
  messages: Message[];
  preset: Preset | undefined;
}) {
  const deliverable = extractDeliverable(messages);
  const quality = extractQualityReport(messages);
  const [tab, setTab] = useState<"output" | "report">("output");

  const isDevPreset = task.preset_id === "software-dev" || !task.preset_id;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between" style={{ background: "var(--accent-light)", borderBottom: "1px solid rgba(79,70,229,0.15)" }}>
        <div className="flex items-center gap-2">
          <CheckCircle2 size={15} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-bold" style={{ color: "var(--accent)" }}>
            {preset ? `${preset.name} complete` : "Task complete"}
          </span>
          {quality && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ml-2 ${quality.verdict === "pass" ? "text-green-700" : quality.verdict === "fail" ? "text-red-700" : "text-yellow-700"}`}
              style={{ background: quality.verdict === "pass" ? "#dcfce7" : quality.verdict === "fail" ? "#fee2e2" : "#fef9c3" }}>
              {quality.verdict === "pass" ? "✓ QA Passed" : quality.verdict === "fail" ? "✗ QA Failed" : "QA Unknown"}
              {quality.score !== undefined && ` · ${quality.score}/10`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Tabs */}
          {(deliverable || isDevPreset) && (
            <div className="flex gap-1">
              {(["output", "report"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className="text-xs px-2.5 py-1 rounded-md font-medium capitalize" style={{ background: tab === t ? "var(--accent)" : "transparent", color: tab === t ? "#fff" : "var(--accent)" }}>
                  {t === "output" ? "Deliverable" : "QA Report"}
                </button>
              ))}
            </div>
          )}
          {isDevPreset && (
            <Link href={`/preview/${task.id}`} target="_blank" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: "var(--accent)" }}>
              <ExternalLink size={11} /> Preview app
            </Link>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-5">
        {tab === "output" ? (
          <div>
            {deliverable ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ScrollText size={14} style={{ color: "var(--muted)" }} />
                  <span className="text-xs font-semibold capitalize" style={{ color: "var(--muted)" }}>
                    Final output · {deliverable.agent_role.replace(/_/g, " ")}
                  </span>
                </div>
                <div
                  className="text-sm leading-relaxed whitespace-pre-wrap rounded-xl px-4 py-3 max-h-64 overflow-y-auto"
                  style={{ background: "var(--card)", border: "1px solid var(--card-border)", color: "var(--foreground)", fontFamily: "inherit" }}
                >
                  {deliverable.content}
                </div>
              </div>
            ) : isDevPreset ? (
              <div className="text-center py-6">
                <Code2 size={28} className="mx-auto mb-2" style={{ color: "var(--muted-light)" }} />
                <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>App built successfully</p>
                <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>View the running app and source files in the preview.</p>
                <Link href={`/preview/${task.id}`} target="_blank" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--accent)" }}>
                  <ExternalLink size={13} /> Open preview
                </Link>
              </div>
            ) : (
              <p className="text-sm text-center py-4" style={{ color: "var(--muted)" }}>No structured output extracted yet.</p>
            )}
          </div>
        ) : (
          /* QA Report tab */
          <div>
            {quality ? (
              <div className="space-y-4">
                {/* Score bar */}
                {quality.score !== undefined && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Quality score</span>
                      <span className="text-sm font-bold" style={{ color: quality.score >= 7 ? "#059669" : "#dc2626" }}>{quality.score}/10</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--card-border)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${(quality.score / 10) * 100}%`, background: quality.score >= 7 ? "#059669" : "#dc2626" }} />
                    </div>
                  </div>
                )}

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Verdict", value: quality.verdict === "pass" ? "Pass" : quality.verdict === "fail" ? "Fail" : "—", icon: quality.verdict === "pass" ? CheckCircle2 : XCircle, color: quality.verdict === "pass" ? "#059669" : "#dc2626" },
                    { label: "Reviewer", value: quality.reviewer, icon: ShieldCheck, color: "#7c3aed" },
                    { label: "Review cycles", value: String(quality.revisions), icon: RefreshCw, color: "#0284c7" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="rounded-xl p-3 text-center" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
                      <Icon size={16} className="mx-auto mb-1" style={{ color }} />
                      <p className="text-xs font-bold" style={{ color: "var(--foreground)" }}>{value}</p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>{label}</p>
                    </div>
                  ))}
                </div>

                {/* Findings */}
                {quality.findings.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>Key findings</p>
                    <div className="space-y-1.5">
                      {quality.findings.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--foreground)" }}>
                          <CircleDot size={10} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Agent contributions */}
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>Agent contributions</p>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set(messages.map(m => m.agent_role))].filter(r => r !== "system").map(role => (
                      <span key={role} className="text-xs px-2 py-1 rounded-lg font-medium capitalize" style={{ background: `${AGENT_COLORS[role] ?? "#64748b"}12`, color: AGENT_COLORS[role] ?? "#64748b", border: `1px solid ${AGENT_COLORS[role] ?? "#64748b"}25` }}>
                        {role.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <BarChart3 size={28} className="mx-auto mb-2" style={{ color: "var(--muted-light)" }} />
                <p className="text-sm" style={{ color: "var(--muted)" }}>No QA/review data found in this task&apos;s messages.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Agent feed message ─────────────────────────────────── */

function FeedMessage({ msg }: { msg: Message }) {
  const color = AGENT_COLORS[msg.agent_role] ?? "#64748b";
  const isCode = msg.type === "tool_call";
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}12`, border: `1px solid ${color}22` }}>
        <Bot size={13} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold capitalize" style={{ color }}>{msg.agent_role.replace(/_/g, " ")}</span>
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--card-border)", color: "var(--muted)", fontSize: 10 }}>{msg.type}</span>
          {msg.isLive && <span className="text-xs" style={{ color: "var(--accent)", fontSize: 10 }}>● live</span>}
        </div>
        <div
          className="text-sm leading-relaxed whitespace-pre-wrap rounded-lg px-3 py-2"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)", color: "var(--foreground)", fontFamily: isCode ? "var(--font-mono)" : "inherit", fontSize: isCode ? 12 : 13 }}
        >
          {msg.content}
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────── */

export default function ProjectsPage() {
  const [allPresets] = useState<Preset[]>(() => {
    if (typeof window === "undefined") return BUILTIN_PRESETS;
    return [...BUILTIN_PRESETS, ...loadCustomPresets()];
  });

  const [selectedPresetId, setSelectedPresetId] = useState<string>("software-dev");
  const [goal, setGoal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [liveEvents, setLiveEvents] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [goalExpanded, setGoalExpanded] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const feedRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  /* Load active preset from localStorage on mount */
  useEffect(() => {
    const active = loadActivePresetId();
    if (active) setSelectedPresetId(active);
    fetchTasks();
    const iv = setInterval(fetchTasks, 5000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [liveEvents, messages]);

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API}/tasks/`);
      if (res.ok) setTasks(await res.json());
    } catch {}
  };

  const selectTask = async (taskId: string) => {
    setSelectedId(taskId);
    setGoalExpanded(false);
    setLiveEvents([]);
    setLoadingMessages(true);
    wsRef.current?.close();

    try {
      const res = await fetch(`${API}/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } finally {
      setLoadingMessages(false);
    }

    const ws = new WebSocket(`${WS}/ws/${taskId}`);
    ws.onmessage = (e) => {
      const event: LiveEvent = JSON.parse(e.data);
      setLiveEvents(prev => [...prev, {
        id: `live-${Date.now()}`,
        agent_role: event.agent,
        type: event.type,
        content: event.content,
        created_at: new Date().toISOString(),
        isLive: true,
      }]);
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t;
        if (event.type === "done") return { ...t, status: "done" };
        if (event.type === "error") return { ...t, status: "failed" };
        if (event.agent === "ceo" || event.agent === "researcher" || event.agent === "analyst") return { ...t, status: "planning" };
        if (["developer", "content_writer", "summarizer"].includes(event.agent)) return { ...t, status: "executing" };
        if (["qa", "fact_checker", "critic", "clause_flagger"].includes(event.agent)) return { ...t, status: "reviewing" };
        return t;
      }));
    };
    wsRef.current = ws;
  };

  const submitTask = async () => {
    if (!goal.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/tasks/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim(), preset_id: selectedPresetId }),
      });
      if (res.ok) {
        const data = await res.json();
        const taskId = data.task_id;
        setGoal("");
        await fetchTasks();
        // Attach preset_id locally since API may not persist it
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, preset_id: selectedPresetId } : t));
        selectTask(taskId);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTask = tasks.find(t => t.id === selectedId);
  const selectedPreset = allPresets.find(p => p.id === selectedPresetId);
  const taskPreset = allPresets.find(p => p.id === selectedTask?.preset_id);

  const allMessages: Message[] = [
    ...messages,
    ...liveEvents,
  ];

  const isActive = (s: TaskStatus) => ["planning", "executing", "reviewing"].includes(s);

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Submission header ── */}
      <div className="px-4 sm:px-8 lg:px-10 pt-8 pb-4 border-b" style={{ borderColor: "var(--card-border)" }}>
        <div className="flex items-start justify-between gap-2 mb-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold mb-0.5" style={{ color: "var(--foreground)" }}>Projects</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Pick a specialist team, describe the task, and let your agents handle it.
            </p>
          </div>
        </div>

        {/* Preset picker */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Agent team</span>
            {selectedPreset && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${selectedPreset.categoryColor}15`, color: selectedPreset.categoryColor }}>
                {selectedPreset.agents.length} agents
              </span>
            )}
          </div>
          <PresetSelector
            presets={allPresets}
            selected={selectedPresetId}
            onSelect={setSelectedPresetId}
          />
          {/* Selected preset description */}
          {selectedPreset && (
            <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--muted)" }}>
              <span className="font-mono" style={{ color: selectedPreset.categoryColor }}>{selectedPreset.tagline}</span>
              {" · "}{selectedPreset.description.split(".")[0]}.
            </p>
          )}
        </div>

        {/* Goal input */}
        <div className="flex gap-2">
          <textarea
            className="flex-1 px-4 py-3 rounded-xl text-sm resize-none border outline-none transition-all"
            style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--foreground)", minHeight: "52px", maxHeight: "120px" }}
            placeholder={
              selectedPresetId === "software-dev" ? 'e.g. "Build a calculator web app with a clean UI"' :
              selectedPresetId === "research-intelligence" ? 'e.g. "Research the current state of fusion energy investment"' :
              selectedPresetId === "investment-analysis" ? 'e.g. "Analyse the investment case for SpaceX"' :
              selectedPresetId === "legal-review" ? 'e.g. "Review this SaaS subscription agreement for red flags"' :
              selectedPresetId === "content-marketing" ? 'e.g. "Write a blog post on why multi-agent AI outperforms single models"' :
              selectedPresetId === "academic-review" ? 'e.g. "Review literature on LLM reasoning and chain-of-thought prompting"' :
              'Describe what you want your agents to do…'
            }
            value={goal}
            rows={1}
            onChange={e => setGoal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitTask(); } }}
          />
          <button
            onClick={submitTask}
            disabled={!goal.trim() || submitting}
            className="px-4 py-3 rounded-xl text-sm font-semibold text-white flex items-center gap-2 shrink-0 disabled:opacity-50"
            style={{ background: selectedPreset?.categoryColor ?? "var(--accent)", boxShadow: `0 2px 8px ${selectedPreset?.categoryColor ?? "var(--accent)"}40` }}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {submitting ? "Starting…" : "Run"}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1">

        {/* Task list */}
        <div className="w-72 shrink-0 border-r" style={{ borderColor: "var(--card-border)", background: "#fafafa" }}>
          <div className="p-3 flex items-center justify-between border-b" style={{ borderColor: "var(--card-border)" }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-light)" }}>
              {tasks.length} project{tasks.length !== 1 ? "s" : ""}
            </span>
            <button onClick={fetchTasks} className="p-1 rounded" style={{ color: "var(--muted)" }}><RefreshCw size={13} /></button>
          </div>

          {tasks.length === 0 ? (
            <div className="p-6 text-center">
              <Lightbulb size={24} className="mx-auto mb-2" style={{ color: "var(--muted-light)" }} />
              <p className="text-sm" style={{ color: "var(--muted)" }}>No projects yet. Pick a team above and describe your task.</p>
            </div>
          ) : tasks.map(task => {
            const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
            const active = task.id === selectedId;
            const tPreset = allPresets.find(p => p.id === task.preset_id);
            const PresetIco = tPreset ? (PRESET_ICONS[tPreset.id] ?? Layers) : FlaskConical;
            const isLong = task.goal.length > 80;
            const cardExpanded = expandedCards.has(task.id);
            const displayGoal = isLong && !cardExpanded ? task.goal.slice(0, 80) + "…" : task.goal;
            return (
              <div
                key={task.id}
                className="w-full text-left px-4 py-3 border-b"
                style={{ borderColor: "var(--card-border)", background: active ? "var(--accent-light)" : "transparent", borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent" }}
              >
                <div
                  className="cursor-pointer"
                  onClick={() => selectTask(task.id)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {isActive(task.status)
                      ? <Loader2 size={11} className="animate-spin" style={{ color: cfg.color }} />
                      : task.status === "done" ? <CheckCircle2 size={11} style={{ color: cfg.color }} />
                      : task.status === "failed" ? <XCircle size={11} style={{ color: cfg.color }} />
                      : <Clock size={11} style={{ color: cfg.color }} />}
                    <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                    {tPreset && (
                      <span className="ml-auto flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full" style={{ background: `${tPreset.categoryColor}12`, color: tPreset.categoryColor }}>
                        <PresetIco size={9} />
                        <span style={{ fontSize: 9 }}>{tPreset.name.split(" ")[0]}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-snug" style={{ color: active ? "var(--accent)" : "var(--foreground)" }}>{displayGoal}</p>
                </div>
                {isLong && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setExpandedCards(prev => {
                        const next = new Set(prev);
                        if (cardExpanded) next.delete(task.id); else next.add(task.id);
                        return next;
                      });
                    }}
                    className="text-xs mt-1 font-medium"
                    style={{ color: "var(--accent)" }}
                  >
                    {cardExpanded ? "Show less" : "Show more"}
                  </button>
                )}
                <p className="text-xs mt-1" style={{ color: "var(--muted-light)" }}>{new Date(task.created_at).toLocaleTimeString()}</p>
              </div>
            );
          })}
        </div>

        {/* Main panel */}
        <div className="flex-1 flex flex-col">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm px-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-light)", border: "1px solid rgba(79,70,229,0.15)" }}>
                  <Bot size={28} style={{ color: "var(--accent)" }} />
                </div>
                <p className="text-base font-semibold mb-1" style={{ color: "var(--foreground)" }}>Select a project</p>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Pick a specialist team above, describe your task, and your agents will collaborate to produce a peer-reviewed result.
                </p>
                {/* Mini use-case list */}
                <div className="mt-6 space-y-2 text-left">
                  {BUILTIN_PRESETS.map(p => {
                    const Icon = PRESET_ICONS[p.id] ?? Layers;
                    return (
                      <button key={p.id} onClick={() => setSelectedPresetId(p.id)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${p.categoryColor}12`, border: `1px solid ${p.categoryColor}25` }}>
                          <Icon size={13} style={{ color: p.categoryColor }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{p.name}</p>
                          <p className="text-xs truncate" style={{ color: "var(--muted)" }}>{p.tagline}</p>
                        </div>
                        <ArrowRight size={12} className="shrink-0 ml-auto" style={{ color: "var(--muted-light)" }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Task header */}
              <div className="px-6 py-4 border-b" style={{ borderColor: "var(--card-border)" }}>
                {selectedTask && (() => {
                  const cfg = STATUS_CONFIG[selectedTask.status] ?? STATUS_CONFIG.pending;
                  const isLong = selectedTask.goal.length > 160;
                  const displayGoal = isLong && !goalExpanded
                    ? selectedTask.goal.slice(0, 160) + "…"
                    : selectedTask.goal;
                  return (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        {isActive(selectedTask.status) ? <Loader2 size={14} className="animate-spin" style={{ color: cfg.color }} /> : <div className="w-3 h-3 rounded-full shrink-0" style={{ background: cfg.color }} />}
                        <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                        {taskPreset && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${taskPreset.categoryColor}12`, color: taskPreset.categoryColor }}>
                            {taskPreset.name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--foreground)" }}>{displayGoal}</p>
                      {isLong && (
                        <button
                          onClick={() => setGoalExpanded(e => !e)}
                          className="text-xs mt-1 font-medium"
                          style={{ color: "var(--accent)" }}
                        >
                          {goalExpanded ? "Show less" : "Show more"}
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Feed + delivery */}
              <div ref={feedRef} className="p-6 space-y-4">
                {loadingMessages ? (
                  <div className="flex justify-center pt-8"><Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} /></div>
                ) : allMessages.length === 0 ? (
                  <div className="text-center pt-8">
                    <Loader2 size={20} className="animate-spin mx-auto mb-2" style={{ color: "var(--accent)" }} />
                    <p className="text-sm" style={{ color: "var(--muted)" }}>Agents are starting up…</p>
                  </div>
                ) : (
                  <>
                    {allMessages.map((msg, i) => <FeedMessage key={msg.id ?? i} msg={msg} />)}

                    {/* Delivery panel */}
                    {selectedTask?.status === "done" && (
                      <DeliveryPanel
                        task={selectedTask}
                        messages={allMessages}
                        preset={taskPreset}
                      />
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
