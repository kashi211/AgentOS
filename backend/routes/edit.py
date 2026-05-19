import asyncio
import os
import re
import shutil
import uuid

_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db.connection import get_pool
from orchestrator.graph import build_graph
from routes.ws import broadcast

router = APIRouter()
_graph = build_graph()


class EditRequest(BaseModel):
    message: str


@router.post("/{task_id}/edit", status_code=202)
async def edit_project(task_id: str, body: EditRequest):
    pool = get_pool()

    # Load the original task
    async with pool.acquire() as conn:
        original = await conn.fetchrow("SELECT * FROM tasks WHERE id=$1", uuid.UUID(task_id))
    if not original:
        raise HTTPException(404, "Project not found")

    # Snapshot existing output files so agents can read them
    original_output = os.path.join("output", task_id)
    file_listing = _build_file_listing(original_output)

    # Construct a rich goal for the agent team
    edit_goal = (
        f"EDIT REQUEST for existing project: {body.message}\n\n"
        f"Original project goal: {original['goal']}\n\n"
        f"Existing project files (use read_file to inspect before changing):\n{file_listing}\n\n"
        "Important:\n"
        "- Read existing files before modifying them\n"
        "- Make targeted, minimal changes — don't rewrite unrelated parts\n"
        "- Preserve working functionality\n"
        "- Write all changed files back using write_file"
    )

    # Create a new task record for this edit run
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO tasks (goal, status, parent_task_id) VALUES ($1, 'pending', $2) RETURNING id",
            f"[Edit] {body.message}",
            uuid.UUID(task_id),
        )
    edit_task_id = str(row["id"])

    # Copy existing files into the edit task's staging dir so Developer can read_file them
    edit_staging = os.path.join("output", edit_task_id)
    if os.path.isdir(original_output):
        shutil.copytree(original_output, edit_staging, dirs_exist_ok=True)

    # Run the full multi-agent graph in the background
    # output_task_id = original task_id so Developer writes back to the project dir
    asyncio.create_task(_run_edit(edit_task_id, edit_goal, output_task_id=task_id))

    return {"edit_task_id": edit_task_id}


def _build_file_listing(output_dir: str) -> str:
    if not os.path.isdir(output_dir):
        return "(no files yet)"
    lines = []
    for root, dirs, filenames in os.walk(output_dir):
        dirs[:] = [d for d in dirs if not _UUID_RE.match(d)]
        for name in sorted(filenames):
            full = os.path.join(root, name)
            rel = os.path.relpath(full, output_dir)
            size_kb = os.path.getsize(full) / 1024
            lines.append(f"  - {rel} ({size_kb:.1f} KB)")
    return "\n".join(lines) if lines else "(no files yet)"


async def _run_edit(edit_task_id: str, goal: str, output_task_id: str):
    initial_state = {
        "task_id": edit_task_id,
        "output_task_id": output_task_id,
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

    pool = get_pool()
    try:
        async for chunk in _graph.astream(initial_state):
            for node_name, state_update in chunk.items():
                for event in state_update.get("events", []):
                    await broadcast(edit_task_id, {**event, "node": node_name})
    except Exception as e:
        await broadcast(edit_task_id, {"type": "error", "agent": "system", "content": str(e)})
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE tasks SET status='failed', updated_at=NOW() WHERE id=$1",
                uuid.UUID(edit_task_id),
            )
