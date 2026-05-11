import { Brain, Code2, FileText, ShieldCheck, Zap } from "lucide-react";

const agents = [
  {
    role: "CEO",
    id: "ceo",
    icon: "👔",
    color: "#4f46e5",
    model: "Claude Opus 4.7",
    description:
      "Receives the user's goal, defines success criteria, and produces a structured execution plan. Delegates to Planner and reviews final output before delivery.",
    responsibilities: [
      "Interprets ambiguous goals into clear deliverables",
      "Produces structured JSON execution plans",
      "Reviews final output quality",
      "Escalates blockers to the user",
    ],
    systemPrompt:
      'You are the CEO of AgentOS. Given a goal, produce a structured execution plan assigning work to Planner, Developer, QA, and Writer agents...',
  },
  {
    role: "Planner",
    id: "planner",
    icon: "🗺️",
    color: "#7c3aed",
    model: "Claude Opus 4.7",
    description:
      "Receives the CEO plan and decomposes it into a dependency-ordered list of concrete steps. Each step is assigned to a specific agent with full context.",
    responsibilities: [
      "Breaks goals into dependency-ordered steps",
      "Assigns each step to the right agent",
      "Identifies steps that can run in parallel",
      "Surfaces constraints and edge cases upfront",
    ],
    systemPrompt:
      "You are the Planner. Decompose the CEO's plan into a detailed, dependency-ordered JSON step list with agent assignments...",
  },
  {
    role: "Developer",
    id: "developer",
    icon: "💻",
    color: "#0284c7",
    model: "Claude Opus 4.7",
    description:
      "Implements each assigned step — writing complete, production-quality code. Has access to file read/write tools and iterates based on QA feedback.",
    responsibilities: [
      "Writes complete, working code — no placeholders",
      "Uses file tools to read context and write output",
      "Incorporates QA feedback on revision cycles",
      "Documents key decisions inline",
    ],
    systemPrompt:
      "You are the Developer. Write complete, production-quality code for each assigned step. Use file tools to read context...",
    tools: ["read_file", "write_file"],
  },
  {
    role: "QA",
    id: "qa",
    icon: "🔍",
    color: "#059669",
    model: "Claude Sonnet 4.6",
    description:
      "Reviews Developer output against the original task description. Scores each submission and returns structured pass/fail with concrete feedback.",
    responsibilities: [
      "Scores output 0–10 (≥7 passes)",
      "Returns structured JSON pass/fail verdict",
      "Provides line-specific feedback for failures",
      "Escalates after 2 failed revision cycles",
    ],
    systemPrompt:
      "You are the QA Agent. Review developer output and return a JSON verdict with score, issues, and concrete feedback...",
  },
  {
    role: "Writer",
    id: "writer",
    icon: "✍️",
    color: "#d97706",
    model: "Claude Sonnet 4.6",
    description:
      "Generates professional documentation, READMEs, and technical reports once all development steps are complete. Fast and cost-efficient on Sonnet 4.6.",
    responsibilities: [
      "Writes GitHub-flavoured Markdown docs",
      "Summarises what was built and key decisions",
      "Generates setup and usage instructions",
      "Produces the final deliverable report",
    ],
    systemPrompt:
      "You are the Writer. Produce clear, professional Markdown documentation summarising what was built...",
  },
];

const featureIcons = {
  Brain,
  Code2,
  FileText,
  ShieldCheck,
  Zap,
};

export default function AgentsPage() {
  return (
    <div className="min-h-full grid-bg px-4 sm:px-8 lg:px-10 py-12">
      <div className="max-w-4xl">

        {/* Header */}
        <div className="mb-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-4"
            style={{ background: "var(--accent-light)", border: "1px solid rgba(79,70,229,0.2)", color: "var(--accent)" }}
          >
            <Zap size={12} />
            Agent Roster
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
            Meet the team
          </h1>
          <p className="text-base max-w-2xl" style={{ color: "var(--muted)" }}>
            Five specialized agents, each with a defined role, model, and toolset. They collaborate
            via LangGraph — CEO delegates, agents execute, QA validates, Writer documents.
          </p>
        </div>

        {/* Model legend */}
        <div className="card p-4 mb-8 flex gap-6 flex-wrap">
          {[
            { model: "Claude Opus 4.7", color: "#4f46e5", desc: "Heavy reasoning & code" },
            { model: "Claude Sonnet 4.6", color: "#059669", desc: "Fast, cost-efficient tasks" },
          ].map((m) => (
            <div key={m.model} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
              <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{m.model}</span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>— {m.desc}</span>
            </div>
          ))}
        </div>

        {/* Agent cards */}
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
                    <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                      {agent.role}
                    </h2>
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
                    {agent.tools && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: "rgba(2,132,199,0.08)", color: "#0284c7", border: "1px solid rgba(2,132,199,0.15)" }}
                      >
                        {agent.tools.length} tools
                      </span>
                    )}
                  </div>

                  <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
                    {agent.description}
                  </p>

                  {/* Responsibilities */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mb-4">
                    {agent.responsibilities.map((r) => (
                      <div key={r} className="flex items-start gap-2">
                        <div
                          className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                          style={{ background: agent.color }}
                        />
                        <span className="text-xs" style={{ color: "var(--muted)" }}>{r}</span>
                      </div>
                    ))}
                  </div>

                  {/* Tools */}
                  {agent.tools && (
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
              </div>
            </div>
          ))}
        </div>

        {/* Flow diagram */}
        <div className="mt-10 card p-6">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--muted-light)" }}>
            Execution Flow
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: "User Goal", color: "#64748b" },
              { label: "CEO", color: "#4f46e5" },
              { label: "Planner", color: "#7c3aed" },
              { label: "Developer", color: "#0284c7" },
              { label: "QA", color: "#059669" },
              { label: "Writer", color: "#d97706" },
              { label: "Delivery", color: "#64748b" },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center gap-2">
                <div
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: `${step.color}10`, color: step.color, border: `1px solid ${step.color}25` }}
                >
                  {step.label}
                </div>
                {i < arr.length - 1 && (
                  <span style={{ color: "var(--muted-light)", fontSize: 14 }}>→</span>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
            QA can loop Developer back for up to 2 revision cycles before escalating to Writer.
          </p>
        </div>
      </div>
    </div>
  );
}
