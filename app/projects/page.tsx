"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send, Loader2, CheckCircle2, XCircle, Clock, RefreshCw,
  ExternalLink, Code2, Search, TrendingUp, Scale, Megaphone,
  BookOpen, Layers, Bot, BarChart3, ShieldCheck, FlaskConical,
  ScrollText, Lightbulb, ArrowRight, CircleDot, Terminal,
  ArrowDownRight, ChevronRight, RotateCcw, Inbox,
} from "lucide-react";
import Link from "next/link";
import { BUILTIN_PRESETS, loadCustomPresets, saveCustomPresets, loadActivePresetId, fetchPresetsFromAPI, type Preset } from "@/lib/presets";

/* ─── API config ─────────────────────────────────────────── */
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS  = process.env.NEXT_PUBLIC_WS_URL  ?? "ws://localhost:8000";

/* ─── Types ──────────────────────────────────────────────── */
type TaskStatus = "pending" | "planning" | "executing" | "reviewing" | "done" | "failed" | "cancelled";
type ViewMode = "pipeline" | "raw";

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

interface AgentTurn {
  turnIndex: number;
  input: Message | null;
  output: Message | null;
}

interface PipelineNode {
  role: string;
  turns: AgentTurn[];
  isActive: boolean;    // currently producing output
  hasFailed: boolean;   // at least one qa_fail turn
}

/* ─── Refinement types ───────────────────────────────────── */
interface RefinementQuestion {
  id: string;
  question: string;
  options: { label: string; emoji: string; value: string }[];
}

function buildEnrichedGoal(goal: string, questions: RefinementQuestion[], answers: Record<string, string>): string {
  const lines = questions
    .map(q => {
      const val = answers[q.id];
      if (!val) return null;
      const opt = q.options.find(o => o.value === val);
      return `- ${q.question.replace(/\?$/, "")}: ${opt?.label ?? val}`;
    })
    .filter(Boolean)
    .join("\n");
  return lines ? `${goal}\n\nAdditional context:\n${lines}` : goal;
}

/* ─── Refinement modal ───────────────────────────────────── */
function RefinementModal({
  questions,
  loading,
  accentColor,
  onConfirm,
  onSkip,
}: {
  questions: RefinementQuestion[];
  loading: boolean;
  accentColor: string;
  onConfirm: (answers: Record<string, string>) => void;
  onSkip: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const toggle = (qId: string, value: string) =>
    setAnswers(prev => ({ ...prev, [qId]: prev[qId] === value ? "" : value }));
  const answeredCount = Object.values(answers).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(5px)" }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>

        {/* Header */}
        <div className="px-6 py-5 flex items-center gap-3" style={{ borderBottom: "1px solid var(--card-border)", background: `${accentColor}08` }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: accentColor }}>
            <Lightbulb size={15} color="#fff" />
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: "var(--foreground)" }}>Quick context</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {loading ? "Generating questions for your task…" : "Help agents understand exactly what you need"}
            </p>
          </div>
          <button onClick={onSkip} className="ml-auto text-xs font-medium px-3 py-1.5 rounded-lg shrink-0" style={{ color: "var(--muted)", background: "var(--background, #fff)", border: "1px solid var(--card-border)" }}>
            Skip →
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 size={20} className="animate-spin" style={{ color: accentColor }} />
            <span className="text-sm" style={{ color: "var(--muted)" }}>Thinking about your task…</span>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-6">
            {questions.map((q, qi) => (
              <div key={q.id}>
                <p className="text-xs font-bold mb-3 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: accentColor, fontSize: 10 }}>{qi + 1}</span>
                  {q.question}
                </p>
                <div className="flex flex-wrap gap-2">
                  {q.options.map(opt => {
                    const selected = answers[q.id] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggle(q.id, opt.value)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                        style={{
                          background: selected ? accentColor : "var(--background, #fff)",
                          color: selected ? "#fff" : "var(--foreground)",
                          border: `1.5px solid ${selected ? accentColor : "var(--card-border)"}`,
                          boxShadow: selected ? `0 2px 8px ${accentColor}40` : "none",
                        }}
                      >
                        <span>{opt.emoji}</span>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: "1px solid var(--card-border)", background: "var(--background, #fff)" }}>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {answeredCount}/{questions.length} answered{answeredCount === 0 && " · you can skip"}
            </p>
            <button
              onClick={() => onConfirm(answers)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: accentColor, boxShadow: `0 2px 12px ${accentColor}50` }}
            >
              <Send size={13} />
              Run with context
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Constants ──────────────────────────────────────────── */
const PRESET_ICONS: Record<string, React.ElementType> = {
  "software-dev": Code2, "research-intelligence": Search,
  "investment-analysis": TrendingUp, "legal-review": Scale,
  "content-marketing": Megaphone, "academic-review": BookOpen,
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
  literature_synthesizer: "#059669", citation_agent: "#64748b", system: "#64748b",
};
function agentColor(role: string) { return AGENT_COLORS[role.toLowerCase().replace(/ /g,"_")] ?? "#64748b"; }

const STATUS_CFG: Record<TaskStatus, { label: string; color: string }> = {
  pending:   { label: "Pending",   color: "#94a3b8" },
  planning:  { label: "Planning",  color: "#4f46e5" },
  executing: { label: "Executing", color: "#0284c7" },
  reviewing: { label: "Reviewing", color: "#d97706" },
  done:      { label: "Done",      color: "#059669" },
  failed:    { label: "Failed",    color: "#dc2626" },
  cancelled: { label: "Cancelled", color: "#94a3b8" },
};
const isActive = (s: TaskStatus) => ["planning","executing","reviewing"].includes(s);

/* ─── Build pipeline from message list ───────────────────── */
function buildPipeline(messages: Message[]): PipelineNode[] {
  const order: string[] = [];
  const byRole: Record<string, Message[]> = {};

  for (const m of messages) {
    if (!order.includes(m.agent_role)) order.push(m.agent_role);
    (byRole[m.agent_role] ??= []).push(m);
  }

  return order.map(role => {
    const msgs = byRole[role];
    const turns: AgentTurn[] = [];
    let i = 0;
    while (i < msgs.length) {
      const a = msgs[i];
      const b = msgs[i + 1];
      if (a?.type === "agent_input") {
        turns.push({ turnIndex: turns.length, input: a, output: b?.type === "agent_output" ? b : null });
        i += b?.type === "agent_output" ? 2 : 1;
      } else if (a?.type === "agent_output") {
        turns.push({ turnIndex: turns.length, input: null, output: a });
        i += 1;
      } else {
        // legacy "output" type
        turns.push({ turnIndex: turns.length, input: null, output: a });
        i += 1;
      }
    }
    const lastTurn = turns[turns.length - 1];
    return {
      role,
      turns,
      isActive: !!lastTurn && !lastTurn.output && !!lastTurn.input,
      hasFailed: msgs.some(m => m.type === "qa_fail"),
    };
  });
}

/* ─── Markdown renderer ──────────────────────────────────── */
function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2,-2)}</strong>;
    if (p.startsWith("*") && p.endsWith("*"))   return <em key={i}>{p.slice(1,-1)}</em>;
    if (p.startsWith("`") && p.endsWith("`"))   return <code key={i} className="px-1 rounded text-xs font-mono" style={{background:"rgba(0,0,0,0.07)"}}>{p.slice(1,-1)}</code>;
    return p;
  });
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0, inCode = false, codeLines: string[] = [];
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      if (!inCode) { inCode = true; codeLines = []; }
      else {
        inCode = false;
        nodes.push(<pre key={i} className="rounded-xl px-4 py-3 text-xs font-mono overflow-x-auto my-3 leading-relaxed" style={{background:"rgba(0,0,0,0.05)"}}>{codeLines.join("\n")}</pre>);
      }
      i++; continue;
    }
    if (inCode) { codeLines.push(line); i++; continue; }
    if (line.startsWith("### "))      nodes.push(<h3 key={i} className="font-bold text-sm mt-5 mb-1.5" style={{color:"var(--foreground)"}}>{renderInline(line.slice(4))}</h3>);
    else if (line.startsWith("## ")) nodes.push(<h2 key={i} className="font-bold text-base mt-6 mb-2" style={{color:"var(--foreground)"}}>{renderInline(line.slice(3))}</h2>);
    else if (line.startsWith("# "))  nodes.push(<h1 key={i} className="font-bold text-lg mt-6 mb-2" style={{color:"var(--foreground)"}}>{renderInline(line.slice(2))}</h1>);
    else if (line.trim().match(/^---+$/)) nodes.push(<hr key={i} className="my-4" style={{borderColor:"var(--card-border)"}}/>);
    else if (line.trim().match(/^[-*•]\s/)) {
      const depth = line.search(/\S/);
      nodes.push(<div key={i} className="flex gap-2 my-0.5" style={{paddingLeft: depth > 0 ? `${depth*6}px` : undefined}}>
        <span className="shrink-0 w-1.5 h-1.5 rounded-full mt-[7px]" style={{background:"var(--accent)"}}/>
        <span className="text-sm leading-relaxed" style={{color:"var(--foreground)"}}>{renderInline(line.trim().slice(2))}</span>
      </div>);
    } else if (line.trim().match(/^\d+\.\s/)) {
      const [,num,rest] = line.trim().match(/^(\d+)\.\s(.*)/) ?? [];
      nodes.push(<div key={i} className="flex gap-2 my-0.5"><span className="font-bold text-sm shrink-0" style={{color:"var(--accent)",minWidth:18}}>{num}.</span><span className="text-sm leading-relaxed" style={{color:"var(--foreground)"}}>{renderInline(rest)}</span></div>);
    } else if (line.trim() === "") nodes.push(<div key={i} className="h-3"/>);
    else nodes.push(<p key={i} className="text-sm leading-relaxed" style={{color:"var(--foreground)"}}>{renderInline(line)}</p>);
    i++;
  }
  return <div>{nodes}</div>;
}

/* ─── Pipeline node card ─────────────────────────────────── */
function PipelineNodeCard({ node, selected, onClick }: {
  node: PipelineNode; selected: boolean; onClick: () => void;
}) {
  const color = agentColor(node.role);
  const totalOutput = node.turns.reduce((sum, t) => sum + (t.output?.content.length ?? 0), 0);
  const hasOutput = totalOutput > 0;

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center gap-2 shrink-0 group"
      style={{ minWidth: 110 }}
    >
      {/* Node circle */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200"
        style={{
          background: selected ? color : `${color}12`,
          border: `2px solid ${selected ? color : `${color}30`}`,
          boxShadow: selected ? `0 0 0 4px ${color}20, 0 4px 16px ${color}30` : node.isActive ? `0 0 0 3px ${color}20` : "none",
        }}
      >
        <Bot size={22} style={{ color: selected ? "#fff" : color }} />
        {node.isActive && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white animate-pulse" style={{ background: "#0284c7" }} />
        )}
        {node.turns.length > 1 && !node.isActive && (
          <span className="absolute -top-1.5 -right-1.5 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center" style={{ background: color, color: "#fff", fontSize: 9 }}>
            ×{node.turns.length}
          </span>
        )}
      </div>

      {/* Label */}
      <div className="text-center">
        <p className="text-xs font-bold capitalize leading-tight" style={{ color: selected ? color : "var(--foreground)" }}>
          {node.role.replace(/_/g, " ")}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-light)", fontSize: 10 }}>
          {node.isActive ? "Working…" : hasOutput ? `${Math.round(totalOutput / 1000)}k chars` : "—"}
        </p>
      </div>

      {/* Bottom dot indicator */}
      <div className="w-2 h-2 rounded-full" style={{ background: node.isActive ? "#0284c7" : hasOutput ? "#059669" : "var(--card-border)" }} />
    </button>
  );
}

/* ─── Pipeline graph ─────────────────────────────────────── */
function PipelineGraph({ nodes, selected, onSelect }: {
  nodes: PipelineNode[];
  selected: string | null;
  onSelect: (role: string) => void;
}) {
  if (nodes.length === 0) return (
    <div className="flex items-center justify-center gap-2 py-8" style={{ borderBottom: "1px solid var(--card-border)" }}>
      <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent)" }} />
      <span className="text-sm" style={{ color: "var(--muted)" }}>Agents starting up…</span>
    </div>
  );

  return (
    <div className="px-6 py-5 overflow-x-auto" style={{ borderBottom: "1px solid var(--card-border)", background: "var(--card)" }}>
      <div className="flex items-start gap-0 w-max mx-auto">
        {nodes.map((node, i) => (
          <div key={node.role} className="flex items-center gap-0">
            <PipelineNodeCard node={node} selected={selected === node.role} onClick={() => onSelect(node.role)} />
            {i < nodes.length - 1 && (
              <div className="flex flex-col items-center mx-1 mt-[-20px]">
                {/* Arrow */}
                <div className="flex items-center gap-0" style={{ color: "var(--card-border)" }}>
                  <div className="h-px w-6" style={{ background: "var(--card-border)" }} />
                  <ChevronRight size={12} style={{ color: "var(--muted-light)" }} />
                </div>
                {/* Revision back-arrow if next node has multiple turns */}
                {nodes[i + 1]?.turns.length > 1 && (
                  <div className="flex items-center gap-1 mt-1" style={{ color: "var(--muted-light)" }}>
                    <RotateCcw size={9} />
                    <span style={{ fontSize: 8, color: "var(--muted-light)" }}>revised</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Pipeline status bar */}
      <div className="mt-4 flex items-center justify-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: "#059669" }} />
          <span className="text-xs" style={{ color: "var(--muted)" }}>Complete</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#0284c7" }} />
          <span className="text-xs" style={{ color: "var(--muted)" }}>Running</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: "var(--card-border)" }} />
          <span className="text-xs" style={{ color: "var(--muted)" }}>Pending</span>
        </div>
        {nodes.some(n => n.turns.length > 1) && (
          <div className="flex items-center gap-1.5">
            <RotateCcw size={10} style={{ color: "var(--muted)" }} />
            <span className="text-xs" style={{ color: "var(--muted)" }}>×N = revision cycles</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Agent detail: split INPUT / OUTPUT panel ───────────── */
/* Expandable text block used in INPUT/OUTPUT/Delivery panels */
function ExpandableContent({ content, renderAs, thresholdChars = 1200 }: {
  content: string;
  renderAs: "mono" | "markdown";
  thresholdChars?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > thresholdChars;
  const body = renderAs === "markdown"
    ? <MarkdownContent content={content} />
    : <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words" style={{ color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>{content}</pre>;

  if (!isLong) return <>{body}</>;

  return (
    <div>
      <div className="relative" style={!expanded ? { maxHeight: 420, overflow: "hidden" } : undefined}>
        {body}
        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
            style={{ background: "linear-gradient(transparent, var(--background, #fff))" }} />
        )}
      </div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="mt-3 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)", color: "var(--accent)" }}
      >
        {expanded ? "▲ Show less" : `▼ Show full content (${content.length.toLocaleString()} chars)`}
      </button>
    </div>
  );
}

function AgentDetail({ node, streamingToken, agentDef }: { node: PipelineNode; streamingToken?: string; agentDef?: { description?: string; responsibilities?: string[] } }) {
  const [turn, setTurn] = useState(node.turns.length - 1);
  const color = agentColor(node.role);

  // Reset to latest turn when node changes
  useEffect(() => { setTurn(node.turns.length - 1); }, [node.role, node.turns.length]);

  const currentTurn = node.turns[turn] ?? node.turns[0];

  return (
    <div className="border-t" style={{ borderColor: "var(--card-border)" }}>
      {/* Agent detail header */}
      <div className="px-6 py-3 flex items-center justify-between gap-4" style={{ borderBottom: "1px solid var(--card-border)", background: "var(--card)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}15`, border: `2px solid ${color}30` }}>
            <Bot size={15} style={{ color }} />
          </div>
          <div>
            <span className="font-bold text-sm capitalize" style={{ color }}>{node.role.replace(/_/g, " ")}</span>
            {node.turns.length > 1 && (
              <span className="text-xs ml-2 font-medium" style={{ color: "var(--muted)" }}>
                {node.turns.length} revision{node.turns.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {node.isActive && (
            <span className="flex items-center gap-1.5 text-xs font-semibold animate-pulse" style={{ color: "#0284c7" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />Working…
            </span>
          )}
        </div>

        {/* Turn selector */}
        {node.turns.length > 1 && (
          <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: "var(--background, #fff)", border: "1px solid var(--card-border)" }}>
            {node.turns.map((_t, i) => (
              <button
                key={i}
                onClick={() => setTurn(i)}
                className="text-xs px-3 py-1.5 rounded-md font-semibold transition-all"
                style={{ background: turn === i ? color : "transparent", color: turn === i ? "#fff" : "var(--muted)" }}
              >
                Turn {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Split pane: INPUT left, OUTPUT right — natural height, page scrolls */}
      <div className="flex" style={{ minHeight: 220 }}>

        {/* INPUT panel */}
        {currentTurn?.input ? (
          <div className="w-2/5 shrink-0 p-5" style={{ borderRight: "1px solid var(--card-border)", background: "#fffbeb" }}>
            <div className="flex items-center gap-2 mb-3">
              <ArrowDownRight size={11} style={{ color: "#92400e" }} />
              <span className="text-xs font-bold tracking-wider" style={{ color: "#92400e" }}>INPUT</span>
              <span className="text-xs font-mono ml-auto px-2 py-0.5 rounded" style={{ background: "#fef3c7", color: "#a16207" }}>
                {currentTurn.input.content.length.toLocaleString()} chars
              </span>
            </div>
            {agentDef?.description && (
              <div className="mb-3 px-3 py-2 rounded-lg text-xs leading-relaxed" style={{ background: "#fef9c3", border: "1px solid #fde68a", color: "#92400e" }}>
                <span className="font-bold">Role: </span>{agentDef.description}
              </div>
            )}
            {agentDef?.responsibilities && agentDef.responsibilities.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-bold mb-1.5" style={{ color: "#92400e" }}>Responsibilities</p>
                <ul className="space-y-1">
                  {agentDef.responsibilities.slice(0, 3).map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: "#78350f" }}>
                      <span className="mt-0.5 shrink-0" style={{ color: "#d97706" }}>•</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid #fde68a" }}>
              <ExpandableContent content={currentTurn.input.content} renderAs="mono" thresholdChars={500} />
            </div>
          </div>
        ) : (
          <div className="w-2/5 shrink-0 flex items-center justify-center py-12" style={{ borderRight: "1px solid var(--card-border)", background: "#fafafa" }}>
            <div className="text-center">
              <Inbox size={20} className="mx-auto mb-2" style={{ color: "var(--muted-light)" }} />
              <p className="text-xs font-medium" style={{ color: "var(--muted-light)" }}>No input recorded</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted-light)", fontSize: 10 }}>Context from previous agents flows here</p>
            </div>
          </div>
        )}

        {/* OUTPUT panel */}
        <div className="flex-1 p-5" style={{ background: "var(--card)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Bot size={11} style={{ color }} />
            <span className="text-xs font-bold tracking-wider" style={{ color }}>OUTPUT</span>
            {currentTurn?.output && (
              <span className="text-xs font-mono ml-auto px-2 py-0.5 rounded" style={{ background: `${color}12`, color }}>
                {currentTurn.output.content.length.toLocaleString()} chars
              </span>
            )}
            {!currentTurn?.output && streamingToken && (
              <span className="text-xs font-mono ml-auto px-2 py-0.5 rounded animate-pulse" style={{ background: `${color}12`, color }}>
                streaming…
              </span>
            )}
          </div>
          {currentTurn?.output ? (
            <div className="rounded-xl p-4" style={{ background: "var(--background, #fff)", border: "1px solid var(--card-border)" }}>
              <ExpandableContent content={currentTurn.output.content} renderAs="markdown" thresholdChars={600} />
            </div>
          ) : streamingToken ? (
            <div className="rounded-xl p-4" style={{ background: "var(--background, #fff)", border: `1px solid ${color}30` }}>
              <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words" style={{ color: "var(--foreground)" }}>
                {streamingToken}
                <span className="inline-block w-2 h-4 ml-0.5 align-middle animate-pulse" style={{ background: color }} />
              </pre>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              {node.isActive ? (
                <>
                  <Loader2 size={20} className="animate-spin" style={{ color }} />
                  <p className="text-sm font-medium" style={{ color }}>Agent is working…</p>
                </>
              ) : (
                <p className="text-sm" style={{ color: "var(--muted)" }}>No output yet</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Raw feed ───────────────────────────────────────────── */
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
          <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--card-border)", color: "var(--muted)", fontSize: 9 }}>{msg.type}</span>
          {msg.isLive && <span className="text-xs animate-pulse" style={{ color: "var(--accent)", fontSize: 10 }}>● live</span>}
          {isInput && <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: "#fef9c3", color: "#92400e", fontSize: 9 }}>INPUT</span>}
        </div>
        <div className={`text-xs font-mono leading-relaxed rounded-lg px-3 py-2 whitespace-pre-wrap relative transition-all ${isLong && !expanded ? "max-h-28 overflow-hidden" : ""}`}
          style={{ background: "var(--card)", border: "1px solid var(--card-border)", color: "var(--foreground)" }}>
          {msg.content}
          {isLong && !expanded && <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none" style={{ background: "linear-gradient(transparent, var(--card))" }} />}
        </div>
        {isLong && <button onClick={() => setExpanded(e => !e)} className="text-xs font-medium mt-1" style={{ color: "var(--accent)" }}>{expanded ? "Collapse" : `Expand (${msg.content.length.toLocaleString()} chars)`}</button>}
      </div>
    </div>
  );
}

/* ─── Delivery panel ─────────────────────────────────────── */
function extractQualityReport(messages: Message[]) {
  const reviewRoles = ["qa","fact_checker","critic","clause_flagger","protection_checker","bear_case","risk_agent"];
  const reviews = messages.filter(m => reviewRoles.includes(m.agent_role) && m.type === "agent_output");
  if (!reviews.length) return null;
  const last = reviews[reviews.length - 1];
  const scoreMatch = last.content.match(/"score":\s*([0-9.]+)/) || last.content.match(/score[:\s]+([0-9.]+)/i) || last.content.match(/([0-9.]+)\s*\/\s*10/i);
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : undefined;
  const passedMatch = last.content.match(/"passed":\s*(true|false)/);
  const verdict = passedMatch ? (passedMatch[1] === "true" ? "pass" : "fail") : score !== undefined ? (score >= 7 ? "pass" : "fail") : "unknown";
  const findings = last.content.split("\n").filter(l => l.trim().match(/^[-•*]/)).map(l => l.trim().replace(/^[-•*]\s*/,"")).filter(l => l.length > 0).slice(0,5);
  return { reviewer: last.agent_role.replace(/_/g," "), score, verdict, findings, revisions: reviews.length };
}

function extractDeliverable(messages: Message[]) {
  const roles = ["writer","editor","synthesizer","legal_editor","content_editor","literature_synthesizer","citation_agent"];
  const del = messages.filter(m => roles.includes(m.agent_role) && m.type === "agent_output");
  return del[del.length - 1] ?? null;
}

function DeliveryPanel({ task, messages, preset, fileCount }: { task: Task; messages: Message[]; preset: Preset | undefined; fileCount: number }) {
  const deliverable = extractDeliverable(messages);
  const quality = extractQualityReport(messages);
  const [tab, setTab] = useState<"output"|"report">("output");
  const isDevPreset = (task.preset_id === "software-dev" || (!task.preset_id && (preset?.agents?.some(a => a.role.toLowerCase().includes("developer")) ?? false))) && fileCount > 0;
  return (
    <div className="mx-6 mb-6 mt-4 rounded-2xl overflow-hidden shrink-0" style={{ border: "1px solid var(--card-border)" }}>
      <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ background: "var(--accent-light)", borderBottom: "1px solid rgba(79,70,229,0.15)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <CheckCircle2 size={15} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-bold" style={{ color: "var(--accent)" }}>{preset ? `${preset.name} complete` : "Task complete"}</span>
          {quality && <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${quality.verdict==="pass"?"text-green-700":quality.verdict==="fail"?"text-red-700":"text-yellow-700"}`} style={{ background: quality.verdict==="pass"?"#dcfce7":quality.verdict==="fail"?"#fee2e2":"#fef9c3" }}>
            {quality.verdict==="pass"?"✓ QA Passed":quality.verdict==="fail"?"✗ QA Failed":"QA Unknown"}{quality.score!==undefined&&` · ${quality.score}/10`}
          </span>}
        </div>
        <div className="flex items-center gap-2">
          {(deliverable || isDevPreset) && (
            <div className="flex gap-1">
              {(["output","report"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className="text-xs px-2.5 py-1 rounded-md font-medium capitalize" style={{ background: tab===t?"var(--accent)":"transparent", color: tab===t?"#fff":"var(--accent)" }}>
                  {t==="output"?"Deliverable":"QA Report"}
                </button>
              ))}
            </div>
          )}
          {isDevPreset && <Link href={`/preview/${task.id}`} target="_blank" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: "var(--accent)" }}><ExternalLink size={11}/> Preview app</Link>}
        </div>
      </div>
      <div className="p-5">
        {tab === "output" ? (
          deliverable ? (
            <div>
              <div className="flex items-center gap-2 mb-3"><ScrollText size={14} style={{ color: "var(--muted)" }}/><span className="text-xs font-semibold capitalize" style={{ color: "var(--muted)" }}>Final output · {deliverable.agent_role.replace(/_/g," ")}</span></div>
              <div className="rounded-xl px-5 py-4" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}><ExpandableContent content={deliverable.content} renderAs="markdown" thresholdChars={1200} /></div>
            </div>
          ) : isDevPreset ? (
            <div className="text-center py-4"><Code2 size={24} className="mx-auto mb-2" style={{ color: "var(--muted-light)" }}/><p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>App built</p><Link href={`/preview/${task.id}`} target="_blank" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white mt-2" style={{ background: "var(--accent)" }}><ExternalLink size={13}/> Open preview</Link></div>
          ) : <p className="text-sm text-center py-4" style={{ color: "var(--muted)" }}>No deliverable found.</p>
        ) : (
          quality ? (
            <div className="space-y-4">
              {quality.score!==undefined&&<div><div className="flex justify-between mb-1.5"><span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Quality score</span><span className="text-sm font-bold" style={{ color: quality.score>=7?"#059669":"#dc2626" }}>{quality.score}/10</span></div><div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--card-border)" }}><div className="h-full rounded-full" style={{ width:`${(quality.score/10)*100}%`, background: quality.score>=7?"#059669":"#dc2626" }}/></div></div>}
              <div className="grid grid-cols-3 gap-3">
                {[{label:"Verdict",value:quality.verdict==="pass"?"Pass":"Fail",icon:quality.verdict==="pass"?CheckCircle2:XCircle,color:quality.verdict==="pass"?"#059669":"#dc2626"},{label:"Reviewer",value:quality.reviewer,icon:ShieldCheck,color:"#7c3aed"},{label:"Cycles",value:String(quality.revisions),icon:RefreshCw,color:"#0284c7"}].map(({label,value,icon:Icon,color})=>(
                  <div key={label} className="rounded-xl p-3 text-center" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}><Icon size={15} className="mx-auto mb-1" style={{ color }}/><p className="text-xs font-bold" style={{ color: "var(--foreground)" }}>{value}</p><p className="text-xs" style={{ color: "var(--muted)" }}>{label}</p></div>
                ))}
              </div>
              {quality.findings.length>0&&<div><p className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>Key findings</p><div className="space-y-1.5">{quality.findings.map((f,i)=><div key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--foreground)" }}><CircleDot size={10} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }}/>{f}</div>)}</div></div>}
            </div>
          ) : <div className="text-center py-4"><BarChart3 size={24} className="mx-auto mb-2" style={{ color: "var(--muted-light)" }}/><p className="text-sm" style={{ color: "var(--muted)" }}>No QA data.</p></div>
        )}
      </div>
    </div>
  );
}

/* ─── Preset selector ────────────────────────────────────── */
function PresetSelector({ presets, selected, onSelect }: { presets: Preset[]; selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {presets.map(p => {
        const Icon = PRESET_ICONS[p.id] ?? Layers;
        const active = p.id === selected;
        return (
          <button key={p.id} onClick={() => onSelect(p.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" style={{ background: active ? p.categoryColor : "var(--card)", color: active ? "#fff" : "var(--muted)", border: active ? "none" : "1px solid var(--card-border)", boxShadow: active ? `0 2px 8px ${p.categoryColor}40` : "none" }}>
            <Icon size={12}/>{p.name}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────── */
export default function ProjectsPage() {
  const [allPresets, setAllPresets] = useState<Preset[]>(() => {
    if (typeof window === "undefined") return BUILTIN_PRESETS;
    const builtinIds = new Set(BUILTIN_PRESETS.map(p => p.id));
    const builtinNames = new Set(BUILTIN_PRESETS.map(p => p.name.toLowerCase()));
    const custom = loadCustomPresets().filter(p => !builtinIds.has(p.id) && !builtinNames.has(p.name.toLowerCase()));
    return [...BUILTIN_PRESETS, ...custom];
  });
  const [selectedPresetId, setSelectedPresetId] = useState("software-dev");
  const [goal, setGoal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [liveEvents, setLiveEvents] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("pipeline");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineLoading, setRefineLoading] = useState(false);
  const [refineQuestions, setRefineQuestions] = useState<RefinementQuestion[]>([]);
  const [tldr, setTldr] = useState<string | null>(null);
  const [tldrLoading, setTldrLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<Record<string, string>>({});
  const [cancelling, setCancelling] = useState(false);
  const [taskFileCount, setTaskFileCount] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const active = loadActivePresetId();
    if (active) setSelectedPresetId(active);
    fetchTasks();
    const iv = setInterval(fetchTasks, 5000);
    fetchPresetsFromAPI().then(remote => {
      if (!remote.length) return;
      const builtinIds = new Set(BUILTIN_PRESETS.map(p => p.id));
      const builtinNames = new Set(BUILTIN_PRESETS.map(p => p.name.toLowerCase()));
      const local = loadCustomPresets();
      const customOnly = [...remote, ...local.filter(p => !remote.find((r: Preset) => r.id === p.id))]
        .filter(p => !builtinIds.has(p.id) && !builtinNames.has(p.name.toLowerCase()));
      saveCustomPresets(customOnly);
      setAllPresets([...BUILTIN_PRESETS, ...customOnly]);
    });
    return () => clearInterval(iv);
  }, []);

  const fetchTasks = async () => {
    try {
      const r = await fetch(`${API}/tasks/`);
      if (r.ok) setTasks(await r.json());
    } catch {}
  };

  const fetchTldr = async (taskId: string) => {
    setTldr(null);
    setTldrLoading(true);
    try {
      const r = await fetch(`${API}/tasks/${taskId}/summary`);
      if (r.ok) { const d = await r.json(); setTldr(d.summary ?? null); }
    } catch { /* silent */ }
    finally { setTldrLoading(false); }
  };

  const cancelTask = async (taskId: string) => {
    if (cancelling) return;
    setCancelling(true);
    try {
      await fetch(`${API}/tasks/${taskId}/cancel`, { method: "POST" });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "cancelled" } : t));
    } finally {
      setCancelling(false);
    }
  };

  const fetchMessages = async (taskId: string) => {
    try {
      const r = await fetch(`${API}/tasks/${taskId}`);
      if (r.ok) {
        const d = await r.json();
        setMessages(d.messages ?? []);
        setLiveEvents([]); // clear live events — DB has the full content now
      }
    } catch {}
  };

  const fetchFileCount = async (taskId: string) => {
    try {
      const r = await fetch(`${API}/tasks/${taskId}/files`);
      if (r.ok) { const files = await r.json(); setTaskFileCount(files.length); }
    } catch {}
  };

  const selectTask = async (taskId: string) => {
    setSelectedId(taskId);
    setLiveEvents([]);
    setSelectedAgent(null);
    setTldr(null);
    setStreamingContent({});
    setCancelling(false);
    setTaskFileCount(0);
    setLoadingMessages(true);
    wsRef.current?.close();
    try {
      const r = await fetch(`${API}/tasks/${taskId}`);
      if (r.ok) {
        const d = await r.json();
        setMessages(d.messages ?? []);
        if (d.status === "done") {
          fetchTldr(taskId);
          fetchFileCount(taskId);
        }
      }
    } finally { setLoadingMessages(false); }

    const ws = new WebSocket(`${WS}/ws/${taskId}`);
    ws.onmessage = e => {
      const ev: LiveEvent = JSON.parse(e.data);

      // Handle streaming tokens
      if (ev.type === "token") {
        setStreamingContent(prev => ({
          ...prev,
          [ev.agent]: (prev[ev.agent] ?? "") + ev.content,
        }));
        return;
      }

      // When DB output arrives for a role, clear its streaming buffer
      if (ev.type === "agent_output") {
        setStreamingContent(prev => {
          const next = { ...prev };
          delete next[ev.agent];
          return next;
        });
      }

      if (ev.type === "cancelled") {
        setTasks(prev => prev.map(t => t.id !== taskId ? t : { ...t, status: "cancelled" }));
        return;
      }

      setLiveEvents(prev => [...prev, { id: `live-${Date.now()}`, agent_role: ev.agent, type: ev.type, content: ev.content, created_at: new Date().toISOString(), isLive: true }]);
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t;
        if (ev.type === "done" || ev.type === "done_escalated") {
          setTimeout(() => { fetchTldr(taskId); fetchFileCount(taskId); fetchMessages(taskId); }, 1500);
          return { ...t, status: "done" };
        }
        if (ev.type === "error") return { ...t, status: "failed" };
        if (["ceo","analyst","researcher"].includes(ev.agent)) return { ...t, status: "planning" };
        if (["developer","content_writer","summarizer","bear_case"].includes(ev.agent)) return { ...t, status: "executing" };
        if (["qa","fact_checker","critic","risk_agent"].includes(ev.agent)) return { ...t, status: "reviewing" };
        return t;
      }));
    };
    wsRef.current = ws;
  };

  const submitTask = async () => {
    if (!goal.trim() || submitting) return;
    // Open modal immediately in loading state, fetch questions in background
    setRefineOpen(true);
    setRefineLoading(true);
    setRefineQuestions([]);
    try {
      const r = await fetch(`${API}/tasks/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim(), preset_id: selectedPresetId }),
      });
      if (r.ok) {
        const d = await r.json();
        setRefineQuestions(d.questions ?? []);
      }
    } catch {
      // On network error, just close and submit directly
      setRefineOpen(false);
      confirmTask({}, []);
      return;
    } finally {
      setRefineLoading(false);
    }
  };

  const confirmTask = async (answers: Record<string, string>, questions: RefinementQuestion[]) => {
    setRefineOpen(false);
    setSubmitting(true);
    const enrichedGoal = buildEnrichedGoal(goal.trim(), questions, answers);
    try {
      const r = await fetch(`${API}/tasks/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: enrichedGoal, preset_id: selectedPresetId }) });
      if (r.ok) {
        const d = await r.json();
        setGoal("");
        await fetchTasks();
        setTasks(prev => prev.map(t => t.id === d.task_id ? { ...t, preset_id: selectedPresetId } : t));
        selectTask(d.task_id);
      }
    } finally { setSubmitting(false); }
  };

  const selectedTask = tasks.find(t => t.id === selectedId);
  const selectedPreset = allPresets.find(p => p.id === selectedPresetId);
  const taskPreset = allPresets.find(p => p.id === selectedTask?.preset_id);

  // Only include live events for agents not yet persisted to DB.
  // This prevents short WS preview strings ("3 steps planned") from
  // overriding the real full output that was already saved to the DB.
  const rolesWithDbOutput = new Set(
    messages.filter(m => m.type === "agent_output").map(m => m.agent_role)
  );
  const filteredLive = liveEvents.filter(e => !rolesWithDbOutput.has(e.agent_role));
  const allMessages = [...messages, ...filteredLive];
  const pipeline = buildPipeline(allMessages);

  // Auto-select last active node when pipeline populates (only if nothing is selected)
  useEffect(() => {
    if (pipeline.length > 0 && !selectedAgent) {
      setSelectedAgent(pipeline[pipeline.length - 1].role);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.length]);

  const selectedNode = pipeline.find(n => n.role === selectedAgent);

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Refinement modal ── */}
      {refineOpen && (
        <RefinementModal
          questions={refineQuestions}
          loading={refineLoading}
          accentColor={selectedPreset?.categoryColor ?? "#4f46e5"}
          onConfirm={answers => confirmTask(answers, refineQuestions)}
          onSkip={() => confirmTask({}, [])}
        />
      )}
      {/* ── Header ── */}
      <div className="px-4 sm:px-8 lg:px-10 pt-8 pb-4 border-b shrink-0" style={{ borderColor: "var(--card-border)" }}>
        <div className="mb-4">
          <h1 className="text-2xl font-bold mb-0.5" style={{ color: "var(--foreground)" }}>Projects</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Pick a specialist team, describe the task, and let your agents handle it.</p>
        </div>
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Agent team</span>
            {selectedPreset && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${selectedPreset.categoryColor}15`, color: selectedPreset.categoryColor }}>{selectedPreset.agents.length} agents</span>}
          </div>
          <PresetSelector presets={allPresets} selected={selectedPresetId} onSelect={setSelectedPresetId} />
          {selectedPreset && <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--muted)" }}><span className="font-mono" style={{ color: selectedPreset.categoryColor }}>{selectedPreset.tagline}</span>{" · "}{selectedPreset.description.split(".")[0]}.</p>}
        </div>
        <div className="flex gap-2">
          <textarea className="flex-1 px-4 py-3 rounded-xl text-sm resize-none border outline-none" style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--foreground)", minHeight: "52px", maxHeight: "120px" }}
            placeholder={selectedPresetId === "investment-analysis" ? 'e.g. "Analyse the investment case for SpaceX"' : selectedPresetId === "software-dev" ? 'e.g. "Build a calculator web app"' : 'Describe what you want your agents to do…'}
            value={goal} rows={1} onChange={e => setGoal(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitTask(); } }}
          />
          <button onClick={submitTask} disabled={!goal.trim() || submitting} className="px-4 py-3 rounded-xl text-sm font-semibold text-white flex items-center gap-2 shrink-0 disabled:opacity-50" style={{ background: selectedPreset?.categoryColor ?? "var(--accent)" }}>
            {submitting ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
            {submitting ? "Starting…" : "Run"}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1">
        {/* Task list — sticky sidebar that scrolls independently */}
        <div className="w-64 shrink-0 border-r flex flex-col sticky top-0" style={{ borderColor: "var(--card-border)", background: "#fafafa", height: "100vh", maxHeight: "100vh" }}>
          <div className="p-3 flex items-center justify-between border-b shrink-0" style={{ borderColor: "var(--card-border)" }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-light)" }}>{tasks.length} projects</span>
            <button onClick={fetchTasks} className="p-1 rounded" style={{ color: "var(--muted)" }}><RefreshCw size={13}/></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {tasks.length === 0 ? (
              <div className="p-6 text-center"><Lightbulb size={24} className="mx-auto mb-2" style={{ color: "var(--muted-light)" }}/><p className="text-sm" style={{ color: "var(--muted)" }}>No projects yet.</p></div>
            ) : tasks.map(task => {
              const cfg = STATUS_CFG[task.status] ?? STATUS_CFG.pending;
              const active = task.id === selectedId;
              const tPreset = allPresets.find(p => p.id === task.preset_id);
              const PIcon = tPreset ? (PRESET_ICONS[tPreset.id] ?? Layers) : FlaskConical;
              const isLong = task.goal.length > 70;
              const cardExp = expandedCards.has(task.id);
              return (
                <div key={task.id} className="w-full text-left px-4 py-3 border-b" style={{ borderColor: "var(--card-border)", background: active ? "var(--accent-light)" : "transparent", borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent" }}>
                  <div className="cursor-pointer" onClick={() => selectTask(task.id)}>
                    <div className="flex items-center gap-2 mb-1">
                      {isActive(task.status) ? <Loader2 size={10} className="animate-spin" style={{ color: cfg.color }}/> : task.status === "done" ? <CheckCircle2 size={10} style={{ color: cfg.color }}/> : task.status === "failed" ? <XCircle size={10} style={{ color: cfg.color }}/> : <Clock size={10} style={{ color: cfg.color }}/>}
                      <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                      {tPreset && <span className="ml-auto flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full" style={{ background: `${tPreset.categoryColor}12`, color: tPreset.categoryColor }}><PIcon size={8}/><span style={{ fontSize: 9 }}>{tPreset.name.split(" ")[0]}</span></span>}
                    </div>
                    <p className="text-xs leading-snug" style={{ color: active ? "var(--accent)" : "var(--foreground)" }}>
                      {isLong && !cardExp ? task.goal.slice(0, 70) + "…" : task.goal}
                    </p>
                  </div>
                  {isLong && <button onClick={e => { e.stopPropagation(); setExpandedCards(prev => { const n = new Set(prev); if (cardExp) n.delete(task.id); else n.add(task.id); return n; }); }} className="text-xs mt-1 font-medium" style={{ color: "var(--accent)" }}>{cardExp ? "Less" : "More"}</button>}
                  <p className="text-xs mt-1" style={{ color: "var(--muted-light)" }}>{new Date(task.created_at).toLocaleTimeString()}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm px-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-light)", border: "1px solid rgba(79,70,229,0.15)" }}>
                  <Bot size={28} style={{ color: "var(--accent)" }}/>
                </div>
                <p className="text-base font-semibold mb-1" style={{ color: "var(--foreground)" }}>Select a project</p>
                <p className="text-sm" style={{ color: "var(--muted)" }}>Click a project to see the agent pipeline and inspect each agent&apos;s input and output.</p>
                <div className="mt-6 space-y-2 text-left">
                  {BUILTIN_PRESETS.map(p => {
                    const Icon = PRESET_ICONS[p.id] ?? Layers;
                    return (
                      <button key={p.id} onClick={() => setSelectedPresetId(p.id)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${p.categoryColor}12`, border: `1px solid ${p.categoryColor}25` }}><Icon size={13} style={{ color: p.categoryColor }}/></div>
                        <div className="min-w-0"><p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{p.name}</p><p className="text-xs truncate" style={{ color: "var(--muted)" }}>{p.tagline}</p></div>
                        <ArrowRight size={12} className="shrink-0 ml-auto" style={{ color: "var(--muted-light)" }}/>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Task header + view toggle */}
              <div className="px-6 py-3 flex items-center justify-between gap-4 shrink-0" style={{ borderBottom: "1px solid var(--card-border)" }}>
                <div className="flex-1 min-w-0">
                  {selectedTask && (() => {
                    const cfg = STATUS_CFG[selectedTask.status] ?? STATUS_CFG.pending;
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        {isActive(selectedTask.status) ? <Loader2 size={13} className="animate-spin" style={{ color: cfg.color }}/> : <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.color }}/>}
                        <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                        {taskPreset && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${taskPreset.categoryColor}12`, color: taskPreset.categoryColor }}>{taskPreset.name}</span>}
                        <span className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                          {selectedTask.goal.length > 80 ? selectedTask.goal.slice(0,80) + "…" : selectedTask.goal}
                        </span>
                        {isActive(selectedTask.status) && (
                          <button
                            onClick={() => cancelTask(selectedTask.id)}
                            disabled={cancelling}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ml-1"
                            style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca" }}
                            title="Cancel task"
                          >
                            {cancelling ? <Loader2 size={10} className="animate-spin"/> : <XCircle size={10}/>}
                            Cancel
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-0.5 p-0.5 rounded-xl shrink-0" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
                  {([{ mode: "pipeline" as ViewMode, icon: BarChart3, label: "Pipeline" }, { mode: "raw" as ViewMode, icon: Terminal, label: "Raw" }] as const).map(({ mode, icon: Icon, label }) => (
                    <button key={mode} onClick={() => setViewMode(mode)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" style={{ background: viewMode===mode?"var(--accent)":"transparent", color: viewMode===mode?"#fff":"var(--muted)" }}>
                      <Icon size={11}/>{label}
                    </button>
                  ))}
                </div>
              </div>

              {loadingMessages ? (
                <div className="flex-1 flex items-center justify-center"><Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }}/></div>
              ) : viewMode === "pipeline" ? (
                <div>
                  {/* Pipeline graph — sticky within <main> scroll so nodes stay visible */}
                  <div className="sticky top-0 z-10" style={{ background: "var(--card)" }}>
                    <PipelineGraph
                      nodes={pipeline}
                      selected={selectedAgent}
                      onSelect={role => setSelectedAgent(role)}
                    />
                  </div>

                  {/* TL;DR summary — shown when task is done */}
                  {(selectedTask?.status === "done" || tldrLoading) && (
                    <div className="mx-6 mt-5">
                      {tldrLoading ? (
                        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl" style={{ background: "var(--accent-light)", border: "1px solid rgba(79,70,229,0.15)" }}>
                          <Loader2 size={15} className="animate-spin shrink-0" style={{ color: "var(--accent)" }} />
                          <span className="text-sm" style={{ color: "var(--accent)" }}>Generating summary…</span>
                        </div>
                      ) : tldr ? (
                        <div className="px-5 py-4 rounded-2xl" style={{ background: "var(--accent-light)", border: "1px solid rgba(79,70,229,0.15)" }}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold tracking-wider" style={{ color: "var(--accent)" }}>TL;DR</span>
                            <div className="flex-1 h-px" style={{ background: "rgba(79,70,229,0.15)" }} />
                          </div>
                          <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{tldr}</p>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Agent detail pane — natural height, full content visible */}
                  {selectedNode ? (
                    <AgentDetail node={selectedNode} streamingToken={streamingContent[selectedNode.role]} agentDef={taskPreset?.agents?.find(a => a.role.toLowerCase().replace(/ /g,"_") === selectedNode.role)} />
                  ) : (
                    <div className="flex items-center justify-center py-16">
                      <p className="text-sm" style={{ color: "var(--muted)" }}>Click an agent in the pipeline above to inspect their input and output.</p>
                    </div>
                  )}
                  {/* Delivery panel */}
                  {selectedTask?.status === "done" && (
                    <DeliveryPanel task={selectedTask} messages={allMessages} preset={taskPreset} fileCount={taskFileCount} />
                  )}
                </div>
              ) : (
                /* Raw view */
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "var(--card-border)" }}>
                    <Terminal size={12} style={{ color: "var(--muted)" }}/>
                    <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Raw log · {allMessages.length} messages</span>
                    <span className="text-xs px-2 py-0.5 rounded font-mono ml-auto" style={{ background: "#fef9c3", color: "#92400e" }}>INPUT = prompt sent to agent · OUTPUT = LLM response</span>
                  </div>
                  {allMessages.map((msg, i) => <RawFeedMessage key={msg.id ?? i} msg={msg}/>)}
                  {selectedTask?.status === "done" && <DeliveryPanel task={selectedTask} messages={allMessages} preset={taskPreset} fileCount={taskFileCount}/>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
