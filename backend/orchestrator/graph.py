from __future__ import annotations

import json
import os
import uuid
from typing import Annotated, Any

from langgraph.graph import StateGraph, END
from typing_extensions import TypedDict

from agents.ceo import CEOAgent
from agents.planner import PlannerAgent
from agents.developer import DeveloperAgent
from agents.worker import WorkerAgent
from agents.qa import QAAgent
from agents.writer import WriterAgent
from memory.store import MemoryStore
from db.connection import get_pool

MAX_REVISIONS = 2

# Agent roles that should use DeveloperAgent (code-writing tools)
_CODE_ROLES = {"developer", "coder", "programmer", "engineer", "frontend", "backend", "fullstack"}


def _workflow_config() -> dict:
    try:
        with open("agent_configs.json") as f:
            return json.load(f).get("workflow", {})
    except Exception:
        return {}


class AgentState(TypedDict):
    task_id: str
    output_task_id: str       # where Developer writes files (same as task_id unless editing)
    goal: str
    plan: list[dict]          # CEO's subtask list
    steps: list[dict]         # Planner's detailed steps
    current_step_idx: int
    agent_outputs: dict[str, str]
    revision_count: int
    status: str
    final_result: str
    events: Annotated[list[dict], lambda a, b: a + b]  # append-only event log


# ── Node functions ────────────────────────────────────────────

async def ceo_node(state: AgentState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = CEOAgent(state["task_id"], memory)
    ceo_input = f"New goal received:\n\n{state['goal']}\n\nProduce the execution plan."
    await _save_message(state["task_id"], "ceo", "agent_input", ceo_input)
    response = await agent.run(ceo_input)
    try:
        plan_data = agent.parse_json(response)
        plan = plan_data.get("subtasks", [])
        summary = plan_data.get("summary", state["goal"])
    except Exception:
        plan = []
        summary = state["goal"]

    await _save_message(state["task_id"], "ceo", "agent_output", response)
    await _update_task_status(state["task_id"], "planning")

    return {
        "plan": plan,
        "status": "planning",
        "events": [{"type": "agent_output", "agent": "ceo", "content": summary}],
    }


async def planner_node(state: AgentState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = PlannerAgent(state["task_id"], memory)
    planner_input = (
        f"Goal: {state['goal']}\n\nCEO plan:\n{json.dumps(state['plan'], indent=2)}\n\n"
        "Produce the detailed step-by-step execution plan."
    )
    await _save_message(state["task_id"], "planner", "agent_input", planner_input)
    response = await agent.run(planner_input)
    try:
        steps_data = agent.parse_json(response)
        steps = steps_data.get("steps", [])
    except Exception:
        steps = []

    await _save_message(state["task_id"], "planner", "agent_output", response)
    await _update_task_status(state["task_id"], "executing")

    return {
        "steps": steps,
        "current_step_idx": 0,
        "status": "executing",
        "events": [{"type": "agent_output", "agent": "planner", "content": f"{len(steps)} steps planned"}],
    }


async def developer_node(state: AgentState) -> dict:
    memory = MemoryStore(state["task_id"])

    steps = state["steps"]
    idx = state["current_step_idx"]
    step = steps[idx] if idx < len(steps) else None

    if not step:
        return {"status": "reviewing", "events": []}

    # Determine agent role from the planner's step definition
    step_role = step.get("agent", "developer").lower().replace(" ", "_")
    is_code = step_role in _CODE_ROLES

    if is_code:
        agent = DeveloperAgent(state["task_id"], memory, output_task_id=state.get("output_task_id"))
        save_role = step_role if step_role != "developer" else "developer"
    else:
        agent = WorkerAgent(state["task_id"], memory, role_name=step_role)
        save_role = step_role

    context = (
        f"Task: {state['goal']}\n\n"
        f"Your step ({idx + 1}/{len(steps)}):\n"
        f"Title: {step['title']}\n"
        f"Description: {step['description']}\n\n"
        f"Previous outputs:\n{json.dumps(state['agent_outputs'], indent=2)}"
    )

    if state["revision_count"] > 0:
        context += (
            f"\n\nQA feedback (revision {state['revision_count']}):\n"
            f"{state['agent_outputs'].get('qa_feedback', '')}\n\n"
            "IMPORTANT: your previous attempt may have already modified the files on disk. "
            "Use read_file to check the current state first. "
            "If the requested change is already present, confirm that in your summary and PASS — do not re-apply changes that are already there. "
            "If the change is missing or wrong, fix it and write the file."
        )

    # Save agent input so frontend can show what was passed between agents
    await _save_message(state["task_id"], save_role, "agent_input", context)

    response = await agent.run(context)

    await _save_message(state["task_id"], save_role, "agent_output", response)
    await _save_subtask(state["task_id"], save_role, step["description"], "done", response)

    # Broadcast a meaningful content preview (not just "Step N complete")
    preview = response.replace("\n", " ").strip()
    preview = preview[:280] + "…" if len(preview) > 280 else preview

    outputs = {**state["agent_outputs"], f"step_{idx}": response}
    return {
        "agent_outputs": outputs,
        "status": "reviewing",
        "events": [{"type": "agent_output", "agent": save_role, "content": preview}],
    }


async def qa_node(state: AgentState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = QAAgent(state["task_id"], memory)

    steps = state["steps"]
    idx = state["current_step_idx"]
    step = steps[idx] if idx < len(steps) else {}
    dev_output = state["agent_outputs"].get(f"step_{idx}", "")

    qa_context = f"Task: {step.get('description', state['goal'])}\n\nAgent output:\n{dev_output}"
    await _save_message(state["task_id"], "qa", "agent_input", qa_context)
    response = await agent.run(qa_context)
    await _save_message(state["task_id"], "qa", "agent_output", response)

    try:
        review = agent.parse_json(response)
        passed = review.get("passed", False)
        feedback = review.get("feedback", "")
    except Exception:
        passed = True
        feedback = ""

    outputs = {**state["agent_outputs"], "qa_feedback": feedback}

    if passed:
        next_idx = idx + 1
        all_done = next_idx >= len(steps)
        return {
            "agent_outputs": outputs,
            "current_step_idx": next_idx,
            "revision_count": 0,
            "status": "done" if all_done else "executing",
            "events": [{"type": "qa_pass", "agent": "qa", "content": review.get("summary", "Passed")}],
        }
    else:
        return {
            "agent_outputs": outputs,
            "revision_count": state["revision_count"] + 1,
            "status": "executing",
            "events": [{"type": "qa_fail", "agent": "qa", "content": feedback}],
        }


async def writer_node(state: AgentState) -> dict:
    memory = MemoryStore(state["task_id"])
    agent = WriterAgent(state["task_id"], memory)

    # Detect QA escalation: writer was called because revisions were exhausted,
    # not because QA passed — status would still be "executing" in that case.
    escalated = state.get("revision_count", 0) >= MAX_REVISIONS and state.get("status") != "done"

    all_output = "\n\n---\n\n".join(
        f"**{k}**:\n{v}" for k, v in state["agent_outputs"].items() if not k.startswith("qa")
    )
    writer_input = (
        f"Goal: {state['goal']}\n\nAll agent outputs:\n{all_output}\n\n"
        "Write a concise README for what was built."
    )
    await _save_message(state["task_id"], "writer", "agent_input", writer_input)
    response = await agent.run(writer_input)
    await _save_message(state["task_id"], "writer", "agent_output", response)
    await _update_task_status(state["task_id"], "done")
    await _save_task_result(state["task_id"], response)

    event_type = "done_escalated" if escalated else "done"
    event_content = "QA could not verify the output after max revisions — delivered as-is" if escalated else "Task complete"

    return {
        "final_result": response,
        "status": "done",
        "events": [{"type": event_type, "agent": "writer", "content": event_content}],
    }


# ── Routing ───────────────────────────────────────────────────

def route_after_developer(state: AgentState) -> str:
    if _workflow_config().get("skip_qa"):
        return "writer"
    return "qa"


def route_after_qa(state: AgentState) -> str:
    if state["status"] == "done":
        return "writer"
    if state["revision_count"] >= MAX_REVISIONS:
        return "writer"  # escalate — don't loop forever
    return "developer"


# ── Build graph ───────────────────────────────────────────────

def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("ceo", ceo_node)
    graph.add_node("planner", planner_node)
    graph.add_node("developer", developer_node)
    graph.add_node("qa", qa_node)
    graph.add_node("writer", writer_node)

    graph.set_entry_point("ceo")
    graph.add_edge("ceo", "planner")
    graph.add_edge("planner", "developer")
    graph.add_conditional_edges("developer", route_after_developer)
    graph.add_conditional_edges("qa", route_after_qa, {
        "developer": "developer",
        "writer": "writer",
    })
    graph.add_edge("writer", END)

    return graph.compile()


# ── DB helpers ────────────────────────────────────────────────

async def _save_message(task_id: str, agent_role: str, msg_type: str, content: str):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO messages (task_id, agent_role, type, content) VALUES ($1, $2, $3, $4)",
            uuid.UUID(task_id), agent_role, msg_type, content,
        )


async def _save_subtask(task_id: str, agent_role: str, description: str, status: str, result: str):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO subtasks (task_id, agent_role, description, status, result) VALUES ($1, $2, $3, $4, $5)",
            uuid.UUID(task_id), agent_role, description, status, result,
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
