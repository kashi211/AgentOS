import uuid
import asyncio
import os

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse

from db.connection import get_pool
from models.task import TaskCreate, TaskOut
from orchestrator.graph import build_graph
from orchestrator.legal_graph import build_legal_graph
from orchestrator.investment_graph import build_investment_graph
from orchestrator.research_graph import build_research_graph
from orchestrator.content_graph import build_content_graph
from orchestrator.academic_graph import build_academic_graph
from routes.ws import broadcast

router = APIRouter()
_graph = build_graph()
_legal_graph = build_legal_graph()
_investment_graph = build_investment_graph()
_research_graph = build_research_graph()
_content_graph = build_content_graph()
_academic_graph = build_academic_graph()


def _get_graph(preset_id: str | None):
    if preset_id == "legal-review":
        return _legal_graph
    if preset_id == "investment-analysis":
        return _investment_graph
    if preset_id == "research-intelligence":
        return _research_graph
    if preset_id == "content-marketing":
        return _content_graph
    if preset_id == "academic-review":
        return _academic_graph
    return _graph


@router.post("/", status_code=202)
async def create_task(body: TaskCreate):
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO tasks (goal) VALUES ($1) RETURNING id, goal, status, created_at",
            body.goal,
        )

    task_id = str(row["id"])

    # Run the agent graph in the background
    asyncio.create_task(_run_graph(task_id, body.goal, preset_id=body.preset_id))

    return {"task_id": task_id, "status": "pending"}


@router.get("/{task_id}")
async def get_task(task_id: str):
    pool = get_pool()
    async with pool.acquire() as conn:
        task = await conn.fetchrow("SELECT * FROM tasks WHERE id=$1", uuid.UUID(task_id))
        if not task:
            raise HTTPException(404, "Task not found")

        subtasks = await conn.fetch("SELECT * FROM subtasks WHERE task_id=$1 ORDER BY created_at", uuid.UUID(task_id))
        messages = await conn.fetch("SELECT * FROM messages WHERE task_id=$1 ORDER BY created_at", uuid.UUID(task_id))

    return {
        "id": str(task["id"]),
        "goal": task["goal"],
        "status": task["status"],
        "result": task["result"],
        "created_at": task["created_at"].isoformat(),
        "subtasks": [dict(s) for s in subtasks],
        "messages": [dict(m) for m in messages],
    }


@router.get("/")
async def list_tasks():
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT id, goal, status, created_at FROM tasks ORDER BY created_at DESC LIMIT 50")
    return [{"id": str(r["id"]), "goal": r["goal"], "status": r["status"], "created_at": r["created_at"].isoformat()} for r in rows]


@router.get("/{task_id}/files")
async def list_task_files(task_id: str):
    output_dir = os.path.join("output", task_id)
    if not os.path.isdir(output_dir):
        return []
    files = []
    for root, _, filenames in os.walk(output_dir):
        for name in filenames:
            full = os.path.join(root, name)
            rel = os.path.relpath(full, output_dir)
            size = os.path.getsize(full)
            files.append({"path": rel, "size": size})
    return sorted(files, key=lambda f: f["path"])


@router.get("/{task_id}/files/{file_path:path}")
async def get_task_file(task_id: str, file_path: str):
    output_dir = os.path.join("output", task_id)
    safe = os.path.realpath(os.path.join(output_dir, file_path))
    root = os.path.realpath(output_dir)
    if not safe.startswith(root + os.sep) and safe != root:
        raise HTTPException(400, "Invalid path")
    if not os.path.isfile(safe):
        raise HTTPException(404, "File not found")
    with open(safe) as f:
        content = f.read()
    return PlainTextResponse(content)


@router.put("/{task_id}/files/{file_path:path}")
async def put_task_file(task_id: str, file_path: str, request: Request):
    output_dir = os.path.join("output", task_id)
    safe = os.path.realpath(os.path.join(output_dir, file_path))
    root = os.path.realpath(output_dir)
    if not safe.startswith(root + os.sep) and safe != root:
        raise HTTPException(400, "Invalid path")
    content = await request.body()
    os.makedirs(os.path.dirname(safe), exist_ok=True)
    with open(safe, "wb") as f:
        f.write(content)
    return {"saved": True, "path": file_path, "size": len(content)}


async def _run_graph(task_id: str, goal: str, output_task_id: str | None = None, preset_id: str | None = None):
    graph = _get_graph(preset_id)

    if preset_id == "legal-review":
        initial_state = {
            "task_id": task_id,
            "goal": goal,
            "reader_output": "",
            "flags_output": "",
            "editor_output": "",
            "checker_feedback": "",
            "revision_count": 0,
            "status": "pending",
            "final_result": "",
            "events": [],
        }
    elif preset_id == "investment-analysis":
        initial_state = {
            "task_id": task_id,
            "goal": goal,
            "analyst_output": "",
            "bear_output": "",
            "risk_feedback": "",
            "synthesizer_output": "",
            "revision_count": 0,
            "status": "pending",
            "final_result": "",
            "events": [],
        }
    elif preset_id == "research-intelligence":
        initial_state = {
            "task_id": task_id,
            "goal": goal,
            "researcher_output": "",
            "fact_check_output": "",
            "devils_advocate_output": "",
            "editor_output": "",
            "fact_check_feedback": "",
            "revision_count": 0,
            "status": "pending",
            "final_result": "",
            "events": [],
        }
    elif preset_id == "content-marketing":
        initial_state = {
            "task_id": task_id,
            "goal": goal,
            "writer_output": "",
            "seo_output": "",
            "brand_output": "",
            "editor_output": "",
            "status": "pending",
            "final_result": "",
            "events": [],
        }
    elif preset_id == "academic-review":
        initial_state = {
            "task_id": task_id,
            "goal": goal,
            "summarizer_output": "",
            "critic_output": "",
            "synthesizer_output": "",
            "citation_output": "",
            "critic_feedback": "",
            "revision_count": 0,
            "status": "pending",
            "final_result": "",
            "events": [],
        }
    else:
        initial_state = {
            "task_id": task_id,
            "output_task_id": output_task_id or task_id,
            "goal": goal,
            "plan": [],
            "steps": [],
            "current_step_idx": 0,
            "agent_outputs": {},
            "revision_count": 0,
            "status": "pending",
            "final_result": "",
            "events": [],
        }

    try:
        async for chunk in graph.astream(initial_state):
            for node_name, state_update in chunk.items():
                for event in state_update.get("events", []):
                    await broadcast(task_id, {**event, "node": node_name})
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"[_run_graph ERROR] task={task_id} preset={preset_id}\n{tb}")
        await broadcast(task_id, {"type": "error", "agent": "system", "content": str(e)})
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE tasks SET status='failed', updated_at=NOW() WHERE id=$1",
                uuid.UUID(task_id),
            )
