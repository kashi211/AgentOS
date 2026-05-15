"""
Background task worker.

Responsibilities:
  1. On startup: re-run any tasks that were interrupted (server crash / restart)
     by detecting tasks in non-terminal states that have no active asyncio task.
  2. Ongoing: poll every 120 s for tasks that got stuck mid-run (e.g. asyncio
     task died silently) and re-run them automatically.

Tasks are re-run from scratch: old messages/subtasks are cleared first so the
UI shows a clean replay rather than duplicated output.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    pass

_STUCK_AFTER_SECONDS = 300  # re-run tasks not updated in 5 min while still in-progress
_POLL_INTERVAL = 120          # check every 2 minutes


async def rerun_task(task_id: str, goal: str, preset_id: str | None, web_search: bool) -> None:
    """Clear previous output and re-run a task from scratch."""
    from db.connection import get_pool
    from routes.tasks import _running_tasks, _run_graph
    from streaming import register_stream
    from routes.ws import broadcast

    if task_id in _running_tasks and not _running_tasks[task_id].done():
        return  # already running

    pool = get_pool()
    async with pool.acquire() as conn:
        # Wipe partial output so we don't show duplicate messages
        await conn.execute("DELETE FROM messages WHERE task_id=$1", uuid.UUID(task_id))
        await conn.execute("DELETE FROM subtasks WHERE task_id=$1", uuid.UUID(task_id))
        await conn.execute(
            "UPDATE tasks SET status='pending', result=NULL, updated_at=NOW() WHERE id=$1",
            uuid.UUID(task_id),
        )

    print(f"[worker] Re-running task {task_id} (goal: {goal[:60]}…)")

    async def _stream_cb(role: str, token: str):
        await broadcast(task_id, {"type": "token", "agent": role, "content": token})

    register_stream(task_id, _stream_cb)

    bg = asyncio.create_task(_run_graph(task_id, goal, preset_id=preset_id, web_search=web_search))
    _running_tasks[task_id] = bg


async def recover_on_startup() -> None:
    """Called once at startup to re-run tasks that were in-progress when the server last shut down."""
    from db.connection import get_pool

    pool = get_pool()
    async with pool.acquire() as conn:
        stuck = await conn.fetch(
            """
            SELECT id, goal, preset_id, COALESCE(web_search, FALSE) AS web_search
            FROM tasks
            WHERE status IN ('pending', 'planning', 'executing', 'reviewing')
            ORDER BY created_at
            """
        )

    if not stuck:
        print("[worker] No orphaned tasks found at startup.")
        return

    print(f"[worker] Found {len(stuck)} orphaned task(s) — re-running…")
    for row in stuck:
        try:
            await rerun_task(
                task_id=str(row["id"]),
                goal=row["goal"],
                preset_id=row["preset_id"],
                web_search=bool(row["web_search"]),
            )
        except Exception as e:
            print(f"[worker] Failed to re-run task {row['id']}: {e}")


async def background_poller() -> None:
    """Continuously polls for tasks that got stuck and restarts them."""
    from db.connection import get_pool
    from routes.tasks import _running_tasks

    while True:
        await asyncio.sleep(_POLL_INTERVAL)
        try:
            pool = get_pool()
            async with pool.acquire() as conn:
                stuck = await conn.fetch(
                    f"""
                    SELECT id, goal, preset_id, COALESCE(web_search, FALSE) AS web_search
                    FROM tasks
                    WHERE status IN ('pending', 'planning', 'executing', 'reviewing')
                      AND updated_at < NOW() - INTERVAL '{_STUCK_AFTER_SECONDS} seconds'
                    ORDER BY created_at
                    """
                )

            for row in stuck:
                task_id = str(row["id"])
                # Skip tasks actively being processed in this process
                t = _running_tasks.get(task_id)
                if t and not t.done():
                    continue
                print(f"[worker] Detected stuck task {task_id} — re-running…")
                try:
                    await rerun_task(
                        task_id=task_id,
                        goal=row["goal"],
                        preset_id=row["preset_id"],
                        web_search=bool(row["web_search"]),
                    )
                except Exception as e:
                    print(f"[worker] Failed to re-run task {task_id}: {e}")
        except Exception as e:
            print(f"[worker] Poller error: {e}")
