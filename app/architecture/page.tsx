import { Server, Globe, Database, Cpu, ArrowRight } from "lucide-react";

const techStack = [
  {
    layer: "Frontend",
    color: "#4f46e5",
    icon: Globe,
    items: [
      { name: "Next.js 14 (App Router)", desc: "Pages, routing, SSR" },
      { name: "TypeScript", desc: "Type-safe components" },
      { name: "Tailwind CSS", desc: "Utility-first styling" },
      { name: "WebSocket Client", desc: "Live agent event feed" },
    ],
  },
  {
    layer: "Backend",
    color: "#7c3aed",
    icon: Server,
    items: [
      { name: "FastAPI (Python 3.13)", desc: "REST endpoints + WebSocket server" },
      { name: "LangGraph", desc: "Agent graph orchestration" },
      { name: "asyncpg", desc: "Async PostgreSQL driver" },
      { name: "Pydantic Settings", desc: "Config + env management" },
    ],
  },
  {
    layer: "AI Layer",
    color: "#0284c7",
    icon: Cpu,
    items: [
      { name: "Claude Opus 4.7", desc: "Primary reasoning agents" },
      { name: "Claude Sonnet 4.6", desc: "QA and reviewer agents" },
      { name: "Claude Haiku 4.5", desc: "Fast utility agents" },
      { name: "Anthropic SDK", desc: "Tool use + streaming" },
    ],
  },
  {
    layer: "Persistence",
    color: "#059669",
    icon: Database,
    items: [
      { name: "PostgreSQL (Neon)", desc: "Tasks, messages, subtasks" },
      { name: "Redis (Upstash)", desc: "Agent short-term memory (optional)" },
      { name: "File system", desc: "Generated artefacts per task" },
    ],
  },
];

const pipelines = [
  {
    id: "software-dev",
    label: "Software Development",
    color: "#0284c7",
    agents: ["CEO", "Planner", "Developer", "QA", "Writer"],
    loop: "QA → Developer (max 2 revisions)",
  },
  {
    id: "investment",
    label: "Investment Analysis",
    color: "#059669",
    agents: ["Analyst", "Bear Case", "Synthesizer", "Risk Agent"],
    loop: "Risk Agent → Synthesizer (max 2 revisions)",
  },
  {
    id: "legal",
    label: "Legal Document Review",
    color: "#64748b",
    agents: ["Reader", "Clause Flagger", "Legal Editor", "Protection Checker"],
    loop: "Protection Checker → Legal Editor (max 2 revisions)",
  },
  {
    id: "research",
    label: "Research & Intelligence",
    color: "#7c3aed",
    agents: ["Researcher", "Fact Checker", "Devil's Advocate", "Research Editor"],
    loop: "Fact Checker → Researcher (max 2 revisions)",
  },
  {
    id: "content",
    label: "Content & Marketing",
    color: "#ec4899",
    agents: ["Content Writer", "SEO Agent", "Brand Voice", "Content Editor"],
    loop: "Linear pipeline",
  },
  {
    id: "academic",
    label: "Academic Literature Review",
    color: "#7c3aed",
    agents: ["Summarizer", "Critic", "Literature Synthesizer", "Citation Agent"],
    loop: "Critic → Summarizer (max 1 revision)",
  },
];

export default function ArchitecturePage() {
  return (
    <div className="px-6 sm:px-10 py-10 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--foreground)" }}>Architecture</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          How AgentOS is built — the stack, the agent pipelines, and how they connect.
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
        <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--muted-light)" }}>Agent Pipelines</h2>
        <p className="text-xs mb-5" style={{ color: "var(--muted)" }}>
          Each preset maps to a dedicated LangGraph pipeline. Agents run sequentially; QA reviewers can loop back up to the configured max revisions before escalating to the final output.
        </p>
        <div className="space-y-3">
          {pipelines.map(({ id, label, color, agents, loop }) => (
            <div key={id} className="rounded-xl p-4" style={{ border: "1px solid var(--card-border)", background: "var(--card)" }}>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <span className="text-xs font-bold" style={{ color }}>{label}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}>
                  {loop}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {agents.map((agent, i) => (
                  <div key={agent} className="flex items-center gap-1.5">
                    <span className="text-xs px-2.5 py-1 rounded-lg font-medium" style={{ background: `${color}10`, color, border: `1px solid ${color}20` }}>
                      {agent}
                    </span>
                    {i < agents.length - 1 && <ArrowRight size={11} style={{ color: "var(--muted-light)" }} />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Data Flow */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--muted-light)" }}>Request Flow</h2>
        <div className="rounded-xl p-5" style={{ border: "1px solid var(--card-border)", background: "var(--card)" }}>
          <div className="space-y-3">
            {[
              { step: "1", text: "User submits a task with a preset_id via POST /tasks/", color: "#4f46e5" },
              { step: "2", text: "Backend creates a DB record and spawns the matching LangGraph pipeline in the background", color: "#7c3aed" },
              { step: "3", text: "Each agent node calls Claude, saves its output to the messages table, and emits events", color: "#0284c7" },
              { step: "4", text: "Events are broadcast over WebSocket to any connected clients watching that task_id", color: "#059669" },
              { step: "5", text: "Frontend polls /tasks/ every 5s for status and streams live events via WebSocket", color: "#d97706" },
              { step: "6", text: "QA reviewer decides pass (→ END) or fail (→ loop back, max revisions)", color: "#dc2626" },
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
