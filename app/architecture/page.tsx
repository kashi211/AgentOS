import { Server, Globe, Database, Cpu, Zap, ArrowRight, Wifi } from "lucide-react";

const techStack = [
  {
    layer: "Frontend",
    color: "#4f46e5",
    icon: Globe,
    items: [
      { name: "Next.js 15 (App Router)", desc: "Pages, routing, SSR" },
      { name: "Vercel AI SDK", desc: "Streaming hooks & useChat" },
      { name: "Tailwind CSS v4", desc: "Utility-first styling" },
      { name: "WebSocket Client", desc: "Live agent event feed" },
    ],
  },
  {
    layer: "Backend",
    color: "#7c3aed",
    icon: Server,
    items: [
      { name: "FastAPI (Python 3.12)", desc: "REST endpoints + WS server" },
      { name: "LangGraph", desc: "Agent graph orchestration" },
      { name: "Pydantic v2", desc: "Request/response models" },
      { name: "asyncpg", desc: "Async PostgreSQL driver" },
    ],
  },
  {
    layer: "AI Layer",
    color: "#0284c7",
    icon: Cpu,
    items: [
      { name: "Claude Opus 4.7", desc: "Primary reasoning & code gen" },
      { name: "Claude Sonnet 4.6 / o3", desc: "Fast tasks & fallback" },
      { name: "Tool Use / Function Calling", desc: "Structured agent actions" },
      { name: "Anthropic + OpenAI SDK", desc: "Unified provider interface" },
    ],
  },
  {
    layer: "Persistence",
    color: "#059669",
    icon: Database,
    items: [
      { name: "PostgreSQL (Neon)", desc: "Tasks, agents, messages" },
      { name: "Redis (Upstash)", desc: "Agent short-term memory cache" },
      { name: "Pinecone", desc: "Vector memory & semantic search" },
      { name: "Cloudflare R2", desc: "Generated code artefacts" },
    ],
  },
];

const agentNodes = [
  { id: "ceo", label: "CEO Agent", icon: "👔", color: "#4f46e5", desc: "Strategises, delegates, reviews final output" },
  { id: "planner", label: "Planner", icon: "🗺️", color: "#7c3aed", desc: "Breaks goals into subtasks with dependencies" },
  { id: "dev", label: "Developer", icon: "💻", color: "#0284c7", desc: "Writes and iterates on code" },
  { id: "qa", label: "QA Agent", icon: "🔍", color: "#059669", desc: "Tests output, flags bugs, requests revisions" },
  { id: "writer", label: "Writer", icon: "✍️", color: "#d97706", desc: "Generates docs, READMEs, reports" },
];

const dataFlows = [
  { from: "User", to: "Next.js UI", label: "submits goal", protocol: "Browser" },
  { from: "Next.js UI", to: "FastAPI", label: "POST /task", protocol: "REST" },
  { from: "FastAPI", to: "LangGraph", label: "route task to graph", protocol: "Internal" },
  { from: "LangGraph", to: "CEO Agent", label: "assign goal", protocol: "Agent call" },
  { from: "CEO Agent", to: "Sub-agents", label: "delegate subtasks", protocol: "Agent call" },
  { from: "Sub-agents", to: "Claude Opus 4.7 / o3", label: "completion request", protocol: "HTTPS" },
  { from: "Sub-agents", to: "PostgreSQL + Redis", label: "write memory", protocol: "SQL / Cache" },
  { from: "LangGraph", to: "WebSocket", label: "stream events", protocol: "WS" },
  { from: "WebSocket", to: "Next.js UI", label: "live agent feed", protocol: "WS" },
];

export default function ArchitecturePage() {
  return (
    <div className="min-h-full grid-bg px-4 sm:px-8 lg:px-10 py-12">
      <div className="max-w-5xl">

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
            System Architecture
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
            How AgentOS is built
          </h1>
          <p className="text-base max-w-2xl" style={{ color: "var(--muted)" }}>
            A layered architecture: Next.js frontend communicates over WebSockets with a FastAPI
            backend that orchestrates Claude Opus 4.7 agents via LangGraph, persisting state in
            PostgreSQL, Redis, and Pinecone.
          </p>
        </div>

        {/* Architecture Diagram */}
        <div className="card mb-10 overflow-hidden">
          <div className="px-6 py-4 border-b" style={{ borderColor: "var(--card-border)" }}>
            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>System Diagram</span>
          </div>
          <div className="p-6">

            {/* Row 1 — Browser */}
            <div className="flex justify-center mb-3">
              <div
                className="px-6 py-3 rounded-xl text-sm font-medium flex items-center gap-2"
                style={{
                  background: "var(--accent-light)",
                  border: "1px solid rgba(79,70,229,0.25)",
                  color: "var(--accent)",
                }}
              >
                <Globe size={16} />
                Browser — Next.js 15 UI
                <span
                  className="text-xs px-2 py-0.5 rounded-full ml-2"
                  style={{ background: "rgba(79,70,229,0.12)", color: "var(--accent)" }}
                >
                  Vercel AI SDK · WebSocket Client
                </span>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center gap-0.5 mb-3">
              <div className="w-px h-5" style={{ background: "var(--card-border)" }} />
              <div
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: "rgba(2,132,199,0.08)", color: "#0284c7", border: "1px solid rgba(2,132,199,0.2)" }}
              >
                <Wifi size={10} className="inline mr-1" />
                WebSocket + REST (HTTP/2)
              </div>
              <div className="w-px h-5" style={{ background: "var(--card-border)" }} />
            </div>

            {/* Row 2 — FastAPI */}
            <div className="flex justify-center mb-3">
              <div
                className="px-6 py-3 rounded-xl text-sm font-medium flex items-center gap-2"
                style={{
                  background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.25)",
                  color: "#7c3aed",
                }}
              >
                <Server size={16} />
                FastAPI Backend
                <span
                  className="text-xs px-2 py-0.5 rounded-full ml-2"
                  style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed" }}
                >
                  Python 3.12 · Uvicorn · LangGraph
                </span>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center mb-3">
              <div className="w-px h-6" style={{ background: "var(--card-border)" }} />
            </div>

            {/* Row 3 — Orchestrator */}
            <div className="flex justify-center mb-3">
              <div
                className="px-6 py-4 rounded-xl w-full max-w-2xl"
                style={{ background: "#f8faff", border: "1px solid rgba(79,70,229,0.2)" }}
              >
                <div
                  className="text-xs font-semibold uppercase tracking-widest mb-3 text-center"
                  style={{ color: "var(--accent)" }}
                >
                  Agent Orchestrator (LangGraph)
                </div>
                <div className="flex justify-center gap-3 flex-wrap">
                  {agentNodes.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-lg"
                      style={{
                        background: `${agent.color}08`,
                        border: `1px solid ${agent.color}25`,
                        minWidth: "80px",
                      }}
                    >
                      <span className="text-xl">{agent.icon}</span>
                      <span className="text-xs font-semibold" style={{ color: agent.color }}>{agent.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Arrows to bottom row */}
            <div className="flex justify-around mb-3 max-w-2xl mx-auto px-16">
              {["", "", ""].map((_, i) => (
                <div key={i} className="w-px h-6" style={{ background: "var(--card-border)" }} />
              ))}
            </div>

            {/* Row 4 — Data layer */}
            <div className="flex justify-center gap-4 flex-wrap">
              {[
                { label: "PostgreSQL", sub: "Neon · Tasks & Agents", color: "#059669", icon: "🗄️" },
                { label: "Redis", sub: "Upstash · Short-term Memory", color: "#dc2626", icon: "⚡" },
                { label: "Claude Opus 4.7", sub: "Multi-provider AI", color: "#0284c7", icon: "🤖" },
                { label: "Pinecone", sub: "Vector Memory", color: "#7c3aed", icon: "🔮" },
                { label: "Cloudflare R2", sub: "Generated Artefacts", color: "#d97706", icon: "📦" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                  style={{
                    background: `${item.color}08`,
                    border: `1px solid ${item.color}22`,
                  }}
                >
                  <span>{item.icon}</span>
                  <div>
                    <div className="font-semibold" style={{ color: "var(--foreground)" }}>{item.label}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Data Flow Table */}
        <div className="card mb-10">
          <div className="px-6 py-4 border-b" style={{ borderColor: "var(--card-border)" }}>
            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Data Flow</span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
            {dataFlows.map((flow, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-3 text-sm">
                <span className="font-semibold w-32 shrink-0" style={{ color: "var(--foreground)" }}>{flow.from}</span>
                <ArrowRight size={14} style={{ color: "var(--muted-light)" }} className="shrink-0" />
                <span className="w-40 shrink-0" style={{ color: "var(--foreground)" }}>{flow.to}</span>
                <span className="flex-1" style={{ color: "var(--muted)" }}>{flow.label}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: "var(--accent-light)",
                    color: "var(--accent)",
                    border: "1px solid rgba(79,70,229,0.15)",
                  }}
                >
                  {flow.protocol}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Layer breakdown */}
        <h2 className="text-xl font-bold mb-5" style={{ color: "var(--foreground)" }}>Layer Breakdown</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {techStack.map(({ layer, color, icon: Icon, items }) => (
            <div key={layer} className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${color}10`, border: `1px solid ${color}25` }}
                >
                  <Icon size={16} style={{ color }} />
                </div>
                <span className="font-bold" style={{ color: "var(--foreground)" }}>{layer}</span>
              </div>
              <div className="space-y-2.5">
                {items.map(({ name, desc }) => (
                  <div key={name} className="flex items-start gap-2">
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{ background: color }}
                    />
                    <div>
                      <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{name}</div>
                      <div className="text-xs" style={{ color: "var(--muted)" }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Agent Detail */}
        <h2 className="text-xl font-bold mb-5" style={{ color: "var(--foreground)" }}>Agent Definitions</h2>
        <div className="space-y-3 mb-12">
          {agentNodes.map((agent) => (
            <div key={agent.id} className="card card-hover flex items-start gap-4 p-5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: `${agent.color}10`, border: `1px solid ${agent.color}25` }}
              >
                {agent.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-bold" style={{ color: "var(--foreground)" }}>{agent.label}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-mono"
                    style={{ background: `${agent.color}10`, color: agent.color }}
                  >
                    {agent.id}
                  </span>
                </div>
                <p className="text-sm" style={{ color: "var(--muted)" }}>{agent.desc}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs" style={{ color: "var(--muted)" }}>Model</span>
                <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>Opus 4.7</span>
              </div>
            </div>
          ))}
        </div>

        {/* Key Design Decisions */}
        <h2 className="text-xl font-bold mb-5" style={{ color: "var(--foreground)" }}>Key Design Decisions</h2>
        <div className="grid grid-cols-1 gap-4">
          {[
            {
              title: "Why PostgreSQL (Neon) over SQLite?",
              body:
                "Neon provides serverless Postgres with branching and zero cold-start latency — no connection pooling to manage. Supports pgvector for future embedding queries and scales horizontally without changing the schema.",
            },
            {
              title: "Why LangGraph over a custom orchestrator?",
              body:
                "LangGraph models agent workflows as directed graphs with typed state, making complex branching (CEO → Planner → Developer → QA → retry) explicit and inspectable. It also ships with built-in checkpointing for durable execution.",
            },
            {
              title: "Why WebSockets for streaming?",
              body:
                "Agent execution can span minutes with dozens of sub-events (thinking, tool call, output). SSE would work for one-way streaming but WebSockets let the UI send interrupts and feedback mid-run.",
            },
            {
              title: "Why multi-provider AI (Claude Opus 4.7 + o3)?",
              body:
                "Claude Opus 4.7 leads on code reasoning and long-context tasks; Claude Sonnet 4.6 handles faster, lighter sub-tasks at lower cost; OpenAI o3 provides cross-provider redundancy. A provider abstraction layer makes swapping models a config change.",
            },
          ].map(({ title, body }) => (
            <div key={title} className="card p-5">
              <h3 className="text-sm font-bold mb-2" style={{ color: "var(--foreground)" }}>{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
