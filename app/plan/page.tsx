import { CheckCircle2, Circle, Zap } from "lucide-react";

type Status = "done" | "active" | "todo";

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
  tasks: Task[];
}

const phases: Phase[] = [
  {
    phase: 1,
    title: "Foundation",
    subtitle: "Project setup, routing, UI shell",
    color: "#4f46e5",
    status: "done",
    tasks: [
      { name: "Next.js 14 App Router + TypeScript + Tailwind", status: "done" },
      { name: "Global layout, sidebar navigation, light theme", status: "done" },
      { name: "FastAPI backend with health + CORS + WebSocket", status: "done" },
      { name: "PostgreSQL schema: tasks, messages, subtasks, memory", status: "done" },
      { name: "Architecture + Dev Plan pages", status: "done" },
    ],
  },
  {
    phase: 2,
    title: "Agent Engine",
    subtitle: "Core multi-agent system with LangGraph",
    color: "#7c3aed",
    status: "done",
    tasks: [
      { name: "BaseAgent class: system prompt, tool use loop, memory", status: "done" },
      { name: "Software dev pipeline: CEO → Planner → Developer → QA → Writer", status: "done" },
      { name: "LangGraph StateGraph orchestration with conditional routing", status: "done" },
      { name: "QA feedback loops with max revision limits", status: "done" },
      { name: "Redis short-term memory (graceful fallback if unavailable)", status: "done" },
      { name: "File output per task (read_file / write_file tools)", status: "done" },
    ],
  },
  {
    phase: 3,
    title: "Preset Pipelines",
    subtitle: "Dedicated graphs for all 6 specialist teams",
    color: "#0284c7",
    status: "done",
    tasks: [
      { name: "Investment analysis: Analyst → Bear Case → Synthesizer → Risk Agent", status: "done" },
      { name: "Legal review: Reader → Clause Flagger → Legal Editor → Protection Checker", status: "done" },
      { name: "Research & Intelligence: Researcher → Fact Checker → Devil's Advocate → Editor", status: "done" },
      { name: "Content & Marketing: Writer → SEO → Brand Voice → Editor", status: "done" },
      { name: "Academic review: Summarizer → Critic → Synthesizer → Citation Agent", status: "done" },
      { name: "Preset routing by preset_id in POST /tasks/", status: "done" },
    ],
  },
  {
    phase: 4,
    title: "Projects UI",
    subtitle: "Live task feed, preset selector, delivery panel",
    color: "#059669",
    status: "done",
    tasks: [
      { name: "Projects page with preset selector tabs", status: "done" },
      { name: "Live agent feed via WebSocket events", status: "done" },
      { name: "Task sidebar with status, show more/less", status: "done" },
      { name: "Delivery panel with QA report tab", status: "done" },
      { name: "App preview iframe for software-dev output", status: "done" },
      { name: "Orphaned task reset on backend startup", status: "done" },
    ],
  },
  {
    phase: 5,
    title: "Agents UI",
    subtitle: "Preset library, team editor, workflow builder",
    color: "#d97706",
    status: "done",
    tasks: [
      { name: "6 built-in presets with agent rosters and workflows", status: "done" },
      { name: "Agent CRUD: add, edit, delete agents with custom prompts", status: "done" },
      { name: "Workflow editor with loop configuration", status: "done" },
      { name: "Save current team as custom preset, fork built-ins", status: "done" },
      { name: "Preset activation persisted to localStorage", status: "done" },
    ],
  },
  {
    phase: 6,
    title: "Production & Polish",
    subtitle: "Deployment, reliability, multi-tenancy",
    color: "#64748b",
    status: "active",
    tasks: [
      { name: "Vercel deployment with ESLint clean build", status: "done" },
      { name: "CORS fix for all localhost ports (allow_origin_regex)", status: "done" },
      { name: "env_ignore_empty so .env key always loads correctly", status: "done" },
      { name: "User auth + per-user task isolation", status: "todo" },
      { name: "Streaming token output (real-time text as agents write)", status: "todo" },
      { name: "Task cancellation", status: "todo" },
      { name: "Pinecone long-term semantic memory", status: "todo" },
      { name: "Cloudflare R2 artefact storage", status: "todo" },
    ],
  },
];

const statusIcon = (s: Status) => {
  if (s === "done") return <CheckCircle2 size={13} style={{ color: "#059669" }} />;
  if (s === "active") return <Zap size={13} style={{ color: "#d97706" }} />;
  return <Circle size={13} style={{ color: "var(--muted-light)" }} />;
};

export default function PlanPage() {
  const done = phases.filter(p => p.status === "done").length;
  const total = phases.length;

  return (
    <div className="px-6 sm:px-10 py-10 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--foreground)" }}>Dev Plan</h1>
        <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
          What has been built and what is still ahead.
        </p>
        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--card-border)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(done / total) * 100}%`, background: "#059669" }} />
          </div>
          <span className="text-xs font-semibold shrink-0" style={{ color: "var(--muted)" }}>{done}/{total} phases</span>
        </div>
      </div>

      <div className="space-y-6">
        {phases.map(({ phase, title, subtitle, color, status, tasks }) => {
          const doneTasks = tasks.filter(t => t.status === "done").length;
          return (
            <div key={phase} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
              {/* Phase header */}
              <div className="px-5 py-3.5 flex items-center gap-3" style={{ background: `${color}08`, borderBottom: "1px solid var(--card-border)" }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: color }}>
                  {phase}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{title}</span>
                    {status === "done" && <CheckCircle2 size={13} style={{ color: "#059669" }} />}
                    {status === "active" && <Zap size={13} style={{ color: "#d97706" }} />}
                  </div>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>{subtitle}</p>
                </div>
                <span className="text-xs font-semibold shrink-0" style={{ color }}>
                  {doneTasks}/{tasks.length}
                </span>
              </div>

              {/* Tasks */}
              <div className="px-5 py-3 space-y-2" style={{ background: "var(--card)" }}>
                {tasks.map(({ name, status: ts, detail }) => (
                  <div key={name} className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">{statusIcon(ts)}</div>
                    <div>
                      <span className="text-xs" style={{ color: ts === "done" ? "var(--muted)" : "var(--foreground)", textDecoration: ts === "done" ? "line-through" : "none", opacity: ts === "done" ? 0.6 : 1 }}>
                        {name}
                      </span>
                      {detail && <p className="text-xs mt-0.5" style={{ color: "var(--muted-light)" }}>{detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
