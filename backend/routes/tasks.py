import uuid
import asyncio
import os

from fastapi import APIRouter, HTTPException, Request, Header
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
from auth.jwt_utils import decode_token

router = APIRouter()
_graph = build_graph()
_legal_graph = build_legal_graph()
_investment_graph = build_investment_graph()
_research_graph = build_research_graph()
_content_graph = build_content_graph()
_academic_graph = build_academic_graph()

# Registry of running background asyncio tasks for cancellation
_running_tasks: dict[str, asyncio.Task] = {}


def _get_current_user(authorization: str | None) -> dict | None:
    """Decode JWT from Authorization header. Returns None if missing/invalid."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    try:
        return decode_token(token)
    except Exception:
        return None


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
async def create_task(body: TaskCreate, authorization: str = Header(None)):
    user = _get_current_user(authorization)
    user_id = user["sub"] if user else None

    pool = get_pool()
    async with pool.acquire() as conn:
        if user_id:
            row = await conn.fetchrow(
                "INSERT INTO tasks (goal, preset_id, user_id) VALUES ($1, $2, $3) RETURNING id, goal, status, created_at",
                body.goal,
                body.preset_id,
                uuid.UUID(user_id),
            )
        else:
            row = await conn.fetchrow(
                "INSERT INTO tasks (goal, preset_id) VALUES ($1, $2) RETURNING id, goal, status, created_at",
                body.goal,
                body.preset_id,
            )

    task_id = str(row["id"])

    # Register streaming callback before starting the task
    from streaming import register_stream, unregister_stream

    async def _stream_cb(role: str, token: str):
        await broadcast(task_id, {"type": "token", "agent": role, "content": token})

    register_stream(task_id, _stream_cb)

    # Run the agent graph in the background
    bg_task = asyncio.create_task(_run_graph(task_id, body.goal, preset_id=body.preset_id, web_search=body.web_search))
    _running_tasks[task_id] = bg_task

    return {"task_id": task_id, "status": "pending"}


@router.post("/{task_id}/cancel")
async def cancel_task(task_id: str):
    task = _running_tasks.pop(task_id, None)
    if task and not task.done():
        task.cancel()

    from streaming import unregister_stream
    unregister_stream(task_id)

    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE tasks SET status='cancelled', updated_at=NOW() WHERE id=$1",
            uuid.UUID(task_id),
        )
    await broadcast(task_id, {"type": "cancelled", "agent": "system", "content": "Task cancelled"})
    return {"cancelled": True}


@router.get("/{task_id}")
async def get_task(task_id: str, authorization: str = Header(None)):
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
        "preset_id": task["preset_id"],
        "created_at": task["created_at"].isoformat(),
        "subtasks": [dict(s) for s in subtasks],
        "messages": [dict(m) for m in messages],
    }


@router.get("/")
async def list_tasks(authorization: str = Header(None)):
    user = _get_current_user(authorization)
    pool = get_pool()
    async with pool.acquire() as conn:
        if user:
            rows = await conn.fetch(
                "SELECT id, goal, status, preset_id, created_at FROM tasks WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
                uuid.UUID(user["sub"]),
            )
        else:
            rows = await conn.fetch(
                "SELECT id, goal, status, preset_id, created_at FROM tasks ORDER BY created_at DESC LIMIT 50"
            )
    return [{"id": str(r["id"]), "goal": r["goal"], "status": r["status"], "preset_id": r["preset_id"], "created_at": r["created_at"].isoformat()} for r in rows]


@router.get("/{task_id}/files")
async def list_task_files(task_id: str):
    from storage.r2 import list_files
    return list_files(task_id)


@router.get("/{task_id}/files/{file_path:path}")
async def get_task_file(task_id: str, file_path: str):
    from storage.r2 import read_file
    content = read_file(task_id, file_path)
    if not content:
        raise HTTPException(404, "File not found")
    return PlainTextResponse(content)


@router.put("/{task_id}/files/{file_path:path}")
async def put_task_file(task_id: str, file_path: str, request: Request):
    from storage.r2 import write_file
    body = await request.body()
    content = body.decode("utf-8", errors="replace")
    result = write_file(task_id, file_path, content)
    return {"saved": True, "path": file_path, "size": len(body), "result": result}


async def _run_graph(task_id: str, goal: str, output_task_id: str | None = None, preset_id: str | None = None, web_search: bool = False):
    # ── Optionally enrich goal with live web context ───────────────
    if web_search:
        try:
            from agents.base import fetch_web_context
            web_ctx = await fetch_web_context(goal[:300])
            if web_ctx:
                goal = web_ctx + "\n\n---\n\n## Task\n" + goal
                print(f"[web_search] Injected {len(web_ctx)} chars of web context for task {task_id}")
        except Exception as e:
            print(f"[web_search] Failed to fetch context: {e}")

    # ── Custom preset: fetch from DB and run dynamically ──────────
    _builtin_ids = {"software-dev", "legal-review", "investment-analysis",
                    "research-intelligence", "content-marketing", "academic-review"}
    if preset_id and preset_id not in _builtin_ids:
        from orchestrator.custom_graph import fetch_preset_from_db, run_custom_preset
        preset_data = await fetch_preset_from_db(preset_id)
        if preset_data:
            try:
                await run_custom_preset(task_id, goal, preset_data)
            except asyncio.CancelledError:
                pass
            except Exception as e:
                import traceback
                print(f"[custom_graph ERROR] task={task_id} preset={preset_id}\n{traceback.format_exc()}")
                await broadcast(task_id, {"type": "error", "agent": "system", "content": str(e)})
                pool = get_pool()
                async with pool.acquire() as conn:
                    await conn.execute(
                        "UPDATE tasks SET status='failed', updated_at=NOW() WHERE id=$1",
                        uuid.UUID(task_id),
                    )
            finally:
                _running_tasks.pop(task_id, None)
                from streaming import unregister_stream
                unregister_stream(task_id)
            return
        # If preset not found in DB, fall through to software-dev graph

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
    except asyncio.CancelledError:
        # Task was cancelled — status already updated in cancel_task endpoint
        pass
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
    finally:
        # Cleanup
        _running_tasks.pop(task_id, None)
        from streaming import unregister_stream
        unregister_stream(task_id)
