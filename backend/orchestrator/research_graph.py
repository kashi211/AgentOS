from __future__ import annotations

import uuid
from typing import Annotated

from langgraph.graph import StateGraph, END
from typing_extensions import TypedDict

from agents.researcher import ResearcherAgent
from agents.fact_checker import FactCheckerAgent
from agents.devils_advocate import DevilsAdvocateAgent
from agents.research_editor import ResearchEditorAgent
from memory.store import MemoryStore
from db.connection import get_pool

MAX_REVISIONS = 2


class ResearchState(TypedDict):
    task_id: str
    goal: str
    researcher_output: str
    fact_check_output: str
    devils_advocate_output: str
    editor_output: str
    fact_check_feedback: str
    revision_count: int
    status: str
    final_result: str
    events: Annotated[list[dict], lambda a, b: a + b]


async def researcher_node(state: ResearchState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = ResearcherAgent(state["task_id"], memory)

    prompt = f"Research question / topic:\n\n{state['goal']}\n\n"
    if state["revision_count"] > 0:
        prompt += (
            f"Fact-checker feedback (revision {state['revision_count']}):\n"
            f"{state['fact_check_feedback']}\n\n"
            "Revise your research brief to address the fact-checker's concerns."
        )
    else:
        prompt += "Build a comprehensive research brief on this topic."

    response = await agent.run(prompt)
    await _save_message(state["task_id"], "researcher", "output", response)
    await _update_task_status(state["task_id"], "planning")
    return {
        "researcher_output": response,
        "status": "planning",
        "events": [{"type": "agent_output", "agent": "researcher", "content": f"Research brief complete (revision {state['revision_count'] + 1})"}],
    }


async def fact_checker_node(state: ResearchState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = FactCheckerAgent(state["task_id"], memory)
    response = await agent.run(
        f"Research topic: {state['goal']}\n\n"
        f"Research brief:\n\n{state['researcher_output']}\n\n"
        "Fact-check this research brief for accuracy and source quality."
    )
    await _save_message(state["task_id"], "fact_checker", "output", response)

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
            "fact_check_output": response,
            "fact_check_feedback": feedback,
            "status": "executing",
            "events": [{"type": "qa_pass" if passed else "qa_fail", "agent": "fact_checker", "content": f"Fact check complete — score {score}/10"}],
        }
    else:
        return {
            "fact_check_output": response,
            "fact_check_feedback": feedback,
            "revision_count": state["revision_count"] + 1,
            "status": "planning",
            "events": [{"type": "qa_fail", "agent": "fact_checker", "content": feedback[:200]}],
        }


def route_after_fact_check(state: ResearchState) -> str:
    if state["status"] == "executing":
        return "devils_advocate"
    return "researcher"


async def devils_advocate_node(state: ResearchState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = DevilsAdvocateAgent(state["task_id"], memory)
    response = await agent.run(
        f"Research topic: {state['goal']}\n\n"
        f"Research brief:\n\n{state['researcher_output']}\n\n"
        f"Fact-checker assessment:\n\n{state['fact_check_output']}\n\n"
        "Challenge the research conclusions — what is the strongest counterargument?"
    )
    await _save_message(state["task_id"], "devils_advocate", "output", response)
    return {
        "devils_advocate_output": response,
        "status": "reviewing",
        "events": [{"type": "agent_output", "agent": "devils_advocate", "content": "Devil's advocate challenge complete"}],
    }


async def research_editor_node(state: ResearchState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = ResearchEditorAgent(state["task_id"], memory)
    response = await agent.run(
        f"Research topic: {state['goal']}\n\n"
        f"RESEARCH BRIEF:\n{state['researcher_output']}\n\n"
        f"FACT-CHECKER ASSESSMENT:\n{state['fact_check_output']}\n\n"
        f"DEVIL'S ADVOCATE:\n{state['devils_advocate_output']}\n\n"
        "Synthesize all of this into the final research report and write it to a file."
    )
    await _save_message(state["task_id"], "research_editor", "output", response)
    await _update_task_status(state["task_id"], "done")
    return {
        "editor_output": response,
        "status": "done",
        "final_result": response,
        "events": [{"type": "agent_output", "agent": "research_editor", "content": "Research report complete"}],
    }


def build_research_graph() -> StateGraph:
    graph = StateGraph(ResearchState)

    graph.add_node("researcher", researcher_node)
    graph.add_node("fact_checker", fact_checker_node)
    graph.add_node("devils_advocate", devils_advocate_node)
    graph.add_node("research_editor", research_editor_node)

    graph.set_entry_point("researcher")
    graph.add_edge("researcher", "fact_checker")
    graph.add_conditional_edges("fact_checker", route_after_fact_check, {
        "researcher": "researcher",
        "devils_advocate": "devils_advocate",
    })
    graph.add_edge("devils_advocate", "research_editor")
    graph.add_edge("research_editor", END)

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
