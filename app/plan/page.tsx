import { CheckCircle2, Circle, Clock, Zap, AlertCircle } from "lucide-react";

type Status = "done" | "active" | "todo" | "stretch";

interface Task {
  name: string;
  status: Status;
  detail?: string;
}

interface Phase {
  phase: number;
  title: string;
  subtitle: string;
  color: string;
  status: Status;
  est: string;
  tasks: Task[];
}

const phases: Phase[] = [
  {
    phase: 1,
    title: "Foundation",
    subtitle: "Project setup, dev environment, repo structure",
    color: "#4f46e5",
    status: "active",
    est: "Week 1",
    tasks: [
      { name: "Scaffold Next.js 15 + TypeScript + Tailwind v4", status: "done" },
      { name: "Install Vercel AI SDK, Anthropic SDK, lucide-react", status: "done" },
      { name: "Global layout, sidebar navigation, light theme", status: "done" },
      { name: "Architecture page with system diagram", status: "done" },
      { name: "Dev Plan page (this page)", status: "done" },
      { name: "Scaffold FastAPI project with folder structure", status: "active", detail: "main.py, /agents, /models, /routes, /db" },
      { name: "PostgreSQL schema: agents, tasks, messages, memory", status: "todo" },
      { name: "Basic FastAPI health + CORS + WebSocket endpoint", status: "todo" },
      { name: "Dockerize FastAPI for local dev", status: "todo" },
    ],
  },
  {
    phase: 2,
    title: "Agent Engine",
    subtitle: "Core multi-agent system with LangGraph and memory",
    color: "#7c3aed",
    status: "todo",
    est: "Week 2–3",
    tasks: [
      { name: "BaseAgent class with system prompt, memory, tool registry", status: "todo" },
      { name: "CEO Agent: goal intake, task breakdown, delegation", status: "todo" },
      { name: "Planner Agent: structured subtask graph with LangGraph", status: "todo" },
      { name: "Developer Agent: Claude Opus 4.7 tool use + code output", status: "todo" },
      { name: "QA Agent: review outputs, return structured pass/fail", status: "todo" },
      { name: "Writer Agent: README, docs, report generation", status: "todo" },
      { name: "Agent memory: Redis short-term + PostgreSQL long-term", status: "todo" },
      { name: "Pinecone vector store for semantic memory recall", status: "todo" },
      { name: "Inter-agent message bus (async queue via LangGraph state)", status: "todo" },
    ],
  },
  {
    phase: 3,
    title: "Task Orchestration",
    subtitle: "Full lifecycle management from goal → delivery",
    color: "#0284c7",
    status: "todo",
    est: "Week 3–4",
    tasks: [
      { name: "LangGraph DAG: build directed graph per task", status: "todo" },
      { name: "Task state machine: pending → in_progress → review → done", status: "todo" },
      { name: "Validation loop: QA rejection sends task back to agent", status: "todo" },
      { name: "Retry with failure context injected into next attempt", status: "todo" },
      { name: "Iteration cap (max N revisions before escalate to CEO)", status: "todo" },
      { name: "Artifact collector: save generated files to Cloudflare R2", status: "todo" },
      { name: "POST /task endpoint wired to orchestrator", status: "todo" },
      { name: "GET /task/:id endpoint for status polling fallback", status: "todo" },
    ],
  },
  {
    phase: 4,
    title: "Real-Time UI",
    subtitle: "Live agent feed, task dashboard, streaming output",
    color: "#059669",
    status: "todo",
    est: "Week 4–5",
    tasks: [
      { name: "WebSocket event schema: agent_start, tool_call, message, done", status: "todo" },
      { name: "FastAPI WebSocket broadcasts orchestrator events", status: "todo" },
      { name: "Next.js useWebSocket hook consuming live events", status: "todo" },
      { name: "Agent feed component: scrolling log with icons per agent", status: "todo" },
      { name: "Task dashboard: status cards, progress bar, timeline", status: "todo" },
      { name: "Agent creation UI: name, role, system prompt, model", status: "todo" },
      { name: "Task submission form: goal input, agent selection", status: "todo" },
      { name: "Vercel AI SDK useChat for user ↔ CEO conversation", status: "todo" },
    ],
  },
  {
    phase: 5,
    title: "Polish & Deploy",
    subtitle: "Demo quality, docs, deployment",
    color: "#d97706",
    status: "todo",
    est: "Week 5–6",
    tasks: [
      { name: "Seed database with demo task + replay mode", status: "todo", detail: "Let visitors see agents run without an API key" },
      { name: "Responsive mobile layout", status: "todo" },
      { name: "Error states, loading skeletons, empty states", status: "todo" },
      { name: "Deploy FastAPI to Railway", status: "todo" },
      { name: "Deploy Next.js to Vercel", status: "todo" },
      { name: "README with architecture diagram, setup instructions", status: "done" },
      { name: "Portfolio write-up: decisions, challenges, learnings", status: "todo" },
      { name: "Video demo / screen recording", status: "todo" },
    ],
  },
  {
    phase: 6,
    title: "Stretch Goals",
    subtitle: "Nice-to-haves if time permits",
    color: "#94a3b8",
    status: "stretch",
    est: "Post-launch",
    tasks: [
      { name: "pgvector on Neon for embedded semantic memory", status: "stretch" },
      { name: "Tool use: agents can browse web, run sandboxed code, read files", status: "stretch" },
      { name: "User auth (NextAuth.js) + per-user agent sandboxes", status: "stretch" },
      { name: "Cost tracker: show $ spent per task per agent", status: "stretch" },
      { name: "Export task results as PDF / ZIP artefacts", status: "stretch" },
      { name: "Multi-provider routing: Claude Opus 4.7 for reasoning, Sonnet 4.6 for speed", status: "stretch" },
    ],
  },
];

const statusConfig: Record<Status, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  done: { label: "Done", color: "#059669", icon: CheckCircle2 },
  active: { label: "In Progress", color: "#4f46e5", icon: Clock },
  todo: { label: "Todo", color: "#94a3b8", icon: Circle },
  stretch: { label: "Stretch", color: "#94a3b8", icon: AlertCircle },
};

function StatusBadge({ status }: { status: Status }) {
  const cfg = statusConfig[status];
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: `${cfg.color}12`, color: cfg.color, border: `1px solid ${cfg.color}25` }}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

export default function PlanPage() {
  const totalTasks = phases.flatMap((p) => p.tasks).length;
  const doneTasks = phases.flatMap((p) => p.tasks).filter((t) => t.status === "done").length;
  const activeTasks = phases.flatMap((p) => p.tasks).filter((t) => t.status === "active").length;

  return (
    <div className="min-h-full grid-bg px-10 py-12">
      <div className="max-w-4xl">

        {/* Header */}
        <div className="mb-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-4"
            style={{
              background: "var(--accent-light)",
              border: "1px solid rgba(79,70,229,0.2)",
              color: "var(--accent)",
            }}
          >
            <Zap size={12} />
            Development Roadmap
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--foreground)" }}>Build Plan</h1>
          <p className="text-base max-w-2xl" style={{ color: "var(--muted)" }}>
            6 phased milestones from scaffolding to a fully deployed portfolio project.
            Phases 1–5 represent the MVP; Phase 6 is stretch goals post-launch.
          </p>
        </div>

        {/* Progress summary */}
        <div className="card p-5 mb-10">
          <div className="flex items-center gap-8 mb-4">
            <div>
              <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{doneTasks}/{totalTasks}</div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>tasks complete</div>
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: "var(--accent)" }}>{activeTasks}</div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>in progress</div>
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: "#d97706" }}>
                {phases.filter((p) => p.status === "todo").length}
              </div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>phases remaining</div>
            </div>
          </div>

          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--card-border)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.round((doneTasks / totalTasks) * 100)}%`,
                background: "linear-gradient(90deg, #4f46e5, #7c3aed)",
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {Math.round((doneTasks / totalTasks) * 100)}% complete
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>~6 weeks total</span>
          </div>
        </div>

        {/* Phase timeline */}
        <div className="space-y-6">
          {phases.map((p, phaseIdx) => {
            const phaseDone = p.tasks.filter((t) => t.status === "done").length;
            const isStretch = p.status === "stretch";
            return (
              <div key={p.phase} className="flex gap-5">
                {/* Left: phase indicator */}
                <div className="flex flex-col items-center gap-0 shrink-0" style={{ width: "32px" }}>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                      background: isStretch ? "rgba(148,163,184,0.12)" : `${p.color}12`,
                      border: `2px solid ${isStretch ? "rgba(148,163,184,0.3)" : p.color}`,
                      color: isStretch ? "#94a3b8" : p.color,
                    }}
                  >
                    {p.phase}
                  </div>
                  {phaseIdx < phases.length - 1 && (
                    <div className="flex-1 w-px mt-1" style={{ background: "var(--card-border)", minHeight: "20px" }} />
                  )}
                </div>

                {/* Right: content */}
                <div className="flex-1 pb-2">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>{p.title}</h2>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>{p.subtitle}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{p.est}</div>
                      <div className="text-xs" style={{ color: "var(--muted)" }}>
                        {phaseDone}/{p.tasks.length} done
                      </div>
                    </div>
                  </div>

                  {!isStretch && (
                    <div className="w-full h-1 rounded-full overflow-hidden mb-3 mt-2" style={{ background: "var(--card-border)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${p.tasks.length > 0 ? Math.round((phaseDone / p.tasks.length) * 100) : 0}%`,
                          background: p.color,
                        }}
                      />
                    </div>
                  )}

                  <div className="card mt-2 divide-y" style={{ borderColor: "var(--card-border)" }}>
                    {p.tasks.map((task, i) => {
                      const cfg = statusConfig[task.status];
                      const Icon = cfg.icon;
                      return (
                        <div key={i} className="flex items-start gap-3 px-4 py-3">
                          <Icon
                            size={15}
                            className="shrink-0 mt-0.5"
                            style={{ color: task.status === "done" ? "#059669" : task.status === "active" ? p.color : "var(--muted-light)" }}
                          />
                          <div className="flex-1 min-w-0">
                            <span
                              className="text-sm"
                              style={{
                                color: task.status === "done" ? "var(--muted)" : "var(--foreground)",
                                textDecoration: task.status === "done" ? "line-through" : "none",
                              }}
                            >
                              {task.name}
                            </span>
                            {task.detail && (
                              <div className="text-xs mt-0.5 font-mono" style={{ color: "var(--muted)" }}>
                                {task.detail}
                              </div>
                            )}
                          </div>
                          {task.status === "active" && (
                            <div className="w-2 h-2 rounded-full pulse-dot shrink-0 mt-1.5" style={{ background: p.color }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer notes */}
        <div
          className="mt-12 rounded-xl p-5"
          style={{
            background: "var(--accent-light)",
            border: "1px solid rgba(79,70,229,0.15)",
          }}
        >
          <h3 className="text-sm font-bold mb-3" style={{ color: "var(--foreground)" }}>Engineering Principles</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "API-first", body: "Backend contracts defined before UI is built. OpenAPI spec maintained throughout." },
              { label: "Type-safe", body: "TypeScript on the frontend, Pydantic v2 on the backend. No implicit any." },
              { label: "Fail loudly", body: "Agent errors are surfaced in the UI, not silently swallowed. Every failure has a visible trace." },
              { label: "Provider-agnostic", body: "Model routing is a config change. Claude Opus 4.7, Sonnet 4.6, and o3 are hot-swappable per agent." },
            ].map(({ label, body }) => (
              <div key={label}>
                <div className="text-xs font-bold mb-1" style={{ color: "var(--accent)" }}>{label}</div>
                <div className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
