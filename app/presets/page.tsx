"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Layers, Plus, Zap, X, Save, Pencil, Trash2, Copy,
  CheckCircle2, ArrowRight, RefreshCw, AlertCircle,
} from "lucide-react";
import {
  BUILTIN_PRESETS, loadCustomPresets, saveCustomPresets,
  activatePreset, loadActivePresetId,
  type Preset,
} from "@/lib/presets";

const CATEGORIES = ["All", "Engineering", "Research", "Finance", "Legal", "Marketing"];

const CATEGORY_COLORS: Record<string, string> = {
  Engineering: "#0284c7",
  Research: "#7c3aed",
  Finance: "#059669",
  Legal: "#64748b",
  Marketing: "#ec4899",
};

/* ─── Save-as-preset modal ────────────────────────────────── */

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
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>Save as preset</h2>
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
              <input className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Due Diligence Team" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Tagline</label>
            <input className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. Research → Verify → Decide" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Category</label>
            <select className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
              <option value="Custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>Description</label>
            <textarea className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none" style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--foreground)" }} rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="What kind of tasks is this preset best for?" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "var(--card-border)" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--card)", color: "var(--muted)", border: "1px solid var(--card-border)" }}>Cancel</button>
          <button onClick={submit} className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2" style={{ background: "var(--accent)" }}><Save size={14} /> Save preset</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Preset card ─────────────────────────────────────────── */

function PresetCard({
  preset,
  isActive,
  onUse,
  onFork,
  onDelete,
}: {
  preset: Preset;
  isActive: boolean;
  onUse: () => void;
  onFork: () => void;
  onDelete?: () => void;
}) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const cc = preset.categoryColor;

  return (
    <div
      className="card flex flex-col overflow-hidden transition-all"
      style={{ border: isActive ? `2px solid ${cc}` : "1px solid var(--card-border)" }}
    >
      {/* Colored top strip */}
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${cc}, ${cc}88)` }} />

      <div className="p-5 flex-1 flex flex-col">
        {/* Top row */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: `${cc}12`, border: `1px solid ${cc}25` }}>
            {preset.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h3 className="text-sm font-bold leading-snug" style={{ color: "var(--foreground)" }}>{preset.name}</h3>
              {isActive && (
                <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `${cc}15`, color: cc }}>
                  <CheckCircle2 size={10} /> Active
                </span>
              )}
            </div>
            <p className="text-xs font-mono" style={{ color: cc }}>{preset.tagline}</p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: `${cc}12`, color: cc, border: `1px solid ${cc}25` }}>
            {preset.category}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs leading-relaxed mb-4 flex-1" style={{ color: "var(--muted)" }}>
          {preset.description}
        </p>

        {/* Agent avatars */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {preset.agents.map((a, i) => (
            <div key={a.id} className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs" style={{ background: `${a.color}12`, border: `1px solid ${a.color}25` }} title={a.role}>
                {a.icon}
              </div>
              {i < preset.agents.length - 1 && <ArrowRight size={10} style={{ color: "var(--muted-light)" }} />}
            </div>
          ))}
          {preset.workflow.loops.length > 0 && (
            <div className="flex items-center gap-1 ml-1">
              <RefreshCw size={10} style={{ color: "var(--accent)" }} />
              <span className="text-xs" style={{ color: "var(--muted)" }}>{preset.workflow.loops.length} loop{preset.workflow.loops.length !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mb-4 text-xs" style={{ color: "var(--muted)" }}>
          <span>{preset.agents.length} agents</span>
          <span>·</span>
          <span>{preset.agents.filter(a => a.tools.length > 0).length} with tools</span>
          {!preset.isBuiltIn && preset.createdAt && (
            <>
              <span>·</span>
              <span>Custom</span>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onUse}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ background: isActive ? `${cc}cc` : cc, boxShadow: `0 2px 8px ${cc}35` }}
          >
            {isActive ? <><CheckCircle2 size={13} /> Active</> : <><Zap size={13} /> Use preset</>}
          </button>
          <button
            onClick={onFork}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: "var(--card-border)", color: "var(--muted)" }}
            title={preset.isBuiltIn ? "Fork to customize" : "Duplicate"}
          >
            <Copy size={12} /> {preset.isBuiltIn ? "Fork" : "Duplicate"}
          </button>
          {!preset.isBuiltIn && onDelete && (
            deleteConfirm ? (
              <div className="flex gap-1">
                <button onClick={onDelete} className="px-2 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: "#dc2626" }}>Delete</button>
                <button onClick={() => setDeleteConfirm(false)} className="px-2 py-2 rounded-lg text-xs" style={{ color: "var(--muted)" }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setDeleteConfirm(true)} className="p-2 rounded-lg" style={{ color: "var(--muted)" }}>
                <Trash2 size={13} />
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────────── */

export default function PresetsPage() {
  const router = useRouter();
  const [customPresets, setCustomPresets] = useState<Preset[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [mounted, setMounted] = useState(false);
  const [saveModal, setSaveModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setCustomPresets(loadCustomPresets());
    setActiveId(loadActivePresetId());
    setMounted(true);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleUse = (preset: Preset) => {
    activatePreset(preset);
    setActiveId(preset.id);
    showToast(`"${preset.name}" is now active — your agents page reflects this team.`);
  };

  const handleFork = (preset: Preset) => {
    // Load current agents/workflow from the preset being forked
    const now = new Date().toISOString();
    const forked: Preset = {
      ...preset,
      id: `custom-${Date.now()}`,
      name: `${preset.name} (copy)`,
      isBuiltIn: false,
      createdAt: now,
    };
    const updated = [forked, ...customPresets];
    setCustomPresets(updated);
    saveCustomPresets(updated);
    showToast(`Forked "${preset.name}" — find it under Custom.`);
  };

  const handleDelete = (id: string) => {
    const updated = customPresets.filter(p => p.id !== id);
    setCustomPresets(updated);
    saveCustomPresets(updated);
    if (activeId === id) setActiveId(null);
  };

  const handleSaveNew = (meta: { name: string; tagline: string; icon: string; category: string; description: string }) => {
    // Grab current agents + workflow from localStorage
    let agents: Preset["agents"] = [];
    let workflow: Preset["workflow"] = { nodeIds: [], loops: [] };
    try {
      const rawA = localStorage.getItem("agentos_agents");
      const rawW = localStorage.getItem("agentos_workflow");
      if (rawA) agents = JSON.parse(rawA);
      if (rawW) workflow = JSON.parse(rawW);
    } catch {}

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
    setSaveModal(false);
    showToast(`Preset "${preset.name}" saved!`);
  };

  const allPresets = [...BUILTIN_PRESETS, ...customPresets];
  const filtered = filter === "All"
    ? allPresets
    : filter === "Custom"
    ? customPresets
    : allPresets.filter(p => p.category === filter);

  if (!mounted) return null;

  return (
    <div className="min-h-full grid-bg px-4 sm:px-8 lg:px-10 py-12">
      <div className="max-w-5xl">

        {/* Header */}
        <div className="mb-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-4" style={{ background: "var(--accent-light)", border: "1px solid rgba(79,70,229,0.2)", color: "var(--accent)" }}>
              <Layers size={12} /> Preset Library
            </div>
            <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--foreground)" }}>Agent presets</h1>
            <p className="text-base max-w-2xl" style={{ color: "var(--muted)" }}>
              Ready-made specialist teams for any complex task. Pick a preset, hit run — or fork one and make it yours.
            </p>
          </div>
          <button
            onClick={() => setSaveModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shrink-0"
            style={{ background: "var(--accent)", boxShadow: "0 2px 8px rgba(79,70,229,0.25)" }}
          >
            <Plus size={15} /> Save current as preset
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 flex-wrap mb-8">
          {[...CATEGORIES, "Custom"].map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: filter === cat ? "var(--accent)" : "var(--card)",
                color: filter === cat ? "#fff" : "var(--muted)",
                border: filter === cat ? "none" : "1px solid var(--card-border)",
              }}
            >
              {cat}
              <span className="ml-1.5 opacity-60 text-xs">
                {cat === "All" ? allPresets.length
                  : cat === "Custom" ? customPresets.length
                  : allPresets.filter(p => p.category === cat).length}
              </span>
            </button>
          ))}
        </div>

        {/* Use case explainer */}
        {filter === "All" && (
          <div
            className="rounded-2xl p-5 mb-8"
            style={{ background: "var(--accent-light)", border: "1px solid rgba(79,70,229,0.15)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--accent)" }}>Why presets?</p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
              The core value of multi-agent systems is <strong>role specialization + adversarial review</strong> applied to any complex task.
              Any problem that benefits from multiple expert perspectives — where challenge-and-revision produces a better output than one shot at it — is a valid use case.
              Multi-agent is structured peer review at AI speed.
            </p>
          </div>
        )}

        {/* Empty custom state */}
        {filter === "Custom" && customPresets.length === 0 && (
          <div className="rounded-2xl p-12 text-center" style={{ border: "2px dashed var(--card-border)" }}>
            <div className="text-4xl mb-3">🗂️</div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>No custom presets yet</p>
            <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>Configure agents on the Agents page, then save them as a preset — or fork one of the built-in presets below.</p>
            <button onClick={() => { setFilter("All"); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
              Browse built-in presets
            </button>
          </div>
        )}

        {/* Preset grid */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map(preset => (
              <PresetCard
                key={preset.id}
                preset={preset}
                isActive={preset.id === activeId}
                onUse={() => handleUse(preset)}
                onFork={() => handleFork(preset)}
                onDelete={!preset.isBuiltIn ? () => handleDelete(preset.id) : undefined}
              />
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-12 card p-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>Build a custom team</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Go to the Agents page to add, edit, and configure your own agent roster — then save it as a preset.</p>
          </div>
          <button
            onClick={() => router.push("/agents")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shrink-0"
            style={{ background: "var(--accent)" }}
          >
            Open Agents <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Save modal */}
      {saveModal && <SavePresetModal onSave={handleSaveNew} onClose={() => setSaveModal(false)} />}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white z-50"
          style={{ background: "#1e1e2e", maxWidth: "90vw" }}
        >
          <CheckCircle2 size={15} style={{ color: "#4ade80" }} />
          {toast}
        </div>
      )}
    </div>
  );
}
