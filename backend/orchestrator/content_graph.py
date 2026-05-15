from __future__ import annotations

import uuid
from typing import Annotated

from langgraph.graph import StateGraph, END
from typing_extensions import TypedDict

from agents.content_writer import ContentWriterAgent
from agents.seo_agent import SEOAgent
from agents.brand_voice import BrandVoiceAgent
from agents.content_editor import ContentEditorAgent
from memory.store import MemoryStore
from db.connection import get_pool


class ContentState(TypedDict):
    task_id: str
    goal: str
    writer_output: str
    seo_output: str
    brand_output: str
    editor_output: str
    status: str
    final_result: str
    events: Annotated[list[dict], lambda a, b: a + b]


def _preview(text: str, max_len: int = 280) -> str:
    flat = text.replace("\n", " ").strip()
    return flat[:max_len] + "…" if len(flat) > max_len else flat


async def content_writer_node(state: ContentState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = ContentWriterAgent(state["task_id"], memory)
    prompt = (
        f"Content brief:\n\n{state['goal']}\n\n"
        "Write a compelling, well-structured piece of content based on this brief."
    )
    await _save_message(state["task_id"], "content_writer", "agent_input", prompt)
    response = await agent.run(prompt)
    await _save_message(state["task_id"], "content_writer", "agent_output", response)
    await _update_task_status(state["task_id"], "planning")
    return {
        "writer_output": response,
        "status": "planning",
        "events": [{"type": "agent_output", "agent": "content_writer", "content": _preview(response)}],
    }


async def seo_agent_node(state: ContentState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = SEOAgent(state["task_id"], memory)
    prompt = (
        f"Content topic: {state['goal']}\n\n"
        f"Draft:\n\n{state['writer_output']}\n\n"
        "Optimize this content for search discoverability."
    )
    await _save_message(state["task_id"], "seo_agent", "agent_input", prompt)
    response = await agent.run(prompt)
    await _save_message(state["task_id"], "seo_agent", "agent_output", response)
    await _update_task_status(state["task_id"], "executing")
    return {
        "seo_output": response,
        "status": "executing",
        "events": [{"type": "agent_output", "agent": "seo_agent", "content": _preview(response)}],
    }


async def brand_voice_node(state: ContentState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = BrandVoiceAgent(state["task_id"], memory)
    prompt = (
        f"Content topic: {state['goal']}\n\n"
        f"SEO-optimized draft:\n\n{state['seo_output']}\n\n"
        "Review and correct the tone, voice, and brand consistency."
    )
    await _save_message(state["task_id"], "brand_voice", "agent_input", prompt)
    response = await agent.run(prompt)
    await _save_message(state["task_id"], "brand_voice", "agent_output", response)
    return {
        "brand_output": response,
        "status": "reviewing",
        "events": [{"type": "agent_output", "agent": "brand_voice", "content": _preview(response)}],
    }


async def content_editor_node(state: ContentState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = ContentEditorAgent(state["task_id"], memory)
    prompt = (
        f"Content topic: {state['goal']}\n\n"
        f"Brand-reviewed draft:\n\n{state['brand_output']}\n\n"
        "Tighten into the final publish-ready version."
    )
    await _save_message(state["task_id"], "content_editor", "agent_input", prompt)
    response = await agent.run(prompt)
    await _save_message(state["task_id"], "content_editor", "agent_output", response)
    await _update_task_status(state["task_id"], "done")
    await _save_task_result(state["task_id"], response)
    return {
        "editor_output": response,
        "status": "done",
        "final_result": response,
        "events": [{"type": "done", "agent": "content_editor", "content": _preview(response)}],
    }


def build_content_graph() -> StateGraph:
    graph = StateGraph(ContentState)

    graph.add_node("content_writer", content_writer_node)
    graph.add_node("seo_agent", seo_agent_node)
    graph.add_node("brand_voice", brand_voice_node)
    graph.add_node("content_editor", content_editor_node)

    graph.set_entry_point("content_writer")
    graph.add_edge("content_writer", "seo_agent")
    graph.add_edge("seo_agent", "brand_voice")
    graph.add_edge("brand_voice", "content_editor")
    graph.add_edge("content_editor", END)

    return graph.compile()


# ── DB helpers ────────────────────────────────────────────────

async def _save_message(task_id: str, agent_role: str, msg_type: str, content: str):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO messages (task_id, agent_role, type, content) VALUES ($1, $2, $3, $4)",
            uuid.UUID(task_id), agent_role, msg_type, content,
        )


async def _update_task_status(task_id: str, status: str):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE tasks SET status=$1, updated_at=NOW() WHERE id=$2",
            status, uuid.UUID(task_id),
        )


async def _save_task_result(task_id: str, result: str):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE tasks SET result=$1, status='done', updated_at=NOW() WHERE id=$2",
            result, uuid.UUID(task_id),
        )
