"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Zap, Plus, Pencil, Trash2, X, ChevronUp, ChevronDown,
  ArrowRight, RefreshCw, Save, AlertCircle, Layers, CheckCircle2,
} from "lucide-react";
import {
  BUILTIN_PRESETS, loadCustomPresets, saveCustomPresets,
  loadActivePresetId, activatePreset,
  type Agent, type WorkflowLoop, type Workflow, type Preset,
} from "@/lib/presets";

/* ─── Defaults (from built-in software-dev preset) ─────────── */

const _softwareDev = BUILTIN_PRESETS.find(p => p.id === "software-dev")!;
const DEFAULT_AGENTS: Agent[] = _softwareDev.agents;
const DEFAULT_WORKFLOW: Workflow = _softwareDev.workflow;

const MODELS = ["Claude Opus 4.7", "Claude Sonnet 4.6", "Claude Haiku 4.5"];

/* ─── Storage helpers ─────────────────────────────────────── */

function loadAgents(): Agent[] {
  try {
    const raw = localStorage.getItem("agentos_agents");
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_AGENTS;
}

function saveAgents(agents: Agent[]) {
  localStorage.setItem("agentos_agents", JSON.stringify(agents));
}

function loadWorkflow(): Workflow {
  try {
    const raw = localStorage.getItem("agentos_workflow");
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_WORKFLOW;
}

function saveWorkflow(wf: Workflow) {
  localStorage.setItem("agentos_workflow", JSON.stringify(wf));
}

/* ─── Empty agent template ────────────────────────────────── */

function emptyAgent(): Agent {
  return {
    id: "",
    role: "",
    icon: "🤖",
    color: "#4f46e5",
    model: "Claude Sonnet 4.6",
    description: "",
    responsibilities: [""],
    systemPrompt: "",
    tools: [],
  };
}

/* ─── Agent Modal ─────────────────────────────────────────── */

function AgentModal({
  initial,
  existingIds,
  onSave,
  onClose,
}: {
  initial: Agent | null;
  existingIds: string[];
  onSave: (agent: Agent) => void;
  onClose: () => void;
}) {
  const isNew = initial === null;
  const [form, setForm] = useState<Agent>(initial ?? emptyAgent());
  const [error, setError] = useState("");

  const set = <K extends keyof Agent>(key: K, val: Agent[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const autoId = (role: string) =>
    role.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

  const handleRoleChange = (role: string) => {
    setForm((f) => ({ ...f, role, id: isNew ? autoId(role) : f.id }));
  };

  const handleResp = (i: number, val: string) => {
    const r = [...form.responsibilities];
    r[i] = val;
    set("responsibilities", r);
  };
  const addResp = () => set("responsibilities", [...form.responsibilities, ""]);
  const removeResp = (i: number) =>
    set("responsibilities", form.responsibilities.filter((_, j) => j !== i));

  const handleTool = (i: number, val: string) => {
    const t = [...form.tools];
    t[i] = val;
    set("tools", t);
  };
  const addTool = () => set("tools", [...form.tools, ""]);
  const removeTool = (i: number) =>
    set("tools", form.tools.filter((_, j) => j !== i));

  const handleSubmit = () => {
    if (!form.role.trim()) { setError("Role name is required."); return; }
    if (!form.id.trim()) { setError("Agent ID is required."); return; }
    if (isNew && existingIds.includes(form.id)) {
      setError(`ID "${form.id}" is already in use.`);
      return;
    }
    const cleaned: Agent = {
      ...form,
      role: form.role.trim(),
      id: form.id.trim(),
      responsibilities: form.responsibilities.filter((r) => r.trim()),
      tools: form.tools.filter((t) => t.trim()),
    };
    onSave(cleaned);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}
      >
        {/* Header */}
        <div
          className="sticky top-0 flex items-center justify-between px-6 py-4 border-b"
          style={{ background: "var(--background)", borderColor: "var(--card-border)", zIndex: 1 }}
        >
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
            {isNew ? "Create agent" : `Edit · ${initial!.role}`}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: "var(--muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
              style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#dc2626" }}
            >
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Row: icon + role + id */}
          <div className="flex gap-3">
            <div className="shrink-0">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Icon</label>
              <input
                className="w-14 text-center px-2 py-2 rounded-lg border text-xl outline-none"
                style={{ borderColor: "var(--card-border)", background: "var(--card)" }}
                value={form.icon}
                onChange={(e) => set("icon", e.target.value)}
                maxLength={2}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Role name *</label>
              <input
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }}
                value={form.role}
                onChange={(e) => handleRoleChange(e.target.value)}
                placeholder="e.g. Researcher"
              />
            </div>
            <div className="w-36">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Agent ID *</label>
              <input
                className="w-full px-3 py-2 rounded-lg border text-sm font-mono outline-none"
                style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }}
                value={form.id}
                onChange={(e) => set("id", e.target.value.toLowerCase().replace(/\s/g, "_"))}
                disabled={!isNew}
                placeholder="researcher"
              />
            </div>
          </div>

          {/* Row: model + color */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Model</label>
              <select
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }}
                value={form.model}
                onChange={(e) => set("model", e.target.value)}
              >
                {MODELS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="w-28">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Accent color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-10 h-9 rounded-lg border cursor-pointer"
                  style={{ borderColor: "var(--card-border)" }}
                  value={form.color}
                  onChange={(e) => set("color", e.target.value)}
                />
                <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>{form.color}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Description</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
              style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }}
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What does this agent do?"
            />
          </div>

          {/* Responsibilities */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Responsibilities</label>
              <button
                onClick={addResp}
                className="text-xs px-2 py-1 rounded-md flex items-center gap-1"
                style={{ background: "var(--accent-light)", color: "var(--accent)" }}
              >
                <Plus size={11} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {form.responsibilities.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-1.5 rounded-lg border text-sm outline-none"
                    style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }}
                    value={r}
                    onChange={(e) => handleResp(i, e.target.value)}
                    placeholder={`Responsibility ${i + 1}`}
                  />
                  <button onClick={() => removeResp(i)} className="p-1.5 rounded-lg" style={{ color: "var(--muted)" }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* System prompt */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>System prompt</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border text-sm font-mono outline-none resize-none"
              style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }}
              rows={4}
              value={form.systemPrompt}
              onChange={(e) => set("systemPrompt", e.target.value)}
              placeholder="You are..."
            />
          </div>

          {/* Tools */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Tools</label>
              <button
                onClick={addTool}
                className="text-xs px-2 py-1 rounded-md flex items-center gap-1"
                style={{ background: "var(--accent-light)", color: "var(--accent)" }}
              >
                <Plus size={11} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {form.tools.length === 0 && (
                <p className="text-xs" style={{ color: "var(--muted-light)" }}>No tools — add function names this agent can call.</p>
              )}
              {form.tools.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-1.5 rounded-lg border text-sm font-mono outline-none"
                    style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }}
                    value={t}
                    onChange={(e) => handleTool(i, e.target.value)}
                    placeholder="tool_name"
                  />
                  <button onClick={() => removeTool(i)} className="p-1.5 rounded-lg" style={{ color: "var(--muted)" }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="sticky bottom-0 flex justify-end gap-3 px-6 py-4 border-t"
          style={{ background: "var(--background)", borderColor: "var(--card-border)" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--card)", color: "var(--muted)", border: "1px solid var(--card-border)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
            style={{ background: "var(--accent)" }}
          >
            <Save size={14} /> {isNew ? "Create agent" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Workflow Editor ─────────────────────────────────────── */

function WorkflowEditor({
  workflow,
  agents,
  onChange,
  onClose,
}: {
  workflow: Workflow;
  agents: Agent[];
  onChange: (wf: Workflow) => void;
  onClose: () => void;
}) {
  const [wf, setWf] = useState<Workflow>(JSON.parse(JSON.stringify(workflow)));
  const [newLoop, setNewLoop] = useState({ fromId: "", toId: "", maxIterations: 2, condition: "" });

  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));

  const moveNode = (i: number, dir: -1 | 1) => {
    const ids = [...wf.nodeIds];
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setWf((w) => ({ ...w, nodeIds: ids }));
  };

  const removeNode = (id: string) => {
    setWf((w) => ({
      nodeIds: w.nodeIds.filter((n) => n !== id),
      loops: w.loops.filter((l) => l.fromId !== id && l.toId !== id),
    }));
  };

  const addNode = (id: string) => {
    if (wf.nodeIds.includes(id)) return;
    setWf((w) => ({ ...w, nodeIds: [...w.nodeIds, id] }));
  };

  const removeLoop = (loopId: string) => {
    setWf((w) => ({ ...w, loops: w.loops.filter((l) => l.id !== loopId) }));
  };

  const addLoop = () => {
    if (!newLoop.fromId || !newLoop.toId || newLoop.fromId === newLoop.toId) return;
    const loop: WorkflowLoop = {
      id: `loop-${Date.now()}`,
      fromId: newLoop.fromId,
      toId: newLoop.toId,
      maxIterations: newLoop.maxIterations,
      condition: newLoop.condition,
    };
    setWf((w) => ({ ...w, loops: [...w.loops, loop] }));
    setNewLoop({ fromId: "", toId: "", maxIterations: 2, condition: "" });
  };

  const unusedAgents = agents.filter((a) => !wf.nodeIds.includes(a.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}
      >
        {/* Header */}
        <div
          className="sticky top-0 flex items-center justify-between px-6 py-4 border-b"
          style={{ background: "var(--background)", borderColor: "var(--card-border)", zIndex: 1 }}
        >
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>Edit workflow</h2>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: "var(--muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Node order */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted-light)" }}>
              Execution order
            </p>
            <div className="space-y-2">
              {wf.nodeIds.map((id, i) => {
                const agent = agentMap[id];
                if (!agent) return null;
                return (
                  <div
                    key={id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
                  >
                    <span className="text-lg">{agent.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{agent.role}</p>
                      <p className="text-xs font-mono" style={{ color: "var(--muted)" }}>{agent.id}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveNode(i, -1)}
                        disabled={i === 0}
                        className="p-1 rounded-md disabled:opacity-30"
                        style={{ color: "var(--muted)" }}
                      >
                        <ChevronUp size={15} />
                      </button>
                      <button
                        onClick={() => moveNode(i, 1)}
                        disabled={i === wf.nodeIds.length - 1}
                        className="p-1 rounded-md disabled:opacity-30"
                        style={{ color: "var(--muted)" }}
                      >
                        <ChevronDown size={15} />
                      </button>
                      <button
                        onClick={() => removeNode(id)}
                        className="p-1 rounded-md ml-1"
                        style={{ color: "#dc2626" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add unused agents */}
            {unusedAgents.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {unusedAgents.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => addNode(a.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: "var(--accent-light)", color: "var(--accent)", border: "1px dashed rgba(79,70,229,0.3)" }}
                  >
                    <Plus size={11} /> {a.role}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Loops */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted-light)" }}>
              Feedback loops
            </p>
            <div className="space-y-2 mb-4">
              {wf.loops.length === 0 && (
                <p className="text-xs" style={{ color: "var(--muted-light)" }}>No loops configured.</p>
              )}
              {wf.loops.map((loop) => {
                const from = agentMap[loop.fromId];
                const to = agentMap[loop.toId];
                return (
                  <div
                    key={loop.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
                  >
                    <RefreshCw size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                          {from?.icon} {from?.role}
                        </span>
                        <ArrowRight size={12} style={{ color: "var(--muted)" }} />
                        <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                          {to?.icon} {to?.role}
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-mono"
                          style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                        >
                          max {loop.maxIterations}×
                        </span>
                      </div>
                      {loop.condition && (
                        <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--muted)" }}>
                          when: {loop.condition}
                        </p>
                      )}
                    </div>
                    <button onClick={() => removeLoop(loop.id)} className="p-1 rounded-md" style={{ color: "#dc2626" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add loop form */}
            <div
              className="rounded-xl p-4 space-y-3"
              style={{ background: "var(--card)", border: "1px dashed var(--card-border)" }}
            >
              <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Add feedback loop</p>
              <div className="flex gap-2 flex-wrap">
                <select
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ borderColor: "var(--card-border)", background: "var(--background)", color: "var(--foreground)" }}
                  value={newLoop.fromId}
                  onChange={(e) => setNewLoop((l) => ({ ...l, fromId: e.target.value }))}
                >
                  <option value="">From agent…</option>
                  {wf.nodeIds.map((id) => {
                    const a = agentMap[id];
                    return a ? <option key={id} value={id}>{a.icon} {a.role}</option> : null;
                  })}
                </select>
                <select
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ borderColor: "var(--card-border)", background: "var(--background)", color: "var(--foreground)" }}
                  value={newLoop.toId}
                  onChange={(e) => setNewLoop((l) => ({ ...l, toId: e.target.value }))}
                >
                  <option value="">To agent…</option>
                  {wf.nodeIds.map((id) => {
                    const a = agentMap[id];
                    return a ? <option key={id} value={id}>{a.icon} {a.role}</option> : null;
                  })}
                </select>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="w-20 px-3 py-2 rounded-lg border text-sm outline-none text-center"
                  style={{ borderColor: "var(--card-border)", background: "var(--background)", color: "var(--foreground)" }}
                  value={newLoop.maxIterations}
                  onChange={(e) => setNewLoop((l) => ({ ...l, maxIterations: Number(e.target.value) }))}
                  title="Max iterations"
                />
              </div>
              <input
                className="w-full px-3 py-2 rounded-lg border text-sm font-mono outline-none"
                style={{ borderColor: "var(--card-border)", background: "var(--background)", color: "var(--foreground)" }}
                placeholder="Condition (e.g. score < 7)"
                value={newLoop.condition}
                onChange={(e) => setNewLoop((l) => ({ ...l, condition: e.target.value }))}
              />
              <button
                onClick={addLoop}
                disabled={!newLoop.fromId || !newLoop.toId || newLoop.fromId === newLoop.toId}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background: "var(--accent-light)", color: "var(--accent)" }}
              >
                <Plus size={13} /> Add loop
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="sticky bottom-0 flex justify-end gap-3 px-6 py-4 border-t"
          style={{ background: "var(--background)", borderColor: "var(--card-border)" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--card)", color: "var(--muted)", border: "1px solid var(--card-border)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => { onChange(wf); onClose(); }}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
            style={{ background: "var(--accent)" }}
          >
            <Save size={14} /> Save workflow
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────────── */

/* ─── Save-as-preset mini modal ──────────────────────────── */

const CATEGORY_COLORS_MAP: Record<string, string> = {
  Engineering: "#0284c7", Research: "#7c3aed", Finance: "#059669",
  Legal: "#64748b", Marketing: "#ec4899", Custom: "#64748b",
};

function SavePresetModal({
  onSave,
  onClose,
}: {
  onSave: (meta: { name: string; tagline: string; icon: string; category: string; description: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [icon, setIcon] = useState("🤖");
  const [category, setCategory] = useState("Engineering");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!name.trim()) { setError("Name is required."); return; }
    onSave({ name: name.trim(), tagline: tagline.trim(), icon, category, description: description.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--card-border)" }}>
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>Save current team as preset</h2>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: "var(--muted)" }}><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#dc2626" }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <div className="flex gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Icon</label>
              <input className="w-14 text-center px-2 py-2 rounded-lg border text-xl outline-none" style={{ borderColor: "var(--card-border)", background: "var(--card)" }} value={icon} onChange={e => setIcon(e.target.value)} maxLength={2} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Preset name *</label>
              <input className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My Research Team" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Tagline</label>
            <input className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. Research → Verify → Decide" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Category</label>
              <select className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} value={category} onChange={e => setCategory(e.target.value)}>
                {["Engineering", "Research", "Finance", "Legal", "Marketing", "Custom"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Description</label>
            <textarea className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="What kind of tasks is this preset best for?" />
          </div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>This will save your current {" "}<strong>agent roster</strong> and <strong>workflow</strong> as a reusable preset.</p>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "var(--card-border)" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--card)", color: "var(--muted)", border: "1px solid var(--card-border)" }}>Cancel</button>
          <button onClick={submit} className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2" style={{ background: "var(--accent)" }}><Save size={14} /> Save preset</button>
        </div>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workflow, setWorkflow] = useState<Workflow>(DEFAULT_WORKFLOW);
  const [mounted, setMounted] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [agentModal, setAgentModal] = useState<{ open: boolean; agent: Agent | null }>({ open: false, agent: null });
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    setAgents(loadAgents());
    setWorkflow(loadWorkflow());
    setActivePresetId(loadActivePresetId());
    setMounted(true);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSavePreset = (meta: { name: string; tagline: string; icon: string; category: string; description: string }) => {
    const allCustom = loadCustomPresets();
    const newPreset: Preset = {
      id: `custom-${Date.now()}`,
      ...meta,
      categoryColor: ({ Engineering: "#0284c7", Research: "#7c3aed", Finance: "#059669", Legal: "#64748b", Marketing: "#ec4899" } as Record<string,string>)[meta.category] ?? "#64748b",
      agents,
      workflow,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
    };
    saveCustomPresets([newPreset, ...allCustom]);
    setSavePresetOpen(false);
    showToast(`Preset "${newPreset.name}" saved to the library.`);
  };

  const persistAgents = (updated: Agent[]) => {
    setAgents(updated);
    saveAgents(updated);
  };

  const persistWorkflow = (wf: Workflow) => {
    setWorkflow(wf);
    saveWorkflow(wf);
  };

  const handleSaveAgent = (agent: Agent) => {
    const isNew = !agents.find((a) => a.id === agent.id);
    const updated = isNew
      ? [...agents, agent]
      : agents.map((a) => (a.id === agent.id ? agent : a));
    persistAgents(updated);
    // If new agent, add to end of workflow
    if (isNew) {
      persistWorkflow({ ...workflow, nodeIds: [...workflow.nodeIds, agent.id] });
    }
    setAgentModal({ open: false, agent: null });
  };

  const handleDelete = (id: string) => {
    persistAgents(agents.filter((a) => a.id !== id));
    persistWorkflow({
      nodeIds: workflow.nodeIds.filter((n) => n !== id),
      loops: workflow.loops.filter((l) => l.fromId !== id && l.toId !== id),
    });
    setDeleteConfirm(null);
  };

  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));

  if (!mounted) return null;

  return (
    <div className="min-h-full grid-bg px-4 sm:px-8 lg:px-10 py-12">
      <div className="max-w-4xl">

        {/* Header */}
        <div className="mb-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-4"
              style={{ background: "var(--accent-light)", border: "1px solid rgba(79,70,229,0.2)", color: "var(--accent)" }}
            >
              <Zap size={12} />
              Agent Roster
            </div>
            <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--foreground)" }}>Meet the team</h1>
            <p className="text-base max-w-2xl" style={{ color: "var(--muted)" }}>
              {agents.length} specialized agent{agents.length !== 1 ? "s" : ""} — each with a defined role, model, and toolset.
            </p>
            {/* Active preset badge */}
            {activePresetId && (() => {
              const allPresets = [...BUILTIN_PRESETS, ...loadCustomPresets()];
              const active = allPresets.find(p => p.id === activePresetId);
              if (!active) return null;
              return (
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: `${active.categoryColor}12`, border: `1px solid ${active.categoryColor}25`, color: active.categoryColor }}>
                    <CheckCircle2 size={11} /> {active.icon} {active.name}
                  </div>
                  <Link href="/presets" className="text-xs underline" style={{ color: "var(--muted)" }}>change preset</Link>
                </div>
              );
            })()}
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <button
              onClick={() => setSavePresetOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--card)", color: "var(--muted)", border: "1px solid var(--card-border)" }}
            >
              <Layers size={14} /> Save as preset
            </button>
            <button
              onClick={() => setAgentModal({ open: true, agent: null })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "var(--accent)", boxShadow: "0 2px 8px rgba(79,70,229,0.25)" }}
            >
              <Plus size={15} /> New agent
            </button>
          </div>
        </div>

        {/* Model legend */}
        <div className="card p-4 mb-8 flex gap-6 flex-wrap">
          {[
            { model: "Claude Opus 4.7", color: "#4f46e5", desc: "Heavy reasoning & code" },
            { model: "Claude Sonnet 4.6", color: "#059669", desc: "Fast, cost-efficient tasks" },
            { model: "Claude Haiku 4.5", color: "#d97706", desc: "Ultra-fast, lightweight" },
          ].map((m) => (
            <div key={m.model} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
              <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{m.model}</span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>— {m.desc}</span>
            </div>
          ))}
        </div>

        {/* Agent cards */}
        {agents.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{ border: "2px dashed var(--card-border)" }}
          >
            <div className="text-4xl mb-3">🤖</div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>No agents yet</p>
            <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>Create your first agent to get started.</p>
            <button
              onClick={() => setAgentModal({ open: true, agent: null })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "var(--accent)" }}
            >
              <Plus size={14} /> Create agent
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {agents.map((agent) => (
              <div key={agent.id} className="card p-6">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background: `${agent.color}10`, border: `1px solid ${agent.color}25` }}
                  >
                    {agent.icon}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>{agent.role}</h2>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-mono"
                        style={{ background: `${agent.color}10`, color: agent.color }}
                      >
                        {agent.id}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: "var(--accent-light)", color: "var(--accent)", border: "1px solid rgba(79,70,229,0.15)" }}
                      >
                        {agent.model}
                      </span>
                      {agent.tools.length > 0 && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: "rgba(2,132,199,0.08)", color: "#0284c7", border: "1px solid rgba(2,132,199,0.15)" }}
                        >
                          {agent.tools.length} tool{agent.tools.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>{agent.description}</p>

                    {agent.responsibilities.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mb-4">
                        {agent.responsibilities.map((r) => (
                          <div key={r} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: agent.color }} />
                            <span className="text-xs" style={{ color: "var(--muted)" }}>{r}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {agent.tools.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {agent.tools.map((t) => (
                          <span
                            key={t}
                            className="text-xs px-2 py-0.5 rounded font-mono"
                            style={{ background: "var(--card-border)", color: "var(--muted)" }}
                          >
                            {t}()
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setAgentModal({ open: true, agent })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: "var(--card-border)", color: "var(--muted)" }}
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    {deleteConfirm === agent.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(agent.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                          style={{ background: "#dc2626" }}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-1.5 rounded-lg text-xs"
                          style={{ color: "var(--muted)" }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(agent.id)}
                        className="p-1.5 rounded-lg"
                        style={{ color: "var(--muted)" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Workflow section */}
        <div className="mt-10 card p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-light)" }}>
              Execution Workflow
            </p>
            <button
              onClick={() => setWorkflowOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "var(--card-border)", color: "var(--muted)" }}
            >
              <Pencil size={11} /> Edit workflow
            </button>
          </div>

          {/* Flow nodes */}
          <div className="flex items-center gap-2 flex-wrap">
            {[{ label: "User Goal", color: "#64748b", icon: "💬" }, ...workflow.nodeIds.map((id) => {
              const a = agentMap[id];
              return a ? { label: a.role, color: a.color, icon: a.icon } : null;
            }).filter(Boolean) as { label: string; color: string; icon: string }[], { label: "Delivery", color: "#64748b", icon: "📦" }].map(
              (step, i, arr) => (
                <div key={`${step.label}-${i}`} className="flex items-center gap-2">
                  <div
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    style={{ background: `${step.color}10`, color: step.color, border: `1px solid ${step.color}25` }}
                  >
                    <span>{step.icon}</span>
                    <span>{step.label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <ArrowRight size={14} style={{ color: "var(--muted-light)", flexShrink: 0 }} />
                  )}
                </div>
              )
            )}
          </div>

          {/* Loops summary */}
          {workflow.loops.length > 0 && (
            <div className="mt-4 space-y-2">
              {workflow.loops.map((loop) => {
                const from = agentMap[loop.fromId];
                const to = agentMap[loop.toId];
                if (!from || !to) return null;
                return (
                  <div key={loop.id} className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
                    <RefreshCw size={11} style={{ color: "var(--accent)" }} />
                    <span>
                      {from.icon} {from.role} loops back to {to.icon} {to.role}
                      {loop.condition ? ` when ${loop.condition}` : ""}
                      {" "}(max {loop.maxIterations}×)
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {agentModal.open && (
        <AgentModal
          initial={agentModal.agent}
          existingIds={agents.map((a) => a.id)}
          onSave={handleSaveAgent}
          onClose={() => setAgentModal({ open: false, agent: null })}
        />
      )}

      {workflowOpen && (
        <WorkflowEditor
          workflow={workflow}
          agents={agents}
          onChange={persistWorkflow}
          onClose={() => setWorkflowOpen(false)}
        />
      )}

      {/* Save as preset modal */}
      {savePresetOpen && (
        <SavePresetModal onSave={handleSavePreset} onClose={() => setSavePresetOpen(false)} />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white z-50" style={{ background: "#1e1e2e", maxWidth: "90vw" }}>
          <CheckCircle2 size={15} style={{ color: "#4ade80" }} />
          {toast}
        </div>
      )}
    </div>
  );
}
