import { Server, Globe, Database, Cpu, ArrowRight, Zap, MessageSquare, BarChart3 } from "lucide-react";

const techStack = [
  {
    layer: "Frontend",
    color: "#4f46e5",
    icon: Globe,
    items: [
      { name: "Next.js 15 (App Router)", desc: "Pages, routing, SSR" },
      { name: "TypeScript", desc: "Type-safe components throughout" },
      { name: "Tailwind CSS", desc: "Utility-first styling, CSS variables for theming" },
      { name: "WebSocket Client", desc: "Live agent event stream per task" },
      { name: "Custom Markdown renderer", desc: "Inline bold/italic/code, headings, lists, code blocks" },
    ],
  },
  {
    layer: "Backend",
    color: "#7c3aed",
    icon: Server,
    items: [
      { name: "FastAPI (Python 3.13)", desc: "REST endpoints + WebSocket broadcast server" },
      { name: "LangGraph", desc: "StateGraph agent orchestration with conditional routing" },
      { name: "asyncpg", desc: "Async PostgreSQL driver with connection pooling" },
      { name: "Anthropic SDK", desc: "Async Claude client with tool-use loop" },
      { name: "Pydantic Settings", desc: "Env config, dev-mode model collapse" },
    ],
  },
  {
    layer: "AI Layer",
    color: "#0284c7",
    icon: Cpu,
    items: [
      { name: "Claude Sonnet 4.6", desc: "Primary pipeline agents (reasoning + output)" },
      { name: "Claude Haiku 4.5", desc: "Fast utility calls: MCQ generation, TL;DR summary" },
      { name: "Prompt caching", desc: "Ephemeral cache on system prompts, 5-min TTL" },
      { name: "Tool-use loop", desc: "BaseAgent auto-executes tools until stop_reason ≠ tool_use" },
    ],
  },
  {
    layer: "Persistence",
    color: "#059669",
    icon: Database,
    items: [
      { name: "PostgreSQL (Neon)", desc: "tasks, messages (agent_input/output), subtasks" },
      { name: "Redis (Upstash)", desc: "Agent short-term memory, 500-char rolling context" },
      { name: "File system", desc: "Generated code/artefacts at output/{task_id}/" },
      { name: "In-memory cache", desc: "TL;DR summaries cached per task_id after first gen" },
    ],
  },
];

const pipelines = [
  {
    id: "software-dev",
    label: "Software Development",
    color: "#0284c7",
    agents: ["CEO", "Planner", "Developer", "QA", "Writer"],
    loop: "QA ↺ Developer (max 2 revisions)",
    detail: "Multi-step execution: CEO breaks goal into subtasks, Planner produces detailed steps, Developer executes each step (code tools), QA validates, Writer documents.",
  },
  {
    id: "investment",
    label: "Investment Analysis",
    color: "#059669",
    agents: ["Analyst", "Bear Case", "Data Agent", "Risk Agent", "Synthesizer"],
    loop: "Risk Agent ↺ Analyst (max 2 revisions)",
    detail: "Bull thesis built by Analyst, challenged by Bear Case, data-checked by Data Agent, risk-scored, then synthesized into final report.",
  },
  {
    id: "legal",
    label: "Legal Document Review",
    color: "#64748b",
    agents: ["Reader", "Clause Flagger", "Protection Checker", "Legal Editor"],
    loop: "Protection Checker ↺ Legal Editor (max 2 revisions)",
    detail: "Document is read and summarised, clauses flagged for risk, protections verified, then a full legal memo is drafted.",
  },
  {
    id: "research",
    label: "Research & Intelligence",
    color: "#7c3aed",
    agents: ["Researcher", "Fact Checker", "Devil's Advocate", "Research Editor"],
    loop: "Fact Checker ↺ Researcher (max 2 revisions)",
    detail: "Comprehensive brief built, fact-checked for accuracy, challenged for counterarguments, then synthesized into final research report.",
  },
  {
    id: "content",
    label: "Content & Marketing",
    color: "#ec4899",
    agents: ["Content Writer", "SEO Agent", "Brand Voice", "Content Editor"],
    loop: "Linear pipeline",
    detail: "Draft written, SEO-optimized, brand-voice aligned, then final edited for publish-readiness.",
  },
  {
    id: "academic",
    label: "Academic Literature Review",
    color: "#d97706",
    agents: ["Summarizer", "Critic", "Literature Synthesizer", "Citation Agent"],
    loop: "Critic ↺ Summarizer (max 1 revision)",
    detail: "Topic surveyed from LLM knowledge, critically evaluated for depth/coverage, synthesized into narrative, then full academic review written.",
  },
];

const apiRoutes = [
  { method: "POST", path: "/tasks/", desc: "Create and queue a task; spawns matching LangGraph pipeline" },
  { method: "GET",  path: "/tasks/", desc: "List all tasks (latest 50)" },
  { method: "GET",  path: "/tasks/{id}", desc: "Task detail with all messages and subtasks" },
  { method: "GET",  path: "/tasks/{id}/summary", desc: "LLM-generated TL;DR for completed tasks (Haiku, cached)" },
  { method: "POST", path: "/tasks/questions", desc: "Generate 3 contextual MCQ refinement questions from the goal (Haiku)" },
  { method: "WS",   path: "/ws/{task_id}", desc: "WebSocket stream of agent events for a running task" },
  { method: "GET",  path: "/tasks/{id}/files", desc: "List generated artefact files for a task" },
  { method: "GET",  path: "/tasks/{id}/files/{path}", desc: "Read a generated file (code preview)" },
  { method: "GET",  path: "/presets/", desc: "List custom presets saved to DB" },
  { method: "POST", path: "/presets/", desc: "Save a new custom agent preset" },
  { method: "GET",  path: "/health", desc: "Health check" },
];

export default function ArchitecturePage() {
  return (
    <div className="px-6 sm:px-10 py-10 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--foreground)" }}>Architecture</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          How AgentOS is built — the full stack, agent pipelines, API surface, and request flow.
        </p>
      </div>

      {/* Tech Stack */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--muted-light)" }}>Tech Stack</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {techStack.map(({ layer, color, icon: Icon, items }) => (
            <div key={layer} className="rounded-xl p-5" style={{ border: "1px solid var(--card-border)", background: "var(--card)" }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{layer}</span>
              </div>
              <div className="space-y-2.5">
                {items.map(({ name, desc }) => (
                  <div key={name} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: color }} />
                    <div>
                      <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{name}</span>
                      <span className="text-xs ml-1.5" style={{ color: "var(--muted)" }}>{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Agent Pipelines */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--muted-light)" }}>Agent Pipelines</h2>
        <p className="text-xs mb-5" style={{ color: "var(--muted)" }}>
          Each preset maps to a dedicated LangGraph pipeline. Every agent node saves its full input context and output to the DB as <code className="px-1 rounded text-xs" style={{ background: "var(--card-border)" }}>agent_input</code> / <code className="px-1 rounded text-xs" style={{ background: "var(--card-border)" }}>agent_output</code> messages. QA-style reviewers can loop back up to the revision limit before escalating.
        </p>
        <div className="space-y-3">
          {pipelines.map(({ id, label, color, agents, loop, detail }) => (
            <div key={id} className="rounded-xl p-4" style={{ border: "1px solid var(--card-border)", background: "var(--card)" }}>
              <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                <span className="text-xs font-bold" style={{ color }}>{label}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}>
                  {loop}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                {agents.map((agent, i) => (
                  <div key={agent} className="flex items-center gap-1.5">
                    <span className="text-xs px-2.5 py-1 rounded-lg font-medium" style={{ background: `${color}10`, color, border: `1px solid ${color}20` }}>
                      {agent}
                    </span>
                    {i < agents.length - 1 && <ArrowRight size={11} style={{ color: "var(--muted-light)" }} />}
                  </div>
                ))}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Key System Behaviours */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--muted-light)" }}>Key System Behaviours</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: MessageSquare,
              color: "#4f46e5",
              title: "Context flow tracking",
              desc: "Every agent saves agent_input (what it received from upstream) and agent_output (its full response) to the DB. The pipeline graph UI lets you inspect each agent's exact context and output per revision turn.",
            },
            {
              icon: Zap,
              color: "#0284c7",
              title: "Smart prompt refinement",
              desc: "Before a task is submitted, Claude Haiku generates 3 contextual MCQ questions based on the actual goal text. Answers are appended as structured context. Works for all presets including custom agents.",
            },
            {
              icon: BarChart3,
              color: "#059669",
              title: "Auto TL;DR summary",
              desc: "When any task completes, Claude Haiku reads the final deliverable and key agent outputs to produce a 2-3 sentence plain-English summary. Cached in memory; shown prominently above the pipeline detail.",
            },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="rounded-xl p-4" style={{ border: "1px solid var(--card-border)", background: "var(--card)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                <Icon size={15} style={{ color }} />
              </div>
              <p className="text-xs font-bold mb-1.5" style={{ color: "var(--foreground)" }}>{title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* API Routes */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--muted-light)" }}>API Surface</h2>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
          {apiRoutes.map(({ method, path, desc }, i) => {
            const methodColor: Record<string, string> = { POST: "#4f46e5", GET: "#059669", WS: "#0284c7", PUT: "#d97706", DELETE: "#dc2626" };
            const color = methodColor[method] ?? "#64748b";
            return (
              <div key={path} className="flex items-start gap-3 px-4 py-3" style={{ borderTop: i > 0 ? "1px solid var(--card-border)" : "none", background: "var(--card)" }}>
                <span className="text-xs font-bold shrink-0 w-10 mt-0.5" style={{ color }}>{method}</span>
                <code className="text-xs font-mono shrink-0" style={{ color: "var(--foreground)", minWidth: 260 }}>{path}</code>
                <span className="text-xs" style={{ color: "var(--muted)" }}>{desc}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Request Flow */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--muted-light)" }}>Request Flow</h2>
        <div className="rounded-xl p-5" style={{ border: "1px solid var(--card-border)", background: "var(--card)" }}>
          <div className="space-y-3">
            {[
              { step: "1", text: "User types goal → clicks Run → MCQ modal opens; Haiku generates 3 contextual questions in parallel", color: "#4f46e5" },
              { step: "2", text: "User selects answers (or skips) → answers appended as structured context → POST /tasks/ with enriched goal", color: "#7c3aed" },
              { step: "3", text: "Backend creates DB record, picks matching LangGraph graph by preset_id, spawns it as a background task", color: "#0284c7" },
              { step: "4", text: "Each agent node: saves agent_input → calls Claude → saves agent_output → emits short preview over WebSocket", color: "#059669" },
              { step: "5", text: "QA/reviewer node evaluates output: pass → advance to next step; fail → loop back (max revision limit)", color: "#d97706" },
              { step: "6", text: "Frontend streams live events via WebSocket; filters out WS previews for roles already persisted in DB", color: "#ec4899" },
              { step: "7", text: "On task completion: frontend fetches TL;DR from /tasks/{id}/summary; Haiku summarises in 2-3 sentences, cached", color: "#dc2626" },
              { step: "8", text: "Pipeline graph UI shows each agent as a node; click to inspect full input/output per revision turn", color: "#64748b" },
            ].map(({ step, text, color }) => (
              <div key={step} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white mt-0.5" style={{ background: color }}>
                  {step}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
