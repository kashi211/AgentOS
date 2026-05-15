import { Server, Globe, Database, Cpu, ArrowRight, Zap, MessageSquare, BarChart3, Shield, Radio, XCircle, Brain, HardDrive, GitMerge } from "lucide-react";

const techStack = [
  {
    layer: "Frontend",
    color: "#4f46e5",
    icon: Globe,
    items: [
      { name: "Next.js 15 (App Router)", desc: "Pages, routing, SSR" },
      { name: "TypeScript", desc: "Type-safe components throughout" },
      { name: "Tailwind CSS", desc: "Utility-first styling, CSS variables for theming" },
      { name: "WebSocket Client", desc: "Live agent event stream + streaming token accumulation" },
      { name: "Custom Markdown renderer", desc: "Inline bold/italic/code, headings, lists, code blocks" },
    ],
  },
  {
    layer: "Backend",
    color: "#7c3aed",
    icon: Server,
    items: [
      { name: "FastAPI (Python 3.13)", desc: "REST + WebSocket + SSE; asyncio task registry for cancellation" },
      { name: "LangGraph", desc: "StateGraph orchestration — conditional routing, revision loops, parallel nodes" },
      { name: "asyncpg", desc: "Async PostgreSQL driver with connection pooling" },
      { name: "Anthropic SDK", desc: "Async Claude client with tool-use loop + messages.stream() for real-time tokens" },
      { name: "PyJWT + bcrypt", desc: "Stateless JWT auth (72h tokens, HS256); bcrypt password hashing" },
      { name: "boto3 (S3-compatible)", desc: "Cloudflare R2 artefact storage with local filesystem fallback" },
    ],
  },
  {
    layer: "AI Layer",
    color: "#0284c7",
    icon: Cpu,
    items: [
      { name: "Claude Sonnet 4.6", desc: "Primary pipeline agents (reasoning + long-form output)" },
      { name: "Claude Haiku 4.5", desc: "Fast utility calls: MCQ generation, TL;DR summary" },
      { name: "Streaming tokens", desc: "messages.stream() forwards deltas to WS clients in real-time" },
      { name: "Prompt caching", desc: "Ephemeral cache on system prompts, 5-min TTL" },
      { name: "Tool-use loop", desc: "BaseAgent auto-executes tools until stop_reason ≠ tool_use" },
    ],
  },
  {
    layer: "Persistence & Storage",
    color: "#059669",
    icon: Database,
    items: [
      { name: "PostgreSQL (Neon)", desc: "tasks, messages (agent_input/output), subtasks, users" },
      { name: "Redis (Upstash)", desc: "Agent short-term memory, 500-char rolling context window" },
      { name: "Pinecone", desc: "Long-term semantic memory; multilingual-e5-large embeddings (1024-dim)" },
      { name: "Cloudflare R2", desc: "Generated artefacts via S3-compatible API; public URL per file" },
      { name: "In-memory caches", desc: "TL;DR summaries + streaming callbacks keyed by task_id" },
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
    detail: "CEO breaks goal into subtasks, Planner produces detailed steps, Developer executes with code tools, QA validates, Writer documents.",
  },
  {
    id: "investment",
    label: "Investment Analysis",
    color: "#059669",
    agents: ["Analyst", "Bear Case", "Data Agent", "Risk Agent", "Synthesizer"],
    loop: "Risk Agent ↺ Analyst (max 2 revisions)",
    detail: "Bull thesis by Analyst, challenged by Bear Case, data-checked, risk-scored, then synthesized into final report.",
  },
  {
    id: "legal",
    label: "Legal Document Review",
    color: "#64748b",
    agents: ["Reader", "Clause Flagger", "Protection Checker", "Legal Editor"],
    loop: "Protection Checker ↺ Legal Editor (max 2 revisions)",
    detail: "Document read and summarised, clauses flagged for risk, protections verified, then full legal memo drafted.",
  },
  {
    id: "research",
    label: "Research & Intelligence",
    color: "#7c3aed",
    agents: ["Researcher", "Fact Checker", "Devil's Advocate", "Research Editor"],
    loop: "Fact Checker ↺ Researcher (max 2 revisions)",
    detail: "Comprehensive brief built, fact-checked, challenged for counterarguments, synthesized into final research report.",
  },
  {
    id: "content",
    label: "Content & Marketing",
    color: "#ec4899",
    agents: ["Content Writer", "SEO Agent + Brand Voice", "Content Editor"],
    loop: "SEO + Brand parallel → Editor",
    detail: "Draft written, then SEO Agent and Brand Voice run in parallel via asyncio.gather, final editor incorporates both sets of feedback.",
  },
  {
    id: "academic",
    label: "Academic Literature Review",
    color: "#d97706",
    agents: ["Summarizer", "Critic", "Literature Synthesizer", "Citation Agent"],
    loop: "Critic ↺ Summarizer (max 1 revision)",
    detail: "Topic surveyed, critically evaluated, synthesized into narrative, full academic review with citations written.",
  },
];

const apiRoutes = [
  { method: "POST", path: "/auth/register", desc: "Register a new user (email + bcrypt password hash)" },
  { method: "POST", path: "/auth/login", desc: "Login; returns 72h JWT if credentials valid" },
  { method: "GET",  path: "/auth/me", desc: "Return current user from Bearer token" },
  { method: "POST", path: "/tasks/", desc: "Create and queue a task; optional JWT for per-user isolation" },
  { method: "GET",  path: "/tasks/", desc: "List tasks (filtered by user_id if authenticated)" },
  { method: "GET",  path: "/tasks/{id}", desc: "Task detail with all messages and subtasks" },
  { method: "POST", path: "/tasks/{id}/cancel", desc: "Cancel a running task; kills asyncio task, marks status cancelled" },
  { method: "GET",  path: "/tasks/{id}/summary", desc: "LLM-generated TL;DR for completed tasks (Haiku, cached)" },
  { method: "POST", path: "/tasks/questions", desc: "Generate 3 contextual MCQ refinement questions (Haiku)" },
  { method: "WS",   path: "/ws/{task_id}", desc: "WebSocket: agent events + real-time streaming tokens" },
  { method: "GET",  path: "/tasks/{id}/files", desc: "List artefact files for a task (R2 or local)" },
  { method: "GET",  path: "/tasks/{id}/files/{path}", desc: "Read a generated file (code preview)" },
  { method: "GET",  path: "/presets/", desc: "List custom presets saved to DB" },
  { method: "POST", path: "/presets/", desc: "Save a new custom agent preset" },
  { method: "GET",  path: "/health", desc: "Health check" },
];

const behaviours = [
  {
    icon: Shield,
    color: "#4f46e5",
    title: "JWT user auth",
    desc: "POST /auth/register and /auth/login issue 72h HS256 tokens. All task endpoints accept an optional Bearer header; tasks are scoped to user_id when provided. Backward-compatible — works without a token too.",
  },
  {
    icon: Radio,
    color: "#0284c7",
    title: "Real-time streaming tokens",
    desc: "First agent text turn uses messages.stream() and forwards each delta to a task-scoped callback. The WS server emits {type: 'token'} events; the frontend accumulates them live in AgentDetail as the agent writes.",
  },
  {
    icon: XCircle,
    color: "#dc2626",
    title: "Task cancellation",
    desc: "Every spawned asyncio.Task is stored in a global registry keyed by task_id. POST /tasks/{id}/cancel calls task.cancel(), sets status to 'cancelled', and emits a WS event. Cancel button shown for active tasks in the UI.",
  },
  {
    icon: Brain,
    color: "#7c3aed",
    title: "Long-term semantic memory",
    desc: "After each agent run, output is upserted into Pinecone using multilingual-e5-large (1024-dim, hosted inference). At the start of a new run, the top-3 semantically similar memories across all past tasks are fetched and prepended as context.",
  },
  {
    icon: HardDrive,
    color: "#059669",
    title: "Cloudflare R2 artefact storage",
    desc: "Generated code and documents are written via boto3 to a private R2 bucket with a public URL. Falls back transparently to output/{task_id}/ on disk when R2 env vars are absent — same interface either way.",
  },
  {
    icon: GitMerge,
    color: "#ec4899",
    title: "Agent parallelism",
    desc: "Independent review nodes run concurrently via asyncio.gather. In the Content pipeline, SEO Agent and Brand Voice Agent run in parallel, cutting latency roughly in half. Pattern is reusable across any pipeline.",
  },
  {
    icon: MessageSquare,
    color: "#d97706",
    title: "Context flow tracking",
    desc: "Every agent saves agent_input (exact context from upstream) and agent_output (full response) to the DB. The pipeline graph UI lets you inspect each agent's context and output per revision cycle.",
  },
  {
    icon: Zap,
    color: "#64748b",
    title: "Smart prompt refinement",
    desc: "Before task submission, Haiku generates 3 goal-specific MCQ questions. Answers are appended as structured context. Works for all presets and custom agents.",
  },
  {
    icon: BarChart3,
    color: "#0891b2",
    title: "Auto TL;DR summary",
    desc: "On task completion, Haiku reads the final deliverable and key outputs to produce a 2-3 sentence plain-English summary. Cached in memory; shown as a banner above the pipeline detail.",
  },
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
          Each preset maps to a dedicated LangGraph pipeline. Every agent node saves its full input context and output to the DB as{" "}
          <code className="px-1 rounded text-xs" style={{ background: "var(--card-border)" }}>agent_input</code> /{" "}
          <code className="px-1 rounded text-xs" style={{ background: "var(--card-border)" }}>agent_output</code> messages.
          QA-style reviewers loop back up to the revision limit; independent nodes run in parallel via <code className="px-1 rounded text-xs" style={{ background: "var(--card-border)" }}>asyncio.gather</code>.
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
          {behaviours.map(({ icon: Icon, color, title, desc }) => (
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
                <code className="text-xs font-mono shrink-0" style={{ color: "var(--foreground)", minWidth: 280 }}>{path}</code>
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
              { step: "1", text: "User signs in → JWT stored in localStorage. All subsequent requests include Authorization: Bearer <token>.", color: "#4f46e5" },
              { step: "2", text: "User types goal → clicks Run → MCQ modal opens; Haiku generates 3 contextual questions. User selects answers (or skips).", color: "#7c3aed" },
              { step: "3", text: "Answers appended as structured context → POST /tasks/ with enriched goal + optional user_id from JWT.", color: "#0284c7" },
              { step: "4", text: "Backend creates DB record, picks matching LangGraph graph by preset_id, spawns it as a tracked asyncio.Task (cancellable).", color: "#059669" },
              { step: "5", text: "Before each agent run: top-3 semantically similar Pinecone memories fetched and prepended to context.", color: "#d97706" },
              { step: "6", text: "Each agent node: saves agent_input → streams tokens to WS via messages.stream() → saves agent_output → emits preview event. Independent nodes run via asyncio.gather.", color: "#ec4899" },
              { step: "7", text: "QA/reviewer evaluates: pass → advance; fail → loop back (max revision limit). User can POST /tasks/{id}/cancel at any time to stop.", color: "#dc2626" },
              { step: "8", text: "After each run: agent output and goal upserted into Pinecone for future cross-task retrieval.", color: "#7c3aed" },
              { step: "9", text: "Generated files written to Cloudflare R2 (or local fallback). File list exposed via /tasks/{id}/files.", color: "#059669" },
              { step: "10", text: "On completion: frontend fetches /tasks/{id}/summary; Haiku summarises in 2-3 sentences (cached). Pipeline graph shows every agent's full input/output.", color: "#64748b" },
            ].map(({ step, text, color }) => (
              <div key={step} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white mt-0.5" style={{ background: color, minWidth: 20 }}>
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
