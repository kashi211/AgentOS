"""Generate a short TL;DR summary for a completed task."""
from __future__ import annotations

import uuid
from functools import lru_cache

import anthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import settings
from db.connection import get_pool

router = APIRouter()
client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

_HAIKU = "claude-haiku-4-5-20251001"

# In-memory cache so we don't regenerate on every page visit
_cache: dict[str, str] = {}

_SYSTEM = """You write a single short paragraph — 2 to 3 sentences max — that summarises what was accomplished in a completed AI agent task.

Rules:
- Be concrete and specific: mention actual outputs, decisions, or artefacts produced
- No filler phrases like "The agents successfully..." or "In this task..."
- Start directly with what was done or produced
- Plain prose only, no bullet points, no markdown headers
- If it was a research/analysis task, state the main finding or conclusion
- If it was a coding task, state what was built and its key features
- Under 60 words total"""


class SummaryResponse(BaseModel):
    summary: str


@router.get("/{task_id}/summary", response_model=SummaryResponse)
async def get_task_summary(task_id: str) -> SummaryResponse:
    # Return cached summary if available
    if task_id in _cache:
        return SummaryResponse(summary=_cache[task_id])

    pool = get_pool()
    async with pool.acquire() as conn:
        # Verify task exists and is done
        task = await conn.fetchrow(
            "SELECT status, goal FROM agentos_tasks WHERE id=$1", uuid.UUID(task_id)
        )
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        if task["status"] != "done":
            raise HTTPException(status_code=400, detail="Task not complete yet")

        # Fetch all agent outputs — prefer final/writer-type roles, fall back to all
        rows = await conn.fetch(
            """SELECT agent_role, content FROM agentos_messages
               WHERE task_id=$1 AND type='agent_output'
               ORDER BY created_at ASC""",
            uuid.UUID(task_id),
        )

    if not rows:
        return SummaryResponse(summary="Task completed with no recorded output.")

    # Build a condensed context: include final deliverable roles first, then others
    final_roles = {"writer", "editor", "citation_agent", "legal_editor",
                   "content_editor", "literature_synthesizer", "synthesizer"}
    final_msgs = [r for r in rows if r["agent_role"] in final_roles]
    other_msgs  = [r for r in rows if r["agent_role"] not in final_roles]

    # Take the last final output (the deliverable) + a few other agent outputs for context
    context_parts: list[str] = []
    if final_msgs:
        last = final_msgs[-1]
        snippet = last["content"][:3000]
        context_parts.append(f"[Final deliverable — {last['agent_role']}]\n{snippet}")
    for r in other_msgs[-3:]:
        snippet = r["content"][:800]
        context_parts.append(f"[{r['agent_role']}]\n{snippet}")

    context = "\n\n---\n\n".join(context_parts)
    user_msg = (
        f"Original goal: {task['goal']}\n\n"
        f"Agent outputs:\n{context}\n\n"
        "Write the TL;DR summary now."
    )

    try:
        resp = await client.messages.create(
            model=_HAIKU,
            max_tokens=200,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
        summary = resp.content[0].text.strip()
    except Exception as e:
        print(f"[summary] generation failed: {e}")
        summary = "Task completed successfully."

    _cache[task_id] = summary
    return SummaryResponse(summary=summary)
