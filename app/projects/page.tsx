"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send, Loader2, CheckCircle2, XCircle, Clock, RefreshCw,
  ExternalLink, Code2, Search, TrendingUp, Scale, Megaphone,
  BookOpen, Layers, Bot,
  BarChart3, ShieldCheck, FlaskConical, ScrollText, Lightbulb,
  ArrowRight, CircleDot, Sparkles, Terminal, ChevronDown, ChevronUp,
  MessageSquare, ArrowDownRight,
} from "lucide-react";
import Link from "next/link";
import { BUILTIN_PRESETS, loadCustomPresets, saveCustomPresets, loadActivePresetId, fetchPresetsFromAPI, type Preset } from "@/lib/presets";

/* ─── API config ─────────────────────────────────────────── */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS  = process.env.NEXT_PUBLIC_WS_URL  ?? "ws://localhost:8000";

/* ─── Types ──────────────────────────────────────────────── */

type TaskStatus = "pending" | "planning" | "executing" | "reviewing" | "done" | "failed";
type ViewMode = "story" | "raw";

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

function agentColor(role: string): string {
  const key = role.toLowerCase().replace(/ /g, "_");
  return AGENT_COLORS[key] ?? "#64748b";
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; spin?: boolean }> = {
  pending:   { label: "Pending",   color: "#94a3b8" },
  planning:  { label: "Planning",  color: "#4f46e5", spin: true },
  executing: { label: "Executing", color: "#0284c7", spin: true },
  reviewing: { label: "Reviewing", color: "#d97706", spin: true },
  done:      { label: "Done",      color: "#059669" },
  failed:    { label: "Failed",    color: "#dc2626" },
};

/* ─── Simple markdown renderer ───────────────────────────── */

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="px-1 py-0.5 rounded text-xs font-mono" style={{ background: "rgba(0,0,0,0.07)" }}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function MarkdownContent({ content, compact = false }: { content: string; compact?: boolean }) {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let inCodeBlock = false;
  let codeLines: string[] = [];

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw;

    // Code block fence
    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLines = [];
      } else {
        inCodeBlock = false;
        nodes.push(
          <pre key={`code-${i}`} className="rounded-xl px-4 py-3 text-xs font-mono overflow-x-auto my-2 leading-relaxed" style={{ background: "rgba(0,0,0,0.06)", color: "var(--foreground)" }}>
            {codeLines.join("\n")}
          </pre>
        );
      }
      i++; continue;
    }
    if (inCodeBlock) { codeLines.push(raw); i++; continue; }

    // Headings
    if (line.startsWith("### ")) {
      nodes.push(<h3 key={i} className={`font-bold ${compact ? "text-xs mt-3 mb-1" : "text-sm mt-5 mb-2"}`} style={{ color: "var(--foreground)" }}>{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith("## ")) {
      nodes.push(<h2 key={i} className={`font-bold ${compact ? "text-sm mt-4 mb-1" : "text-base mt-6 mb-2"}`} style={{ color: "var(--foreground)" }}>{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith("# ")) {
      nodes.push(<h1 key={i} className={`font-bold ${compact ? "text-base mt-4 mb-1" : "text-lg mt-6 mb-2"}`} style={{ color: "var(--foreground)" }}>{renderInline(line.slice(2))}</h1>);
    }
    // Horizontal rule
    else if (line.trim().match(/^-{3,}$|^\*{3,}$/) ) {
      nodes.push(<hr key={i} className="my-3" style={{ borderColor: "var(--card-border)" }} />);
    }
    // Bullet list
    else if (line.trim().match(/^[-*•]\s/)) {
      const depth = line.search(/\S/);
      const text = line.trim().slice(2);
      nodes.push(
        <div key={i} className="flex gap-2 my-0.5" style={{ paddingLeft: depth > 0 ? `${depth * 4}px` : undefined }}>
          <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)", marginTop: compact ? "5px" : "7px" }} />
          <span className={compact ? "text-xs leading-relaxed" : "text-sm leading-relaxed"} style={{ color: "var(--foreground)" }}>{renderInline(text)}</span>
        </div>
      );
    }
    // Numbered list
    else if (line.trim().match(/^\d+\.\s/)) {
      const num = line.trim().match(/^(\d+)\.\s(.*)/)!;
      nodes.push(
        <div key={i} className="flex gap-2 my-0.5">
          <span className={`font-bold shrink-0 ${compact ? "text-xs" : "text-sm"}`} style={{ color: "var(--accent)", minWidth: "16px" }}>{num[1]}.</span>
          <span className={compact ? "text-xs leading-relaxed" : "text-sm leading-relaxed"} style={{ color: "var(--foreground)" }}>{renderInline(num[2])}</span>
        </div>
      );
    }
    // Empty line
    else if (line.trim() === "") {
      nodes.push(<div key={i} className={compact ? "h-1.5" : "h-3"} />);
    }
    // Table row (basic)
    else if (line.trim().startsWith("|")) {
      nodes.push(
        <div key={i} className={`font-mono ${compact ? "text-xs" : "text-sm"} leading-relaxed`} style={{ color: "var(--foreground)" }}>
          {line}
        </div>
      );
    }
    // Regular paragraph
    else {
      nodes.push(
        <p key={i} className={`${compact ? "text-xs" : "text-sm"} leading-relaxed`} style={{ color: "var(--foreground)" }}>
          {renderInline(line)}
        </p>
      );
    }
    i++;
  }

  return <div>{nodes}</div>;
}

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
  const reviewMessages = messages.filter(m => reviewRoles.includes(m.agent_role) && m.type === "agent_output");
  if (reviewMessages.length === 0) return null;

  const revisions = messages.filter(m => m.agent_role === "qa" || m.agent_role === "critic").length;
  const lastReview = reviewMessages[reviewMessages.length - 1];
  const content = lastReview.content;

  const scoreMatch = content.match(/score[:\s]+(\d+(?:\.\d+)?)/i) ||
    content.match(/(\d+(?:\.\d+)?)\s*\/\s*10/i) ||
    content.match(/(\d+(?:\.\d+)?)\s*out of\s*10/i);
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : undefined;

  const verdict = content.toLowerCase().includes('"passed": true') || content.toLowerCase().includes("pass")
    ? "pass"
    : content.toLowerCase().includes('"passed": false') || content.toLowerCase().includes("fail")
    ? "fail"
    : score !== undefined ? (score >= 7 ? "pass" : "fail")
    : "unknown";

  const findings = content
    .split("\n")
    .filter(l => l.trim().match(/^[-•*]/))
    .map(l => l.trim().replace(/^[-•*]\s*/, ""))
    .filter(l => l.length > 0)
    .slice(0, 5);

  return { reviewer: lastReview.agent_role.replace(/_/g, " "), score, verdict, findings, revisions };
}

/* ─── Helper: extract final deliverable from messages ─────── */

function extractDeliverable(messages: Message[]): Message | null {
  const deliverableRoles = ["writer", "editor", "synthesizer", "legal_editor", "content_editor", "literature_synthesizer", "citation_agent"];
  const deliverables = messages.filter(m => deliverableRoles.includes(m.agent_role) && m.type === "agent_output");
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

/* ─── Story view: beautiful agent conversation cards ─────── */

function AgentConversationCard({ msg, isLast }: { msg: Message; isLast: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const color = agentColor(msg.agent_role);
  const isLong = msg.content.length > 800;
  const isInput = msg.type === "agent_input";

  if (isInput) return null; // Story view only shows outputs

  return (
    <div className="relative flex gap-4">
      {/* Connector line to next card */}
      {!isLast && (
        <div className="absolute left-5 top-11 bottom-0 w-px" style={{ background: `linear-gradient(to bottom, ${color}40, transparent)` }} />
      )}

      {/* Avatar */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 z-10 mt-0.5" style={{ background: `${color}12`, border: `2px solid ${color}30` }}>
        <Bot size={16} style={{ color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-8">
        {/* Agent header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="font-bold text-sm capitalize" style={{ color }}>
            {msg.agent_role.replace(/_/g, " ")}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${color}12`, color }}>
            {msg.type === "qa_pass" ? "✓ passed" : msg.type === "qa_fail" ? "✗ failed" : msg.type.replace(/_/g, " ")}
          </span>
          {msg.isLive && (
            <span className="flex items-center gap-1.5 text-xs font-medium animate-pulse" style={{ color: "var(--accent)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              Working…
            </span>
          )}
        </div>

        {/* Message bubble */}
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${color}20`, background: `${color}05` }}>
          <div className={`px-5 py-4 ${isLong && !expanded ? "max-h-72 overflow-hidden relative" : ""}`}>
            <MarkdownContent content={msg.content} />
            {isLong && !expanded && (
              <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none" style={{ background: `linear-gradient(to bottom, transparent, ${color}06 80%, ${color}10)` }} />
            )}
          </div>
          {isLong && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-t transition-all"
              style={{ borderColor: `${color}15`, color, background: `${color}06` }}
            >
              {expanded ? <><ChevronUp size={12} /> Collapse</> : <><ChevronDown size={12} /> Show full response</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Raw view: technical full-detail feed ───────────────── */

function RawFeedMessage({ msg }: { msg: Message }) {
  const [expanded, setExpanded] = useState(false);
  const color = agentColor(msg.agent_role);
  const isInput = msg.type === "agent_input";
  const isLong = msg.content.length > 400;

  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
        {isInput ? <ArrowDownRight size={12} style={{ color }} /> : <Bot size={12} style={{ color }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-bold capitalize" style={{ color }}>{msg.agent_role.replace(/_/g, " ")}</span>
          <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--card-border)", color: "var(--muted)", fontSize: 9 }}>
            {msg.type}
          </span>
          {msg.isLive && <span className="text-xs animate-pulse" style={{ color: "var(--accent)", fontSize: 10 }}>● live</span>}
          {isInput && <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: "#fef9c3", color: "#92400e", fontSize: 9 }}>INPUT</span>}
        </div>
        <div
          className={`text-xs font-mono leading-relaxed rounded-lg px-3 py-2 whitespace-pre-wrap transition-all ${isLong && !expanded ? "max-h-32 overflow-hidden" : ""}`}
          style={{ background: "var(--card)", border: "1px solid var(--card-border)", color: "var(--foreground)", position: "relative" }}
        >
          {msg.content}
          {isLong && !expanded && (
            <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, var(--card))" }} />
          )}
        </div>
        {isLong && (
          <button onClick={() => setExpanded(e => !e)} className="text-xs font-medium mt-1" style={{ color: "var(--accent)" }}>
            {expanded ? "Collapse" : `Expand (${msg.content.length.toLocaleString()} chars)`}
          </button>
        )}
      </div>
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

  const isDevPreset = task.preset_id === "software-dev" || !task.preset_id ||
    (preset?.agents?.some(a => a.role.toLowerCase().includes("developer")) ?? false);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ background: "var(--accent-light)", borderBottom: "1px solid rgba(79,70,229,0.15)" }}>
        <div className="flex items-center gap-2 flex-wrap">
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
                <div className="rounded-xl px-5 py-4 max-h-96 overflow-y-auto" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
                  <MarkdownContent content={deliverable.content} />
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

                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>Agent contributions</p>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set(messages.map(m => m.agent_role))].filter(r => r !== "system").map(role => (
                      <span key={role} className="text-xs px-2 py-1 rounded-lg font-medium capitalize" style={{ background: `${agentColor(role)}12`, color: agentColor(role), border: `1px solid ${agentColor(role)}25` }}>
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

/* ─── Main page ──────────────────────────────────────────── */

export default function ProjectsPage() {
  const [allPresets, setAllPresets] = useState<Preset[]>(() => {
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
  const [viewMode, setViewMode] = useState<ViewMode>("story");
  const feedRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  /* Load active preset from localStorage on mount */
  useEffect(() => {
    const active = loadActivePresetId();
    if (active) setSelectedPresetId(active);
    fetchTasks();
    const iv = setInterval(fetchTasks, 5000);
    fetchPresetsFromAPI().then(remote => {
      if (!remote.length) return;
      const local = loadCustomPresets();
      const merged = [...remote, ...local.filter(p => !remote.find((r: Preset) => r.id === p.id))];
      saveCustomPresets(merged);
      setAllPresets([...BUILTIN_PRESETS, ...merged]);
    });
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

  // Story view: only agent outputs (no inputs)
  const storyMessages: Message[] = [
    ...messages.filter(m => m.type !== "agent_input"),
    ...liveEvents.filter(m => m.type !== "agent_input"),
  ];

  // Raw view: all messages including inputs
  const allMessages: Message[] = [...messages, ...liveEvents];

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
                <div className="cursor-pointer" onClick={() => selectTask(task.id)}>
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
        <div className="flex-1 flex flex-col min-w-0">
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
              <div className="px-6 py-4 border-b flex items-start justify-between gap-4" style={{ borderColor: "var(--card-border)" }}>
                <div className="flex-1 min-w-0">
                  {selectedTask && (() => {
                    const cfg = STATUS_CONFIG[selectedTask.status] ?? STATUS_CONFIG.pending;
                    const isLong = selectedTask.goal.length > 160;
                    const displayGoal = isLong && !goalExpanded
                      ? selectedTask.goal.slice(0, 160) + "…"
                      : selectedTask.goal;
                    return (
                      <>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                          <button onClick={() => setGoalExpanded(e => !e)} className="text-xs mt-1 font-medium" style={{ color: "var(--accent)" }}>
                            {goalExpanded ? "Show less" : "Show more"}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* View mode toggle */}
                <div className="flex items-center gap-0.5 p-1 rounded-xl shrink-0" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
                  {([
                    { mode: "story" as ViewMode, icon: Sparkles, label: "Story" },
                    { mode: "raw" as ViewMode, icon: Terminal, label: "Raw" },
                  ] as const).map(({ mode, icon: Icon, label }) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: viewMode === mode ? "var(--accent)" : "transparent",
                        color: viewMode === mode ? "#fff" : "var(--muted)",
                      }}
                    >
                      <Icon size={11} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feed */}
              <div ref={feedRef} className="flex-1 overflow-y-auto p-6 space-y-4">
                {loadingMessages ? (
                  <div className="flex justify-center pt-8"><Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} /></div>
                ) : (viewMode === "story" ? storyMessages : allMessages).length === 0 ? (
                  <div className="text-center pt-8">
                    <Loader2 size={20} className="animate-spin mx-auto mb-2" style={{ color: "var(--accent)" }} />
                    <p className="text-sm" style={{ color: "var(--muted)" }}>Agents are starting up…</p>
                  </div>
                ) : viewMode === "story" ? (
                  <>
                    {/* Story / conversation view */}
                    {storyMessages.map((msg, i) => (
                      <AgentConversationCard
                        key={msg.id ?? i}
                        msg={msg}
                        isLast={i === storyMessages.length - 1}
                      />
                    ))}
                    {selectedTask?.status === "done" && (
                      <DeliveryPanel task={selectedTask} messages={[...messages, ...liveEvents]} preset={taskPreset} />
                    )}
                  </>
                ) : (
                  <>
                    {/* Raw technical view */}
                    <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "var(--card-border)" }}>
                      <Terminal size={12} style={{ color: "var(--muted)" }} />
                      <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Raw message log · {allMessages.length} messages</span>
                      <span className="text-xs px-2 py-0.5 rounded font-mono ml-auto" style={{ background: "#fef9c3", color: "#92400e" }}>
                        INPUT = what was sent to agent · OUTPUT = agent response
                      </span>
                    </div>
                    {allMessages.map((msg, i) => <RawFeedMessage key={msg.id ?? i} msg={msg} />)}
                    {selectedTask?.status === "done" && (
                      <DeliveryPanel task={selectedTask} messages={allMessages} preset={taskPreset} />
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
