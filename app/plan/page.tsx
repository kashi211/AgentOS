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
      { name: "Next.js 15 App Router + TypeScript + Tailwind", status: "done" },
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
      { name: "BaseAgent: system prompt, tool-use loop, memory integration", status: "done" },
      { name: "Software dev pipeline: CEO → Planner → Developer → QA → Writer", status: "done" },
      { name: "LangGraph StateGraph with conditional routing and revision loops", status: "done" },
      { name: "QA feedback loops with configurable max revision limits", status: "done" },
      { name: "Redis short-term memory (graceful fallback if unavailable)", status: "done" },
      { name: "Developer file tools: read_file, write_file, list_files", status: "done" },
    ],
  },
  {
    phase: 3,
    title: "Preset Pipelines",
    subtitle: "Dedicated graphs for all 6 specialist teams",
    color: "#0284c7",
    status: "done",
    tasks: [
      { name: "Investment analysis: Analyst → Bear Case → Data Agent → Risk Agent → Synthesizer", status: "done" },
      { name: "Legal review: Reader → Clause Flagger → Protection Checker → Legal Editor", status: "done" },
      { name: "Research & Intelligence: Researcher → Fact Checker → Devil's Advocate → Research Editor", status: "done" },
      { name: "Content & Marketing: Content Writer → SEO Agent → Brand Voice → Content Editor", status: "done" },
      { name: "Academic review: Summarizer → Critic → Literature Synthesizer → Citation Agent", status: "done" },
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
      { name: "Projects page with 6 preset selector tabs", status: "done" },
      { name: "Live agent event stream via WebSocket", status: "done" },
      { name: "Task sidebar with status badges, show more/less for long goals", status: "done" },
      { name: "Delivery panel with Deliverable and QA Report tabs", status: "done" },
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
      { name: "6 built-in presets with agent rosters, prompts, and workflows", status: "done" },
      { name: "Agent CRUD: add, edit, delete agents with custom system prompts", status: "done" },
      { name: "Workflow editor with loop and revision configuration", status: "done" },
      { name: "Save current team as custom preset, fork built-ins", status: "done" },
      { name: "Preset activation persisted to localStorage", status: "done" },
      { name: "Custom presets synced to DB and fetched on load", status: "done" },
    ],
  },
  {
    phase: 6,
    title: "Pipeline Intelligence",
    subtitle: "Visibility into every agent's context and output",
    color: "#0284c7",
    status: "done",
    tasks: [
      { name: "Pipeline graph UI: visual agent flow with node cards per agent", status: "done" },
      { name: "agent_input/agent_output saved to DB for every agent in every graph", status: "done" },
      { name: "INPUT panel: exact context passed to each agent (from upstream outputs)", status: "done" },
      { name: "OUTPUT panel: full agent response with markdown rendering", status: "done" },
      { name: "Turn selector: inspect each revision cycle independently", status: "done" },
      { name: "ExpandableContent: show-more/less for long inputs and outputs", status: "done" },
      { name: "Live event filtering: WS previews don't override persisted DB content", status: "done" },
      { name: "Fixed write_file bug in research_editor, content_editor, legal_editor, citation_agent", status: "done" },
    ],
  },
  {
    phase: 7,
    title: "Smart UX Layer",
    subtitle: "LLM-powered prompt refinement and task summaries",
    color: "#ec4899",
    status: "done",
    tasks: [
      { name: "MCQ refinement modal: 3 dynamic questions generated by Haiku before task submission", status: "done" },
      { name: "Questions are goal-specific (not preset-hardcoded) — works for custom agents too", status: "done" },
      { name: "Answers appended as structured context to enrich the goal before sending to agents", status: "done" },
      { name: "TL;DR summary: Haiku reads final outputs and writes 2-3 sentence conclusion", status: "done" },
      { name: "Summary shown as banner below pipeline graph on task completion", status: "done" },
      { name: "Summary cached in memory — instant on revisit, no re-generation", status: "done" },
    ],
  },
  {
    phase: 8,
    title: "Production & Scale",
    subtitle: "Auth, streaming, memory, storage, parallelism",
    color: "#64748b",
    status: "done",
    tasks: [
      { name: "Vercel deployment with clean ESLint build", status: "done" },
      { name: "CORS fix for all localhost ports (allow_origin_regex)", status: "done" },
      { name: "Sticky sidebar scroll without locking full page height", status: "done" },
      { name: "Duplicate preset deduplication (by ID and name)", status: "done" },
      { name: "User auth: JWT (72h, HS256) + bcrypt; /auth/register, /auth/login, /auth/me", status: "done", detail: "Per-user task isolation — tasks scoped to user_id when Bearer token provided" },
      { name: "Streaming token output: messages.stream() → WS {type:'token'} → live AgentDetail", status: "done", detail: "Global stream registry keyed by task_id; unregistered in finally block" },
      { name: "Task cancellation: asyncio.Task registry + POST /tasks/{id}/cancel + UI cancel button", status: "done" },
      { name: "Pinecone long-term semantic memory: multilingual-e5-large (1024-dim, hosted inference)", status: "done", detail: "Top-3 memories retrieved before each run; output upserted after. Graceful no-op without API key." },
      { name: "Cloudflare R2 artefact storage: boto3 S3-compatible client with local filesystem fallback", status: "done" },
      { name: "Agent parallelism: asyncio.gather for independent nodes (SEO + Brand Voice in content graph)", status: "done" },
    ],
  },
];

const statusIcon = (s: Status) => {
  if (s === "done") return <CheckCircle2 size={13} style={{ color: "#059669" }} />;
  if (s === "active") return <Zap size={13} style={{ color: "#d97706" }} />;
  return <Circle size={13} style={{ color: "var(--muted-light)" }} />;
};

export default function PlanPage() {
  const allTasks = phases.flatMap(p => p.tasks);
  const doneTasks = allTasks.filter(t => t.status === "done").length;
  const totalTasks = allTasks.length;
  const donePhases = phases.filter(p => p.status === "done").length;

  return (
    <div className="px-6 sm:px-10 py-10 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--foreground)" }}>Dev Plan</h1>
        <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
          What has been built and what is still ahead.
        </p>

        {/* Stats row */}
        <div className="flex items-center gap-6 mb-4">
          {[
            { label: "Phases complete", value: `${donePhases}/${phases.length}`, color: "#059669" },
            { label: "Tasks complete", value: `${doneTasks}/${totalTasks}`, color: "#4f46e5" },
            { label: "Agents built", value: "22+", color: "#7c3aed" },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p className="text-xl font-bold" style={{ color }}>{value}</p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--card-border)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(doneTasks / totalTasks) * 100}%`, background: "#059669" }} />
          </div>
          <span className="text-xs font-semibold shrink-0" style={{ color: "var(--muted)" }}>{Math.round((doneTasks / totalTasks) * 100)}%</span>
        </div>
      </div>

      <div className="space-y-5">
        {phases.map(({ phase, title, subtitle, color, status, tasks }) => {
          const done = tasks.filter(t => t.status === "done").length;
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
                  {done}/{tasks.length}
                </span>
              </div>

              {/* Tasks */}
              <div className="px-5 py-3 space-y-2" style={{ background: "var(--card)" }}>
                {tasks.map(({ name, status: ts, detail }) => (
                  <div key={name} className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">{statusIcon(ts)}</div>
                    <div>
                      <span className="text-xs" style={{
                        color: ts === "done" ? "var(--muted)" : "var(--foreground)",
                        textDecoration: ts === "done" ? "line-through" : "none",
                        opacity: ts === "done" ? 0.6 : 1,
                      }}>
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
