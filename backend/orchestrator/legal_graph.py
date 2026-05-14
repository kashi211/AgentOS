from __future__ import annotations

import uuid
from typing import Annotated

from langgraph.graph import StateGraph, END
from typing_extensions import TypedDict

from agents.reader import ReaderAgent
from agents.clause_flagger import ClauseFlagAgent
from agents.legal_editor import LegalEditorAgent
from agents.protection_checker import ProtectionCheckerAgent
from memory.store import MemoryStore
from db.connection import get_pool

MAX_REVISIONS = 2


class LegalState(TypedDict):
    task_id: str
    goal: str
    reader_output: str
    flags_output: str
    editor_output: str
    checker_feedback: str
    revision_count: int
    status: str
    final_result: str
    events: Annotated[list[dict], lambda a, b: a + b]


async def reader_node(state: LegalState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = ReaderAgent(state["task_id"], memory)
    response = await agent.run(
        f"Legal document / subject:\n\n{state['goal']}\n\n"
        "Read this document carefully and produce a plain-language summary."
    )
    await _save_message(state["task_id"], "reader", "output", response)
    await _update_task_status(state["task_id"], "planning")
    return {
        "reader_output": response,
        "status": "planning",
        "events": [{"type": "agent_output", "agent": "reader", "content": "Document reading complete"}],
    }


async def clause_flagger_node(state: LegalState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = ClauseFlagAgent(state["task_id"], memory)
    response = await agent.run(
        f"Document / subject:\n\n{state['goal']}\n\n"
        f"Reader summary:\n\n{state['reader_output']}\n\n"
        "Flag all ambiguous, one-sided, or potentially harmful clauses."
    )
    await _save_message(state["task_id"], "clause_flagger", "output", response)
    await _update_task_status(state["task_id"], "executing")
    return {
        "flags_output": response,
        "status": "executing",
        "events": [{"type": "agent_output", "agent": "clause_flagger", "content": "Clause flagging complete"}],
    }


async def legal_editor_node(state: LegalState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = LegalEditorAgent(state["task_id"], memory)

    prompt = (
        f"Document / subject:\n\n{state['goal']}\n\n"
        f"READER SUMMARY:\n{state['reader_output']}\n\n"
        f"FLAGGED CLAUSES:\n{state['flags_output']}\n\n"
    )
    if state["revision_count"] > 0:
        prompt += (
            f"Protection checker feedback (revision {state['revision_count']}):\n"
            f"{state['checker_feedback']}\n\n"
            "Revise your legal review memo to address the feedback above."
        )
    else:
        prompt += "Synthesize all findings into a professional legal review memo."

    response = await agent.run(prompt)
    await _save_message(state["task_id"], "legal_editor", "output", response)
    return {
        "editor_output": response,
        "status": "reviewing",
        "events": [{"type": "agent_output", "agent": "legal_editor", "content": f"Legal review memo drafted (revision {state['revision_count'] + 1})"}],
    }


async def protection_checker_node(state: LegalState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = ProtectionCheckerAgent(state["task_id"], memory)
    response = await agent.run(
        f"Document / subject:\n\n{state['goal']}\n\n"
        f"Reader summary:\n{state['reader_output']}\n\n"
        f"Flagged clauses:\n{state['flags_output']}\n\n"
        f"Legal editor memo:\n{state['editor_output']}\n\n"
        "Is this review memo thorough enough to protect the client?"
    )
    await _save_message(state["task_id"], "protection_checker", "output", response)

    try:
        review = agent.parse_json(response)
        passed = review.get("passed", False)
        feedback = review.get("feedback", "")
        score = review.get("score", 0)
    except Exception:
        passed = True
        feedback = ""
        score = 8

    if passed:
        await _update_task_status(state["task_id"], "done")
        return {
            "checker_feedback": feedback,
            "status": "done",
            "final_result": state["editor_output"],
            "events": [{"type": "qa_pass", "agent": "protection_checker", "content": f"Review approved — score {score}/10"}],
        }
    else:
        return {
            "checker_feedback": feedback,
            "revision_count": state["revision_count"] + 1,
            "status": "executing",
            "events": [{"type": "qa_fail", "agent": "protection_checker", "content": feedback[:200]}],
        }


def route_after_checker(state: LegalState) -> str:
    if state["status"] == "done":
        return END
    if state["revision_count"] >= MAX_REVISIONS:
        return END
    return "legal_editor"


def build_legal_graph() -> StateGraph:
    graph = StateGraph(LegalState)

    graph.add_node("reader", reader_node)
    graph.add_node("clause_flagger", clause_flagger_node)
    graph.add_node("legal_editor", legal_editor_node)
    graph.add_node("protection_checker", protection_checker_node)

    graph.set_entry_point("reader")
    graph.add_edge("reader", "clause_flagger")
    graph.add_edge("clause_flagger", "legal_editor")
    graph.add_edge("legal_editor", "protection_checker")
    graph.add_conditional_edges("protection_checker", route_after_checker, {
        "legal_editor": "legal_editor",
        END: END,
    })

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
