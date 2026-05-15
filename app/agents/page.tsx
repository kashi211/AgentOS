"use client";

import { useEffect, useState } from "react";
import {
  Zap, Plus, Pencil, Trash2, X, ChevronUp, ChevronDown,
  ArrowRight, RefreshCw, Save, AlertCircle, Layers, CheckCircle2,
  Copy, Bot, Crown, Map, Code2, Bug, PenLine, Search, ShieldCheck,
  Swords, FileEdit, TrendingUp, TrendingDown, Database, TriangleAlert,
  Brain, FileText, Flag, Shield, Globe, Target, BookOpen,
  MessageSquare, Quote, FolderOpen, MessageCircle, Package,
  Scale, Megaphone, type LucideIcon,
} from "lucide-react";
import {
  BUILTIN_PRESETS, loadCustomPresets, saveCustomPresets,
  loadActivePresetId, activatePreset,
  fetchPresetsFromAPI, upsertPresetToAPI, deletePresetFromAPI,
  type Agent, type Workflow, type Preset,
} from "@/lib/presets";

/* ─── Agent icon map ─────────────────────────────────────── */

const AGENT_ICONS: Record<string, LucideIcon> = {
  ceo: Crown,
  planner: Map,
  developer: Code2,
  qa: Bug,
  writer: PenLine,
  researcher: Search,
  fact_checker: ShieldCheck,
  devils_advocate: Swords,
  editor: FileEdit,
  analyst: TrendingUp,
  bear_case: TrendingDown,
  data_agent: Database,
  risk_agent: TriangleAlert,
  synthesizer: Brain,
  reader: FileText,
  clause_flagger: Flag,
  protection_checker: Shield,
  legal_editor: PenLine,
  content_writer: PenLine,
  seo_agent: Globe,
  brand_voice: Target,
  content_editor: FileEdit,
  summarizer: BookOpen,
  critic: MessageSquare,
  literature_synthesizer: Layers,
  citation_agent: Quote,
};

function AgentIcon({ id, color, size = 16 }: { id: string; color: string; size?: number }) {
  const Icon = AGENT_ICONS[id] ?? Bot;
  return <Icon size={size} style={{ color }} />;
}

const PRESET_CATEGORY_ICONS: Record<string, LucideIcon> = {
  Engineering: Code2,
  Research: Search,
  Finance: TrendingUp,
  Legal: Scale,
  Marketing: Megaphone,
  Custom: Layers,
};

function PresetIcon({ category, color, size = 18 }: { category: string; color: string; size?: number }) {
  const Icon = PRESET_CATEGORY_ICONS[category] ?? Layers;
  return <Icon size={size} style={{ color }} />;
}

/* ─── Constants ──────────────────────────────────────────── */

const MODELS = ["Claude Opus 4.7", "Claude Sonnet 4.6", "Claude Haiku 4.5"];
const CATEGORIES = ["All", "Engineering", "Research", "Finance", "Legal", "Marketing"];
const CATEGORY_COLORS: Record<string, string> = {
  Engineering: "#0284c7", Research: "#7c3aed", Finance: "#059669",
  Legal: "#64748b", Marketing: "#ec4899", Custom: "#64748b",
};

const _softwareDev = BUILTIN_PRESETS.find(p => p.id === "software-dev")!;
const DEFAULT_AGENTS: Agent[] = _softwareDev.agents;
const DEFAULT_WORKFLOW: Workflow = _softwareDev.workflow;

/* ─── Storage ────────────────────────────────────────────── */

function loadAgents(): Agent[] {
  try { const r = localStorage.getItem("agentos_agents"); if (r) return JSON.parse(r); } catch {}
  return DEFAULT_AGENTS;
}
function saveAgents(a: Agent[]) { localStorage.setItem("agentos_agents", JSON.stringify(a)); }
function loadWorkflow(): Workflow {
  try { const r = localStorage.getItem("agentos_workflow"); if (r) return JSON.parse(r); } catch {}
  return DEFAULT_WORKFLOW;
}
function saveWorkflow(w: Workflow) { localStorage.setItem("agentos_workflow", JSON.stringify(w)); }

/* ─── Agent modal ────────────────────────────────────────── */

function emptyAgent(): Agent {
  return { id: "", role: "", icon: "🤖", color: "#4f46e5", model: "Claude Sonnet 4.6", description: "", responsibilities: [""], systemPrompt: "", tools: [] };
}

function AgentModal({ initial, existingIds, onSave, onClose }: {
  initial: Agent | null; existingIds: string[];
  onSave: (a: Agent) => void; onClose: () => void;
}) {
  const isNew = initial === null;
  const [form, setForm] = useState<Agent>(initial ?? emptyAgent());
  const [error, setError] = useState("");

  const set = <K extends keyof Agent>(k: K, v: Agent[K]) => setForm(f => ({ ...f, [k]: v }));
  const autoId = (r: string) => r.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}>
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b" style={{ background: "var(--background)", borderColor: "var(--card-border)", zIndex: 1 }}>
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>{isNew ? "Create agent" : `Edit · ${initial!.role}`}</h2>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: "var(--muted)" }}><X size={18} /></button>
        </div>
        <div className="p-6 space-y-5">
          {error && <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#dc2626" }}><AlertCircle size={14} /> {error}</div>}
          <div className="flex gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Icon</label>
              <div className="w-12 h-10 rounded-lg flex items-center justify-center" style={{ background: `${form.color}12`, border: `1px solid ${form.color}25` }}>
                <AgentIcon id={form.id || "default"} color={form.color} size={18} />
              </div>
            </div>
            <div className="flex-1"><label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Role name *</label><input className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, id: isNew ? autoId(e.target.value) : f.id }))} placeholder="e.g. Researcher" /></div>
            <div className="w-36"><label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Agent ID *</label><input className="w-full px-3 py-2 rounded-lg border text-sm font-mono outline-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} value={form.id} onChange={e => set("id", e.target.value.toLowerCase().replace(/\s/g, "_"))} disabled={!isNew} /></div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1"><label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Model</label><select className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} value={form.model} onChange={e => set("model", e.target.value)}>{MODELS.map(m => <option key={m}>{m}</option>)}</select></div>
            <div className="w-36"><label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Accent color</label><div className="flex items-center gap-2"><input type="color" className="w-10 h-9 rounded-lg border cursor-pointer" style={{ borderColor: "var(--card-border)" }} value={form.color} onChange={e => set("color", e.target.value)} /><span className="text-xs font-mono" style={{ color: "var(--muted)" }}>{form.color}</span></div></div>
          </div>
          <div><label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Description</label><textarea className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} rows={2} value={form.description} onChange={e => set("description", e.target.value)} placeholder="What does this agent do?" /></div>
          <div>
            <div className="flex items-center justify-between mb-2"><label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Responsibilities</label><button onClick={() => set("responsibilities", [...form.responsibilities, ""])} className="text-xs px-2 py-1 rounded-md flex items-center gap-1" style={{ background: "var(--accent-light)", color: "var(--accent)" }}><Plus size={11} /> Add</button></div>
            <div className="space-y-2">{form.responsibilities.map((r, i) => (<div key={i} className="flex gap-2"><input className="flex-1 px-3 py-1.5 rounded-lg border text-sm outline-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} value={r} onChange={e => { const a = [...form.responsibilities]; a[i] = e.target.value; set("responsibilities", a); }} placeholder={`Responsibility ${i + 1}`} /><button onClick={() => set("responsibilities", form.responsibilities.filter((_, j) => j !== i))} className="p-1.5 rounded-lg" style={{ color: "var(--muted)" }}><X size={14} /></button></div>))}</div>
          </div>
          <div><label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>System prompt</label><textarea className="w-full px-3 py-2 rounded-lg border text-sm font-mono outline-none resize-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} rows={4} value={form.systemPrompt} onChange={e => set("systemPrompt", e.target.value)} placeholder="You are..." /></div>
          <div>
            <div className="flex items-center justify-between mb-2"><label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Tools</label><button onClick={() => set("tools", [...form.tools, ""])} className="text-xs px-2 py-1 rounded-md flex items-center gap-1" style={{ background: "var(--accent-light)", color: "var(--accent)" }}><Plus size={11} /> Add</button></div>
            {form.tools.length === 0 && <p className="text-xs" style={{ color: "var(--muted-light)" }}>No tools — add function names this agent can call.</p>}
            <div className="space-y-2">{form.tools.map((t, i) => (<div key={i} className="flex gap-2"><input className="flex-1 px-3 py-1.5 rounded-lg border text-sm font-mono outline-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} value={t} onChange={e => { const a = [...form.tools]; a[i] = e.target.value; set("tools", a); }} placeholder="tool_name" /><button onClick={() => set("tools", form.tools.filter((_, j) => j !== i))} className="p-1.5 rounded-lg" style={{ color: "var(--muted)" }}><X size={14} /></button></div>))}</div>
          </div>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-3 px-6 py-4 border-t" style={{ background: "var(--background)", borderColor: "var(--card-border)" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--card)", color: "var(--muted)", border: "1px solid var(--card-border)" }}>Cancel</button>
          <button onClick={() => {
            if (!form.role.trim()) { setError("Role name is required."); return; }
            if (!form.id.trim()) { setError("Agent ID is required."); return; }
            if (isNew && existingIds.includes(form.id)) { setError(`ID "${form.id}" is already in use.`); return; }
            onSave({ ...form, role: form.role.trim(), id: form.id.trim(), responsibilities: form.responsibilities.filter(r => r.trim()), tools: form.tools.filter(t => t.trim()) });
          }} className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2" style={{ background: "var(--accent)" }}><Save size={14} /> {isNew ? "Create agent" : "Save changes"}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Workflow editor ────────────────────────────────────── */

function WorkflowEditor({ workflow, agents, onChange, onClose }: {
  workflow: Workflow; agents: Agent[];
  onChange: (w: Workflow) => void; onClose: () => void;
}) {
  const [wf, setWf] = useState<Workflow>(JSON.parse(JSON.stringify(workflow)));
  const [newLoop, setNewLoop] = useState({ fromId: "", toId: "", maxIterations: 2, condition: "" });
  const agentMap = Object.fromEntries(agents.map(a => [a.id, a]));

  const moveNode = (i: number, dir: -1 | 1) => {
    const ids = [...wf.nodeIds]; const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setWf(w => ({ ...w, nodeIds: ids }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}>
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b" style={{ background: "var(--background)", borderColor: "var(--card-border)", zIndex: 1 }}>
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>Edit workflow</h2>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: "var(--muted)" }}><X size={18} /></button>
        </div>
        <div className="p-6 space-y-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted-light)" }}>Execution order</p>
            <div className="space-y-2">
              {wf.nodeIds.map((id, i) => {
                const a = agentMap[id]; if (!a) return null;
                return (
                  <div key={id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${a.color}12`, border: `1px solid ${a.color}25` }}><AgentIcon id={a.id} color={a.color} size={15} /></div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{a.role}</p><p className="text-xs font-mono" style={{ color: "var(--muted)" }}>{a.id}</p></div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => moveNode(i, -1)} disabled={i === 0} className="p-1 rounded-md disabled:opacity-30" style={{ color: "var(--muted)" }}><ChevronUp size={15} /></button>
                      <button onClick={() => moveNode(i, 1)} disabled={i === wf.nodeIds.length - 1} className="p-1 rounded-md disabled:opacity-30" style={{ color: "var(--muted)" }}><ChevronDown size={15} /></button>
                      <button onClick={() => setWf(w => ({ nodeIds: w.nodeIds.filter(n => n !== id), loops: w.loops.filter(l => l.fromId !== id && l.toId !== id) }))} className="p-1 rounded-md ml-1" style={{ color: "#dc2626" }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            {agents.filter(a => !wf.nodeIds.includes(a.id)).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {agents.filter(a => !wf.nodeIds.includes(a.id)).map(a => (
                  <button key={a.id} onClick={() => setWf(w => ({ ...w, nodeIds: [...w.nodeIds, a.id] }))} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "var(--accent-light)", color: "var(--accent)", border: "1px dashed rgba(79,70,229,0.3)" }}><Plus size={11} /> {a.role}</button>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted-light)" }}>Feedback loops</p>
            <div className="space-y-2 mb-4">
              {wf.loops.length === 0 && <p className="text-xs" style={{ color: "var(--muted-light)" }}>No loops configured.</p>}
              {wf.loops.map(loop => {
                const from = agentMap[loop.fromId]; const to = agentMap[loop.toId];
                return (
                  <div key={loop.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
                    <RefreshCw size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {from && <div className="flex items-center gap-1.5"><AgentIcon id={from.id} color={from.color} size={13} /><span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{from.role}</span></div>}
                        <ArrowRight size={12} style={{ color: "var(--muted)" }} />
                        {to && <div className="flex items-center gap-1.5"><AgentIcon id={to.id} color={to.color} size={13} /><span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{to.role}</span></div>}
                        <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>max {loop.maxIterations}×</span>
                      </div>
                      {loop.condition && <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--muted)" }}>when: {loop.condition}</p>}
                    </div>
                    <button onClick={() => setWf(w => ({ ...w, loops: w.loops.filter(l => l.id !== loop.id) }))} className="p-1 rounded-md" style={{ color: "#dc2626" }}><Trash2 size={13} /></button>
                  </div>
                );
              })}
            </div>
            <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--card)", border: "1px dashed var(--card-border)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Add feedback loop</p>
              <div className="flex gap-2 flex-wrap">
                <select className="flex-1 min-w-0 px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "var(--card-border)", background: "var(--background)", color: "var(--foreground)" }} value={newLoop.fromId} onChange={e => setNewLoop(l => ({ ...l, fromId: e.target.value }))}>
                  <option value="">From agent…</option>{wf.nodeIds.map(id => { const a = agentMap[id]; return a ? <option key={id} value={id}>{a.role}</option> : null; })}
                </select>
                <select className="flex-1 min-w-0 px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "var(--card-border)", background: "var(--background)", color: "var(--foreground)" }} value={newLoop.toId} onChange={e => setNewLoop(l => ({ ...l, toId: e.target.value }))}>
                  <option value="">To agent…</option>{wf.nodeIds.map(id => { const a = agentMap[id]; return a ? <option key={id} value={id}>{a.role}</option> : null; })}
                </select>
                <input type="number" min={1} max={10} className="w-20 px-3 py-2 rounded-lg border text-sm outline-none text-center" style={{ borderColor: "var(--card-border)", background: "var(--background)", color: "var(--foreground)" }} value={newLoop.maxIterations} onChange={e => setNewLoop(l => ({ ...l, maxIterations: Number(e.target.value) }))} title="Max iterations" />
              </div>
              <input className="w-full px-3 py-2 rounded-lg border text-sm font-mono outline-none" style={{ borderColor: "var(--card-border)", background: "var(--background)", color: "var(--foreground)" }} placeholder="Condition (e.g. score < 7)" value={newLoop.condition} onChange={e => setNewLoop(l => ({ ...l, condition: e.target.value }))} />
              <button onClick={() => { if (!newLoop.fromId || !newLoop.toId || newLoop.fromId === newLoop.toId) return; setWf(w => ({ ...w, loops: [...w.loops, { id: `loop-${Date.now()}`, ...newLoop }] })); setNewLoop({ fromId: "", toId: "", maxIterations: 2, condition: "" }); }} disabled={!newLoop.fromId || !newLoop.toId || newLoop.fromId === newLoop.toId} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ background: "var(--accent-light)", color: "var(--accent)" }}><Plus size={13} /> Add loop</button>
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-3 px-6 py-4 border-t" style={{ background: "var(--background)", borderColor: "var(--card-border)" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--card)", color: "var(--muted)", border: "1px solid var(--card-border)" }}>Cancel</button>
          <button onClick={() => { onChange(wf); onClose(); }} className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2" style={{ background: "var(--accent)" }}><Save size={14} /> Save workflow</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Save-as-preset modal ───────────────────────────────── */

function SavePresetModal({ onSave, onClose }: {
  onSave: (m: { name: string; tagline: string; icon: string; category: string; description: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [icon, setIcon] = useState("🤖");
  const [category, setCategory] = useState("Engineering");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--card-border)" }}>
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>Save current team as preset</h2>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: "var(--muted)" }}><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#dc2626" }}><AlertCircle size={14} /> {error}</div>}
          <div className="flex gap-3">
            <div><label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Icon</label><input className="w-14 text-center px-2 py-2 rounded-lg border text-xl outline-none" style={{ borderColor: "var(--card-border)", background: "var(--card)" }} value={icon} onChange={e => setIcon(e.target.value)} maxLength={2} /></div>
            <div className="flex-1"><label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Preset name *</label><input className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My Research Team" /></div>
          </div>
          <div><label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Tagline</label><input className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. Research → Verify → Decide" /></div>
          <div><label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Category</label><select className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} value={category} onChange={e => setCategory(e.target.value)}>{["Engineering", "Research", "Finance", "Legal", "Marketing", "Custom"].map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Description</label><textarea className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="What kind of tasks is this preset best for?" /></div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Saves your current <strong>agent roster</strong> and <strong>workflow</strong> as a reusable preset.</p>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "var(--card-border)" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--card)", color: "var(--muted)", border: "1px solid var(--card-border)" }}>Cancel</button>
          <button onClick={() => { if (!name.trim()) { setError("Name is required."); return; } onSave({ name: name.trim(), tagline: tagline.trim(), icon, category, description: description.trim() }); }} className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2" style={{ background: "var(--accent)" }}><Save size={14} /> Save preset</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Preset description fallback ───────────────────────── */

function presetDescription(preset: Preset): string {
  if (preset.description) return preset.description;
  const descs = preset.agents.map(a => a.description).filter(Boolean);
  if (descs.length > 0) return descs.join(" ");
  return preset.agents.map(a => a.role).join(" → ") + " pipeline.";
}

/* ─── Preset card ────────────────────────────────────────── */

function PresetCard({ preset, isActive, onUse, onFork, onDelete }: {
  preset: Preset; isActive: boolean;
  onUse: () => void; onFork: () => void; onDelete?: () => void;
}) {
  const [dc, setDc] = useState(false);
  const cc = preset.categoryColor;
  return (
    <div className="card flex flex-col overflow-hidden" style={{ border: isActive ? `2px solid ${cc}` : "1px solid var(--card-border)" }}>
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${cc}, ${cc}66)` }} />
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${cc}12`, border: `1px solid ${cc}25` }}><PresetIcon category={preset.category} color={cc} size={18} /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{preset.name}</h3>
              {isActive && <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `${cc}15`, color: cc }}><CheckCircle2 size={9} /> Active</span>}
            </div>
            <p className="text-xs font-mono" style={{ color: cc }}>{preset.tagline}</p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: `${cc}12`, color: cc, border: `1px solid ${cc}25` }}>{preset.category}</span>
        </div>
        <p className="text-xs leading-relaxed mb-3 flex-1" style={{ color: "var(--muted)" }}>{presetDescription(preset)}</p>
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {preset.agents.map((a, i) => (
            <div key={a.id} className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${a.color}12`, border: `1px solid ${a.color}25` }} title={a.role}><AgentIcon id={a.id} color={a.color} size={11} /></div>
              {i < preset.agents.length - 1 && <ArrowRight size={9} style={{ color: "var(--muted-light)" }} />}
            </div>
          ))}
          {preset.workflow.loops.length > 0 && <div className="flex items-center gap-1 ml-1"><RefreshCw size={9} style={{ color: "var(--accent)" }} /><span className="text-xs" style={{ color: "var(--muted)" }}>{preset.workflow.loops.length} loop{preset.workflow.loops.length !== 1 ? "s" : ""}</span></div>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onUse} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: cc }}>{isActive ? <><CheckCircle2 size={11} /> Active</> : <><Zap size={11} /> Use preset</>}</button>
          <button onClick={onFork} className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium" style={{ background: "var(--card-border)", color: "var(--muted)" }} title={preset.isBuiltIn ? "Fork to customize" : "Duplicate"}><Copy size={11} /> {preset.isBuiltIn ? "Fork" : "Dupe"}</button>
          {!preset.isBuiltIn && onDelete && (
            dc ? (
              <div className="flex gap-1">
                <button onClick={onDelete} className="px-2 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: "#dc2626" }}>Del</button>
                <button onClick={() => setDc(false)} className="px-2 py-2 rounded-lg text-xs" style={{ color: "var(--muted)" }}>✕</button>
              </div>
            ) : (
              <button onClick={() => setDc(true)} className="p-2 rounded-lg" style={{ color: "var(--muted)" }}><Trash2 size={12} /></button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────── */

type Tab = "presets" | "team";

export default function AgentsPage() {
  const [tab, setTab] = useState<Tab>("presets");

  /* Team state */
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workflow, setWorkflow] = useState<Workflow>(DEFAULT_WORKFLOW);
  const [agentModal, setAgentModal] = useState<{ open: boolean; agent: Agent | null }>({ open: false, agent: null });
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  /* Preset state */
  const [customPresets, setCustomPresets] = useState<Preset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [savePresetOpen, setSavePresetOpen] = useState(false);

  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setAgents(loadAgents());
    setWorkflow(loadWorkflow());
    const local = loadCustomPresets();
    setCustomPresets(local);
    setActivePresetId(loadActivePresetId());
    setMounted(true);
    // Merge API presets (source of truth) into local state
    fetchPresetsFromAPI().then(remote => {
      if (!remote.length) return;
      const builtinIds = new Set(BUILTIN_PRESETS.map(p => p.id));
      const builtinNames = new Set(BUILTIN_PRESETS.map(p => p.name.toLowerCase()));
      const customOnly = [...remote, ...local.filter(p => !remote.find(r => r.id === p.id))]
        .filter(p => !builtinIds.has(p.id) && !builtinNames.has(p.name.toLowerCase()));
      setCustomPresets(customOnly);
      saveCustomPresets(customOnly);
    });
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  /* Team actions */
  const persistAgents = (updated: Agent[]) => { setAgents(updated); saveAgents(updated); };
  const persistWorkflow = (wf: Workflow) => { setWorkflow(wf); saveWorkflow(wf); };

  const handleSaveAgent = (agent: Agent) => {
    const isNew = !agents.find(a => a.id === agent.id);
    const updated = isNew ? [...agents, agent] : agents.map(a => a.id === agent.id ? agent : a);
    persistAgents(updated);
    if (isNew) persistWorkflow({ ...workflow, nodeIds: [...workflow.nodeIds, agent.id] });
    setAgentModal({ open: false, agent: null });
  };

  const handleDeleteAgent = (id: string) => {
    persistAgents(agents.filter(a => a.id !== id));
    persistWorkflow({ nodeIds: workflow.nodeIds.filter(n => n !== id), loops: workflow.loops.filter(l => l.fromId !== id && l.toId !== id) });
    setDeleteConfirm(null);
  };

  /* Preset actions */
  const handleUsePreset = (preset: Preset) => {
    activatePreset(preset);
    setActivePresetId(preset.id);
    setAgents(preset.agents);
    setWorkflow(preset.workflow);
    saveAgents(preset.agents);
    saveWorkflow(preset.workflow);
    showToast(`"${preset.name}" loaded — switch to Team to edit.`);
    setTimeout(() => setTab("team"), 800);
  };

  const handleFork = (preset: Preset) => {
    const forked: Preset = { ...preset, id: `custom-${Date.now()}`, name: `${preset.name} (copy)`, isBuiltIn: false, createdAt: new Date().toISOString() };
    const updated = [forked, ...customPresets];
    setCustomPresets(updated);
    saveCustomPresets(updated);
    upsertPresetToAPI(forked);
    showToast(`Forked "${preset.name}" — find it under Custom.`);
  };

  const handleDeletePreset = (id: string) => {
    const updated = customPresets.filter(p => p.id !== id);
    setCustomPresets(updated);
    saveCustomPresets(updated);
    deletePresetFromAPI(id);
    if (activePresetId === id) setActivePresetId(null);
  };

  const handleSavePreset = (meta: { name: string; tagline: string; icon: string; category: string; description: string }) => {
    const preset: Preset = {
      id: `custom-${Date.now()}`,
      ...meta,
      categoryColor: CATEGORY_COLORS[meta.category] ?? "#64748b",
      agents,
      workflow,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
    };
    const updated = [preset, ...customPresets];
    setCustomPresets(updated);
    saveCustomPresets(updated);
    upsertPresetToAPI(preset);
    setSavePresetOpen(false);
    showToast(`Preset "${preset.name}" saved!`);
  };

  const agentMap = Object.fromEntries(agents.map(a => [a.id, a]));
  const allPresets = [...BUILTIN_PRESETS, ...customPresets];
  const filteredPresets = categoryFilter === "All" ? allPresets
    : categoryFilter === "Custom" ? customPresets
    : allPresets.filter(p => p.category === categoryFilter);

  const activePreset = allPresets.find(p => p.id === activePresetId);

  if (!mounted) return null;

  return (
    <div className="min-h-full grid-bg">

      {/* ── Page header ── */}
      <div className="px-4 sm:px-8 lg:px-10 pt-10 pb-0">
        <div className="max-w-5xl">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-3" style={{ background: "var(--accent-light)", border: "1px solid rgba(79,70,229,0.2)", color: "var(--accent)" }}>
                <Zap size={12} /> Agents & Presets
              </div>
              <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>Agent teams</h1>
              <p className="text-sm mt-1 max-w-xl" style={{ color: "var(--muted)" }}>
                Pick a ready-made specialist team, or build your own from scratch.
                {activePreset && <span> Active: <strong>{activePreset.icon} {activePreset.name}</strong>.</span>}
              </p>
            </div>
            {/* Context-aware action buttons */}
            {tab === "team" ? (
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button onClick={() => setSavePresetOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "var(--card)", color: "var(--muted)", border: "1px solid var(--card-border)" }}><Layers size={14} /> Save as preset</button>
                <button onClick={() => setAgentModal({ open: true, agent: null })} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "var(--accent)", boxShadow: "0 2px 8px rgba(79,70,229,0.25)" }}><Plus size={14} /> New agent</button>
              </div>
            ) : (
              <button onClick={() => setSavePresetOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shrink-0" style={{ background: "var(--accent)", boxShadow: "0 2px 8px rgba(79,70,229,0.25)" }}><Plus size={14} /> Save current as preset</button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b" style={{ borderColor: "var(--card-border)" }}>
            {([
              { id: "presets", label: "Presets", icon: Layers, count: allPresets.length },
              { id: "team", label: "Current team", icon: Bot, count: agents.length },
            ] as const).map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all border-b-2 -mb-px"
                style={{
                  borderColor: tab === id ? "var(--accent)" : "transparent",
                  color: tab === id ? "var(--accent)" : "var(--muted)",
                }}
              >
                <Icon size={15} />
                {label}
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: tab === id ? "var(--accent-light)" : "var(--card-border)", color: tab === id ? "var(--accent)" : "var(--muted)" }}>{count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="px-4 sm:px-8 lg:px-10 py-8">
        <div className="max-w-5xl">

          {/* PRESETS TAB */}
          {tab === "presets" && (
            <div>
              {/* Category filters */}
              <div className="flex items-center gap-2 flex-wrap mb-6">
                {[...CATEGORIES, "Custom"].map(cat => (
                  <button key={cat} onClick={() => setCategoryFilter(cat)} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" style={{ background: categoryFilter === cat ? "var(--accent)" : "var(--card)", color: categoryFilter === cat ? "#fff" : "var(--muted)", border: categoryFilter === cat ? "none" : "1px solid var(--card-border)" }}>
                    {cat}
                    <span className="ml-1.5 opacity-70">{cat === "All" ? allPresets.length : cat === "Custom" ? customPresets.length : allPresets.filter(p => p.category === cat).length}</span>
                  </button>
                ))}
              </div>

              {/* Why presets callout */}
              {categoryFilter === "All" && (
                <div className="rounded-2xl p-5 mb-6" style={{ background: "var(--accent-light)", border: "1px solid rgba(79,70,229,0.15)" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--accent)" }}>Why presets?</p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
                    The core value of multi-agent systems is <strong>role specialization + adversarial review</strong>. Any task that benefits from multiple expert perspectives — where challenge-and-revision produces a better output than one shot — is a valid use case. Multi-agent is structured peer review at AI speed.
                  </p>
                </div>
              )}

              {/* Custom empty state */}
              {categoryFilter === "Custom" && customPresets.length === 0 && (
                <div className="rounded-2xl p-10 text-center" style={{ border: "2px dashed var(--card-border)" }}>
                  <div className="mb-3 flex justify-center"><FolderOpen size={32} style={{ color: "var(--muted-light)" }} /></div>
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>No custom presets yet</p>
                  <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>Fork a built-in preset or configure the Team tab and save it.</p>
                  <button onClick={() => setCategoryFilter("All")} className="text-xs px-3 py-2 rounded-lg font-semibold" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>Browse built-ins</button>
                </div>
              )}

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPresets.map(preset => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    isActive={preset.id === activePresetId}
                    onUse={() => handleUsePreset(preset)}
                    onFork={() => handleFork(preset)}
                    onDelete={!preset.isBuiltIn ? () => handleDeletePreset(preset.id) : undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {/* TEAM TAB */}
          {tab === "team" && (
            <div>
              {/* Model legend */}
              <div className="card p-4 mb-6 flex gap-6 flex-wrap">
                {[{ model: "Claude Opus 4.7", color: "#4f46e5", desc: "Heavy reasoning & code" }, { model: "Claude Sonnet 4.6", color: "#059669", desc: "Fast, cost-efficient" }, { model: "Claude Haiku 4.5", color: "#d97706", desc: "Ultra-fast, lightweight" }].map(m => (
                  <div key={m.model} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{m.model}</span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>— {m.desc}</span>
                  </div>
                ))}
              </div>

              {/* Agent cards */}
              {agents.length === 0 ? (
                <div className="rounded-2xl p-12 text-center" style={{ border: "2px dashed var(--card-border)" }}>
                  <div className="mb-3 flex justify-center"><Bot size={36} style={{ color: "var(--muted-light)" }} /></div>
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>No agents yet</p>
                  <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>Pick a preset from the Presets tab, or create an agent from scratch.</p>
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={() => setTab("presets")} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--accent-light)", color: "var(--accent)" }}><Layers size={14} /> Browse presets</button>
                    <button onClick={() => setAgentModal({ open: true, agent: null })} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--accent)" }}><Plus size={14} /> New agent</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {agents.map(agent => (
                    <div key={agent.id} className="card p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${agent.color}10`, border: `1px solid ${agent.color}25` }}><AgentIcon id={agent.id} color={agent.color} size={22} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>{agent.role}</h2>
                            <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: `${agent.color}10`, color: agent.color }}>{agent.id}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--accent-light)", color: "var(--accent)", border: "1px solid rgba(79,70,229,0.15)" }}>{agent.model}</span>
                            {agent.tools.length > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(2,132,199,0.08)", color: "#0284c7", border: "1px solid rgba(2,132,199,0.15)" }}>{agent.tools.length} tool{agent.tools.length !== 1 ? "s" : ""}</span>}
                          </div>
                          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>{agent.description}</p>
                          {agent.responsibilities.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mb-4">
                              {agent.responsibilities.map(r => (
                                <div key={r} className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: agent.color }} />
                                  <span className="text-xs" style={{ color: "var(--muted)" }}>{r}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {agent.tools.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                              {agent.tools.map(t => <span key={t} className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "var(--card-border)", color: "var(--muted)" }}>{t}()</span>)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => setAgentModal({ open: true, agent })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "var(--card-border)", color: "var(--muted)" }}><Pencil size={12} /> Edit</button>
                          {deleteConfirm === agent.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDeleteAgent(agent.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: "#dc2626" }}>Confirm</button>
                              <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1.5 rounded-lg text-xs" style={{ color: "var(--muted)" }}>Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(agent.id)} className="p-1.5 rounded-lg" style={{ color: "var(--muted)" }}><Trash2 size={14} /></button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Workflow card */}
              <div className="mt-8 card p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-light)" }}>Execution Workflow</p>
                  <button onClick={() => setWorkflowOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "var(--card-border)", color: "var(--muted)" }}><Pencil size={11} /> Edit workflow</button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: "User Goal", color: "#64748b", agentId: null as string | null },
                    ...workflow.nodeIds.map(id => { const a = agentMap[id]; return a ? { label: a.role, color: a.color, agentId: a.id } : null; }).filter(Boolean) as { label: string; color: string; agentId: string }[],
                    { label: "Delivery", color: "#64748b", agentId: null as string | null },
                  ].map((step, i, arr) => (
                    <div key={`${step.label}-${i}`} className="flex items-center gap-2">
                      <div className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5" style={{ background: `${step.color}10`, color: step.color, border: `1px solid ${step.color}25` }}>
                        {step.agentId
                          ? <AgentIcon id={step.agentId} color={step.color} size={11} />
                          : i === 0 ? <MessageCircle size={11} /> : <Package size={11} />}
                        <span>{step.label}</span>
                      </div>
                      {i < arr.length - 1 && <ArrowRight size={14} style={{ color: "var(--muted-light)", flexShrink: 0 }} />}
                    </div>
                  ))}
                </div>
                {workflow.loops.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {workflow.loops.map(loop => {
                      const from = agentMap[loop.fromId]; const to = agentMap[loop.toId];
                      if (!from || !to) return null;
                      return <div key={loop.id} className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}><RefreshCw size={11} style={{ color: "var(--accent)" }} /><span>{from.role} loops back to {to.role}{loop.condition ? ` when ${loop.condition}` : ""} (max {loop.maxIterations}×)</span></div>;
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Modals ── */}
      {agentModal.open && <AgentModal initial={agentModal.agent} existingIds={agents.map(a => a.id)} onSave={handleSaveAgent} onClose={() => setAgentModal({ open: false, agent: null })} />}
      {workflowOpen && <WorkflowEditor workflow={workflow} agents={agents} onChange={persistWorkflow} onClose={() => setWorkflowOpen(false)} />}
      {savePresetOpen && <SavePresetModal onSave={handleSavePreset} onClose={() => setSavePresetOpen(false)} />}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white z-50" style={{ background: "#1e1e2e", maxWidth: "90vw" }}>
          <CheckCircle2 size={15} style={{ color: "#4ade80" }} />
          {toast}
        </div>
      )}
    </div>
  );
}
