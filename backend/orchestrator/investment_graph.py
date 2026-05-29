from __future__ import annotations

import uuid
from typing import Annotated

from langgraph.graph import StateGraph, END
from typing_extensions import TypedDict

from agents.analyst import AnalystAgent
from agents.bear_case import BearCaseAgent
from agents.risk_agent import RiskAgent
from agents.synthesizer import SynthesizerAgent
from agentos_memory.store import MemoryStore
from db.connection import get_pool

MAX_REVISIONS = 2


class InvestmentState(TypedDict):
    task_id: str
    goal: str
    analyst_output: str
    bear_output: str
    risk_feedback: str
    synthesizer_output: str
    revision_count: int
    status: str
    final_result: str
    events: Annotated[list[dict], lambda a, b: a + b]


def _preview(text: str, max_len: int = 280) -> str:
    flat = text.replace("\n", " ").strip()
    return flat[:max_len] + "…" if len(flat) > max_len else flat


async def analyst_node(state: InvestmentState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = AnalystAgent(state["task_id"], memory)
    prompt = (
        f"Investment question / subject:\n\n{state['goal']}\n\n"
        "Build the comprehensive bull case investment analysis."
    )
    await _save_message(state["task_id"], "analyst", "agent_input", prompt)
    response = await agent.run(prompt)
    await _save_message(state["task_id"], "analyst", "agent_output", response)
    await _update_task_status(state["task_id"], "planning")
    return {
        "analyst_output": response,
        "status": "planning",
        "events": [{"type": "agent_output", "agent": "analyst", "content": _preview(response)}],
    }


async def bear_case_node(state: InvestmentState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = BearCaseAgent(state["task_id"], memory)
    prompt = (
        f"Investment subject: {state['goal']}\n\n"
        f"Bull case analysis:\n\n{state['analyst_output']}\n\n"
        "Now build the strongest possible bear case against this thesis."
    )
    await _save_message(state["task_id"], "bear_case", "agent_input", prompt)
    response = await agent.run(prompt)
    await _save_message(state["task_id"], "bear_case", "agent_output", response)
    await _update_task_status(state["task_id"], "executing")
    return {
        "bear_output": response,
        "status": "executing",
        "events": [{"type": "agent_output", "agent": "bear_case", "content": _preview(response)}],
    }


async def synthesizer_node(state: InvestmentState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = SynthesizerAgent(state["task_id"], memory)

    prompt = (
        f"Investment subject: {state['goal']}\n\n"
        f"BULL CASE:\n{state['analyst_output']}\n\n"
        f"BEAR CASE:\n{state['bear_output']}\n\n"
    )
    if state["revision_count"] > 0:
        prompt += (
            f"Risk agent feedback (revision {state['revision_count']}):\n"
            f"{state['risk_feedback']}\n\n"
            "Revise your investment memo to address the feedback above."
        )
    else:
        prompt += "Synthesize both views into a decisive investment memo."

    await _save_message(state["task_id"], "synthesizer", "agent_input", prompt)
    response = await agent.run(prompt)
    await _save_message(state["task_id"], "synthesizer", "agent_output", response)
    return {
        "synthesizer_output": response,
        "status": "reviewing",
        "events": [{"type": "agent_output", "agent": "synthesizer", "content": _preview(response)}],
    }


async def risk_agent_node(state: InvestmentState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = RiskAgent(state["task_id"], memory)
    prompt = (
        f"Investment subject: {state['goal']}\n\n"
        f"Bull case:\n{state['analyst_output']}\n\n"
        f"Bear case:\n{state['bear_output']}\n\n"
        f"Synthesizer memo:\n{state['synthesizer_output']}\n\n"
        "Evaluate whether this analysis is thorough enough to support an investment decision."
    )
    await _save_message(state["task_id"], "risk_agent", "agent_input", prompt)
    response = await agent.run(prompt)
    await _save_message(state["task_id"], "risk_agent", "agent_output", response)

    try:
        review = agent.parse_json(response)
        passed = review.get("passed", False)
        feedback = review.get("feedback", "")
        score = review.get("score", 0)
    except Exception:
        passed = True
        feedback = ""
        score = 7

    if passed:
        await _update_task_status(state["task_id"], "done")
        await _save_task_result(state["task_id"], state["synthesizer_output"])
        return {
            "risk_feedback": feedback,
            "status": "done",
            "final_result": state["synthesizer_output"],
            "events": [{"type": "qa_pass", "agent": "risk_agent", "content": f"Analysis approved — score {score}/10"}],
        }
    else:
        return {
            "risk_feedback": feedback,
            "revision_count": state["revision_count"] + 1,
            "status": "executing",
            "events": [{"type": "qa_fail", "agent": "risk_agent", "content": feedback[:280]}],
        }


async def finalize_node(state: InvestmentState) -> dict:
    """Called when max revisions hit — marks task done and broadcasts completion."""
    await _update_task_status(state["task_id"], "done")
    await _save_task_result(state["task_id"], state["synthesizer_output"])
    return {
        "status": "done",
        "final_result": state["synthesizer_output"],
        "events": [{"type": "done_escalated", "agent": "risk_agent", "content": "Max revisions reached — delivering best synthesis as final output"}],
    }


def route_after_risk(state: InvestmentState) -> str:
    if state["status"] == "done":
        return "finalize"
    if state["revision_count"] >= MAX_REVISIONS:
        return "finalize"
    return "synthesizer"


def build_investment_graph() -> StateGraph:
    graph = StateGraph(InvestmentState)

    graph.add_node("analyst", analyst_node)
    graph.add_node("bear_case", bear_case_node)
    graph.add_node("synthesizer", synthesizer_node)
    graph.add_node("risk_agent", risk_agent_node)
    graph.add_node("finalize", finalize_node)

    graph.set_entry_point("analyst")
    graph.add_edge("analyst", "bear_case")
    graph.add_edge("bear_case", "synthesizer")
    graph.add_edge("synthesizer", "risk_agent")
    graph.add_conditional_edges("risk_agent", route_after_risk, {
        "synthesizer": "synthesizer",
        "finalize": "finalize",
    })
    graph.add_edge("finalize", END)

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
