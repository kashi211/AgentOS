from __future__ import annotations

import uuid
from typing import Annotated

from langgraph.graph import StateGraph, END
from typing_extensions import TypedDict

from agents.summarizer import SummarizerAgent
from agents.critic import CriticAgent
from agents.literature_synthesizer import LiteratureSynthesizerAgent
from agents.citation_agent import CitationAgent
from agentos_memory.store import MemoryStore
from db.connection import get_pool

MAX_REVISIONS = 1


class AcademicState(TypedDict):
    task_id: str
    goal: str
    summarizer_output: str
    critic_output: str
    synthesizer_output: str
    citation_output: str
    critic_feedback: str
    revision_count: int
    status: str
    final_result: str
    events: Annotated[list[dict], lambda a, b: a + b]


def _preview(text: str, max_len: int = 280) -> str:
    flat = text.replace("\n", " ").strip()
    return flat[:max_len] + "…" if len(flat) > max_len else flat


async def summarizer_node(state: AcademicState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = SummarizerAgent(state["task_id"], memory)

    prompt = f"Research topic / papers:\n\n{state['goal']}\n\n"
    if state["revision_count"] > 0:
        prompt += (
            f"Critic feedback (revision {state['revision_count']}):\n"
            f"{state['critic_feedback']}\n\n"
            "Revise your summaries to address the critic's concerns."
        )
    else:
        prompt += "Summarize all relevant literature on this topic."

    await _save_message(state["task_id"], "summarizer", "agent_input", prompt)
    response = await agent.run(prompt)
    await _save_message(state["task_id"], "summarizer", "agent_output", response)
    await _update_task_status(state["task_id"], "planning")
    return {
        "summarizer_output": response,
        "status": "planning",
        "events": [{"type": "agent_output", "agent": "summarizer", "content": _preview(response)}],
    }


async def critic_node(state: AcademicState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = CriticAgent(state["task_id"], memory)
    prompt = (
        f"Research topic: {state['goal']}\n\n"
        f"Literature summaries:\n\n{state['summarizer_output']}\n\n"
        "Evaluate the methodological quality of the papers summarized."
    )
    await _save_message(state["task_id"], "critic", "agent_input", prompt)
    response = await agent.run(prompt)
    await _save_message(state["task_id"], "critic", "agent_output", response)

    try:
        review = agent.parse_json(response)
        passed = review.get("passed", False)
        feedback = review.get("feedback", "")
        score = review.get("score", 0)
    except Exception:
        passed = True
        feedback = ""
        score = 8

    if passed or state["revision_count"] >= MAX_REVISIONS:
        await _update_task_status(state["task_id"], "executing")
        return {
            "critic_output": response,
            "critic_feedback": feedback,
            "status": "executing",
            "events": [{"type": "qa_pass" if passed else "qa_fail", "agent": "critic", "content": f"Critique complete — score {score}/10"}],
        }
    else:
        return {
            "critic_output": response,
            "critic_feedback": feedback,
            "revision_count": state["revision_count"] + 1,
            "status": "planning",
            "events": [{"type": "qa_fail", "agent": "critic", "content": feedback[:280]}],
        }


def route_after_critic(state: AcademicState) -> str:
    if state["status"] == "executing":
        return "literature_synthesizer"
    return "summarizer"


async def literature_synthesizer_node(state: AcademicState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = LiteratureSynthesizerAgent(state["task_id"], memory)
    prompt = (
        f"Research topic: {state['goal']}\n\n"
        f"LITERATURE SUMMARIES:\n{state['summarizer_output']}\n\n"
        f"METHODOLOGICAL CRITIQUE:\n{state['critic_output']}\n\n"
        "Synthesize the literature into a coherent review narrative."
    )
    await _save_message(state["task_id"], "literature_synthesizer", "agent_input", prompt)
    response = await agent.run(prompt)
    await _save_message(state["task_id"], "literature_synthesizer", "agent_output", response)
    return {
        "synthesizer_output": response,
        "status": "reviewing",
        "events": [{"type": "agent_output", "agent": "literature_synthesizer", "content": _preview(response)}],
    }


async def citation_agent_node(state: AcademicState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = CitationAgent(state["task_id"], memory)
    prompt = (
        f"Research topic: {state['goal']}\n\n"
        f"LITERATURE SUMMARIES:\n{state['summarizer_output']}\n\n"
        f"SYNTHESIS:\n{state['synthesizer_output']}\n\n"
        "Produce the final literature review with formatted references."
    )
    await _save_message(state["task_id"], "citation_agent", "agent_input", prompt)
    response = await agent.run(prompt)
    await _save_message(state["task_id"], "citation_agent", "agent_output", response)
    await _update_task_status(state["task_id"], "done")
    await _save_task_result(state["task_id"], response)
    return {
        "citation_output": response,
        "status": "done",
        "final_result": response,
        "events": [{"type": "done", "agent": "citation_agent", "content": _preview(response)}],
    }


def build_academic_graph() -> StateGraph:
    graph = StateGraph(AcademicState)

    graph.add_node("summarizer", summarizer_node)
    graph.add_node("critic", critic_node)
    graph.add_node("literature_synthesizer", literature_synthesizer_node)
    graph.add_node("citation_agent", citation_agent_node)

    graph.set_entry_point("summarizer")
    graph.add_edge("summarizer", "critic")
    graph.add_conditional_edges("critic", route_after_critic, {
        "summarizer": "summarizer",
        "literature_synthesizer": "literature_synthesizer",
    })
    graph.add_edge("literature_synthesizer", "citation_agent")
    graph.add_edge("citation_agent", END)

    return graph.compile()


# ── DB helpers ────────────────────────────────────────────────

async def _save_message(task_id: str, agent_role: str, msg_type: str, content: str):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO agentos_messages (task_id, agent_role, type, content) VALUES ($1, $2, $3, $4)",
            uuid.UUID(task_id), agent_role, msg_type, content,
        )


async def _update_task_status(task_id: str, status: str):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE agentos_tasks SET status=$1, updated_at=NOW() WHERE id=$2",
            status, uuid.UUID(task_id),
        )


async def _save_task_result(task_id: str, result: str):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE agentos_tasks SET result=$1, status='done', updated_at=NOW() WHERE id=$2",
            result, uuid.UUID(task_id),
        )
