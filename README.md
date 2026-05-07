# AgentOS — Where AI Specialists Collaborate and Ship

A multi-agent system where specialized AI agents — CEO, Planner, Developer, QA, Writer — work together like a high-performance engineering team to plan, build, and deliver outcomes from a single user goal.

**Live demo → [agentos.vercel.app](https://agentos.vercel.app)**

---

## What it does

You give AgentOS a goal. A coordinated team of AI agents takes it from there:

1. **CEO Agent** — interprets the goal, defines success criteria, delegates work
2. **Planner Agent** — decomposes the goal into a dependency graph of subtasks
3. **Developer Agent** — writes working code, iterates on feedback
4. **QA Agent** — reviews every output, flags failures, requests revisions
5. **Writer Agent** — generates documentation, reports, and READMEs

Every step is streamed live to the UI via WebSockets.

---

## Architecture

```
Browser (Next.js 15)
    │  WebSocket + REST
    ▼
FastAPI Backend (Python 3.12)
    │  LangGraph orchestration
    ▼
┌─────────────────────────────────────────┐
│          Agent Orchestrator             │
│  CEO → Planner → Developer → QA → ...  │
└─────────────────────────────────────────┘
    │
    ├── Claude 3.5 Sonnet / GPT-4o  (AI)
    ├── PostgreSQL on Neon           (persistence)
    ├── Redis on Upstash             (short-term memory)
    ├── Pinecone                     (vector memory)
    └── Cloudflare R2                (generated artefacts)
```

Full architecture breakdown at [/architecture](https://agentos.vercel.app/architecture).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), Tailwind CSS v4, Vercel AI SDK |
| Backend | FastAPI, Python 3.12, Uvicorn |
| Orchestration | LangGraph |
| AI | Claude 3.5 Sonnet (primary), GPT-4o (fallback) |
| Database | PostgreSQL via Neon |
| Cache / Memory | Redis via Upstash |
| Vector DB | Pinecone |
| File Storage | Cloudflare R2 |
| Deployment | Vercel (frontend) · Railway (backend) |

---

## Local Development

**Prerequisites:** Node 20+, Python 3.12, Docker

```bash
# Clone
git clone https://github.com/kashi211/AgentOS.git
cd AgentOS

# Frontend
npm install
npm run dev        # http://localhost:3000

# Backend (in a separate terminal)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in API keys
uvicorn main:app --reload --port 8000
```

**Required env vars (`.env`):**

```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
UPSTASH_REDIS_URL=...
PINECONE_API_KEY=...
```

---

## Project Status

Currently in **Phase 1** — frontend scaffold complete, backend in progress.
Full roadmap at [/plan](https://agentos.vercel.app/plan).

| Phase | Status |
|-------|--------|
| 1 · Foundation | 🔄 In progress |
| 2 · Agent Engine | ⬜ Todo |
| 3 · Task Orchestration | ⬜ Todo |
| 4 · Real-Time UI | ⬜ Todo |
| 5 · Polish & Deploy | ⬜ Todo |
| 6 · Stretch Goals | 🔮 Post-launch |

---

## Design Decisions

**LangGraph over a custom orchestrator** — models agent workflows as directed graphs with typed state, making complex branching explicit and checkpointable for durable execution.

**Claude 3.5 + GPT-4o multi-provider** — Claude leads on code reasoning and long-context tasks; GPT-4o provides fallback and cost optimisation. Swapping models is a config change.

**PostgreSQL (Neon) over SQLite** — serverless Postgres with branching, zero cold-start, and native pgvector support for future embedding queries.

**WebSockets over SSE** — agent runs span minutes with many sub-events. WebSockets let the UI send interrupts and human feedback mid-run, not just receive.

---

Built by [Kashish Panwar](https://github.com/kashi211)
