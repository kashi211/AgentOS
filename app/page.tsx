import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Network,
  ShieldCheck,
  Code2,
  Crown,
  Map,
  Bug,
  PenLine,
  type LucideIcon,
} from "lucide-react";

const agents: { role: string; icon: LucideIcon; color: string; desc: string }[] = [
  { role: "CEO",       icon: Crown,   color: "#0084c6", desc: "Strategy & delegation" },
  { role: "Planner",   icon: Map,     color: "#006ba3", desc: "Task decomposition" },
  { role: "Developer", icon: Code2,   color: "#0284c7", desc: "Code generation" },
  { role: "QA",        icon: Bug,     color: "#059669", desc: "Review & validation" },
  { role: "Writer",    icon: PenLine, color: "#d97706", desc: "Docs & reports" },
];

const features = [
  {
    icon: Brain,
    title: "Persistent Memory",
    desc: "Each agent maintains context across the entire task lifecycle — stored in PostgreSQL with Redis for fast short-term recall.",
  },
  {
    icon: Network,
    title: "Agent-to-Agent Comms",
    desc: "Agents communicate via a structured message bus. The CEO delegates, developers build, QA reviews — just like a real team.",
  },
  {
    icon: ShieldCheck,
    title: "Validation Loops",
    desc: "Every output is peer-reviewed by another agent before being marked complete, reducing errors and hallucinations.",
  },
  {
    icon: Code2,
    title: "Real Code Output",
    desc: "Agents don't just plan — they write working code, create files, and iterate on feedback until the task is done.",
  },
];

export default function Home() {
  return (
    <div className="min-h-full grid-bg">
      {/* Hero */}
      <section className="relative px-4 sm:px-8 lg:px-10 pt-8 sm:pt-16 lg:pt-20 pb-16">
        <div className="relative max-w-4xl">
          <h1 className="text-5xl font-bold leading-tight mb-5">
            <span style={{ color: "var(--foreground)" }}>Build your team of</span>
            <br />
            <span className="gradient-text">collaborative AI agents.</span>
          </h1>

          <p className="text-lg max-w-2xl mb-8" style={{ color: "var(--muted)" }}>
            AgentOS orchestrates a coordinated team of specialized AI agents — CEO, Planner,
            Developer, QA — each with memory, tools, and goals. They think together, build
            together, and deliver outcomes with minimal human input.
          </p>

          <div className="flex items-center gap-4">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold text-white transition-all"
              style={{ background: "var(--accent)", boxShadow: "0 2px 8px rgba(79,70,229,0.25)" }}
            >
              Start a Project
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/architecture"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: "var(--card)",
                border: "1px solid var(--card-border)",
                color: "var(--foreground)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              View Architecture
            </Link>
          </div>
        </div>
      </section>

      {/* Agent Roster */}
      <section className="px-4 sm:px-8 lg:px-10 pb-12">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--muted-light)" }}>
            The Team
          </p>
          <div className="flex gap-3 flex-wrap">
            {agents.map((a) => (
              <div
                key={a.role}
                className="card card-hover flex items-center gap-3 px-4 py-3"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: `${a.color}12`, border: `1px solid ${a.color}30` }}
                >
                  <a.icon size={16} style={{ color: a.color }} />
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{a.role}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 sm:px-8 lg:px-10 pb-12">
        <div className="max-w-4xl">
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>How it works</h2>
          <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>
            A user submits a goal. The CEO agent breaks it into tasks, assigns them to the right
            agents, and monitors progress until delivery.
          </p>

          {/* Pipeline */}
          <div className="card p-6 mb-10">
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: "User Goal", color: "#0084c6" },
                { label: "CEO Plans", color: "#006ba3" },
                { label: "Tasks Split", color: "#d97706" },
                { label: "Agents Execute", color: "#0284c7" },
                { label: "QA Reviews", color: "#059669" },
                { label: "Delivery", color: "#d97706" },
              ].map((step, i, arr) => (
                <div key={step.label} className="flex items-center gap-2">
                  <div
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: `${step.color}10`, color: step.color, border: `1px solid ${step.color}25` }}
                  >
                    {step.label}
                  </div>
                  {i < arr.length - 1 && (
                    <ArrowRight size={14} style={{ color: "var(--muted-light)" }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card card-hover p-5">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: "var(--accent-light)", border: "1px solid rgba(79,70,229,0.15)" }}
                >
                  <Icon size={18} style={{ color: "var(--accent)" }} />
                </div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack bar */}
      <section className="px-4 sm:px-8 lg:px-10 pb-20">
        <div className="max-w-4xl">
          <div
            className="rounded-xl p-5"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--muted-light)" }}>
              Tech Stack
            </p>
            <div className="flex gap-6 flex-wrap">
              {[
                { label: "Next.js 15", cat: "Frontend" },
                { label: "FastAPI", cat: "Backend" },
                { label: "PostgreSQL", cat: "Database" },
                { label: "Claude Opus 4.7 + Sonnet 4.6", cat: "AI" },
                { label: "Vercel AI SDK", cat: "Streaming" },
                { label: "Redis (Upstash)", cat: "Memory" },
                { label: "Pinecone", cat: "Vector DB" },
                { label: "LangGraph", cat: "Orchestration" },
                { label: "TypeScript", cat: "Language" },
                { label: "Python 3.12", cat: "Language" },
              ].map(({ label, cat }) => (
                <div key={label} className="flex flex-col">
                  <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{label}</span>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>{cat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
