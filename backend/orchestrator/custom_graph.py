"""Dynamic orchestrator for user-created custom presets.

Reads the preset's agents + workflow from the DB and executes them
sequentially, honouring revision loops, without needing a baked
LangGraph StateGraph per preset.
"""
from __future__ import annotations

import re
import uuid
import asyncio

from agents.base import BaseAgent, SONNET, OPUS, _HAIKU, client
from agent_os_memory.store import MemoryStore
from db.connection import get_pool
from routes.ws import broadcast

# ── model name → constant ────────────────────────────────────

_MODEL_MAP = {
    "opus":   OPUS,
    "sonnet": SONNET,
    "haiku":  _HAIKU,
}


def _resolve_model(model_str: str) -> str:
    lower = model_str.lower()
    for key, val in _MODEL_MAP.items():
        if key in lower:
            return val
    return SONNET


# ── Dynamic agent ────────────────────────────────────────────

class DynamicAgent(BaseAgent):
    """An agent whose role, model and system prompt come from a preset definition."""

    def __init__(self, task_id: str, memory: MemoryStore, agent_def: dict):
        # Set class-level-style attrs before super().__init__ reads them
        self.role  = agent_def.get("role", "agent").lower().replace(" ", "_")
        self.model = _resolve_model(agent_def.get("model", ""))
        self._system_prompt_text = agent_def.get("systemPrompt", "You are a helpful AI assistant. Complete the task thoroughly and write your response directly.")
        self._tool_names: list[str] = agent_def.get("tools", [])
        super().__init__(task_id, memory)

        # Apply optional advanced config from preset agent definition
        if agent_def.get("maxTokens"):
            self.max_tokens = int(agent_def["maxTokens"])
        if agent_def.get("temperature") is not None:
            self.temperature = float(agent_def["temperature"])
        if agent_def.get("maxContextChars"):
            self.max_context_chars = int(agent_def["maxContextChars"])
        if agent_def.get("timeoutSeconds"):
            self.timeout_seconds = int(agent_def["timeoutSeconds"])
        if agent_def.get("maxRetries") is not None:
            self.max_retries = int(agent_def["maxRetries"])

    @property
    def system_prompt(self) -> str:
        base = self._system_prompt_text
        # If this agent has no file-writing capability, make it clear it should
        # not claim to have built or implemented anything — only analyse/advise.
        if "write_file" not in self._tool_names:
            base += (
                "\n\nIMPORTANT: You do not have access to file-writing tools. "
                "Do NOT claim to have built, created, implemented, or written any files or code. "
                "Provide analysis, recommendations, and findings in prose only."
            )
        return base

    @property
    def tools(self) -> list[dict]:
        tool_defs = []
        names = self._tool_names

        if "web_search" in names:
            tool_defs.append(self._web_search_tool_def())
        if "fetch_url" in names:
            tool_defs.append(self._fetch_url_tool_def())
        if "run_terminal_command" in names:
            tool_defs.append(self._run_terminal_command_tool_def())
        if "read_file" in names:
            tool_defs.append({
                "name": "read_file",
                "description": "Read a file from the task output directory.",
                "input_schema": {
                    "type": "object",
                    "properties": {"filename": {"type": "string", "description": "File name to read"}},
                    "required": ["filename"],
                },
            })
        if "write_file" in names:
            tool_defs.append({
                "name": "write_file",
                "description": "Write content to a file in the task output directory.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "filename": {"type": "string"},
                        "content":  {"type": "string"},
                    },
                    "required": ["filename", "content"],
                },
            })
        if "list_files" in names:
            tool_defs.append({
                "name": "list_files",
                "description": "List all files in the task output directory.",
                "input_schema": {"type": "object", "properties": {}, "required": []},
            })
        if "delete_file" in names:
            tool_defs.append({
                "name": "delete_file",
                "description": "Delete a file from the task output directory.",
                "input_schema": {
                    "type": "object",
                    "properties": {"filename": {"type": "string"}},
                    "required": ["filename"],
                },
            })
        if "move_file" in names:
            tool_defs.append({
                "name": "move_file",
                "description": "Rename or move a file within the task output directory.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "src": {"type": "string"},
                        "dst": {"type": "string"},
                    },
                    "required": ["src", "dst"],
                },
            })
        return tool_defs

    async def tool_read_file(self, filename: str) -> str:
        from storage.r2 import read_file
        content = read_file(self.task_id, filename)
        return content or f"File '{filename}' not found."

    async def tool_write_file(self, filename: str, content: str) -> str:
        from storage.r2 import write_file
        write_file(self.task_id, filename, content)
        return f"Wrote {len(content)} chars to {filename}."

    async def tool_list_files(self) -> str:
        from storage.r2 import list_files
        import json
        files = list_files(self.task_id)
        return json.dumps(files, indent=2) if files else "No files found."

    async def tool_delete_file(self, filename: str) -> str:
        import os
        path = os.path.join("output", self.task_id, filename)
        if os.path.exists(path):
            os.remove(path)
            return f"Deleted {filename}."
        return f"File not found: {filename}"

    async def tool_move_file(self, src: str, dst: str) -> str:
        import os, shutil
        base = os.path.join("output", self.task_id)
        src_path = os.path.join(base, src)
        dst_path = os.path.join(base, dst)
        if not os.path.exists(src_path):
            return f"Source not found: {src}"
        os.makedirs(os.path.dirname(dst_path), exist_ok=True)
        shutil.move(src_path, dst_path)
        return f"Moved {src} → {dst}."


# ── Pass/fail heuristic for loop nodes ───────────────────────

def _reviewer_passed(response: str) -> bool:
    """Return True if a reviewer's output signals the work passed."""
    lower = response.lower()
    # Explicit fail keywords
    if any(kw in lower for kw in ("fail", "revision needed", "needs revision", "rejected", "not pass")):
        return False
    # Numeric score < 7 anywhere in response
    scores = re.findall(r'\bscore["\s:]*(\d+)', lower)
    if scores and int(scores[0]) < 7:
        return False
    # Explicit pass keywords
    if any(kw in lower for kw in ("pass", "approved", "lgtm", "looks good", "accepted")):
        return True
    # Default: assume pass if no failure signal
    return True


# ── Main runner ──────────────────────────────────────────────

async def run_custom_preset(task_id: str, goal: str, preset_data: dict) -> str:
    """Execute a custom preset's workflow and return the final output."""
    agents_by_id: dict[str, dict] = {a["id"]: a for a in preset_data.get("agents", [])}
    workflow    = preset_data.get("workflow", {})
    node_ids    = workflow.get("nodeIds") or [a["id"] for a in preset_data.get("agents", [])]
    loops_list  = workflow.get("loops", [])
    # map fromId → loop spec
    loops: dict[str, dict] = {lp["fromId"]: lp for lp in loops_list}

    memory   = MemoryStore(task_id)
    outputs:          dict[str, str] = {}   # agent_id  → output text
    revision_counts:  dict[str, int] = {}   # agent_id  → how many times we looped from here

    await _update_task_status(task_id, "planning")

    i = 0
    while i < len(node_ids):
        agent_id  = node_ids[i]
        agent_def = agents_by_id.get(agent_id)
        if not agent_def:
            i += 1
            continue

        # ── Build prompt from accumulated outputs ──
        context_lines = [f"Task goal: {goal}\n"]
        for prev_id in node_ids[:i]:
            if prev_id in outputs:
                prev_role = agents_by_id[prev_id].get("role", prev_id)
                context_lines.append(f"{prev_role} output:\n\n{outputs[prev_id]}")
        prompt = "\n\n---\n\n".join(context_lines)

        agent    = DynamicAgent(task_id, memory, agent_def)
        role_key = agent.role

        # Update running status
        if i == 0:
            await _update_task_status(task_id, "planning")
        elif i == len(node_ids) - 1:
            await _update_task_status(task_id, "reviewing")
        else:
            await _update_task_status(task_id, "executing")

        # Save input + broadcast
        await _save_message(task_id, role_key, "agent_input", prompt)
        await broadcast(task_id, {
            "type": "agent_input",
            "agent": role_key,
            "content": prompt[:280] + ("…" if len(prompt) > 280 else ""),
        })

        # Run agent
        response = await agent.run(prompt)
        outputs[agent_id] = response

        # Save output + broadcast
        await _save_message(task_id, role_key, "agent_output", response)
        preview  = response.replace("\n", " ").strip()
        preview  = preview[:280] + "…" if len(preview) > 280 else preview
        await broadcast(task_id, {"type": "agent_output", "agent": role_key, "content": preview})

        # ── Revision loop check ──
        loop = loops.get(agent_id)
        if loop:
            rev  = revision_counts.get(agent_id, 0)
            if not _reviewer_passed(response) and rev < loop.get("maxIterations", 2):
                revision_counts[agent_id] = rev + 1
                to_id = loop.get("toId", "")
                if to_id in node_ids:
                    i = node_ids.index(to_id)
                    continue   # jump back without incrementing i

        i += 1

    # ── Finalise ──
    final_output = outputs.get(node_ids[-1], "") if node_ids else ""
    await _update_task_status(task_id, "done")
    await _save_task_result(task_id, final_output)

    last_role = agents_by_id.get(node_ids[-1], {}).get("role", "agent") if node_ids else "agent"
    final_preview = final_output.replace("\n", " ").strip()
    final_preview = final_preview[:280] + "…" if len(final_preview) > 280 else final_preview
    await broadcast(task_id, {"type": "done", "agent": last_role.lower().replace(" ", "_"), "content": final_preview})

    return final_output


# ── Helpers ──────────────────────────────────────────────────

async def fetch_preset_from_db(preset_id: str) -> dict | None:
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT data FROM agent_os_custom_presets WHERE id=$1", preset_id
        )
    if not row:
        return None
    import json
    data = row["data"]
    return json.loads(data) if isinstance(data, str) else dict(data)


async def _save_message(task_id: str, agent_role: str, msg_type: str, content: str):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO agent_os_messages (task_id, agent_role, type, content) VALUES ($1, $2, $3, $4)",
            uuid.UUID(task_id), agent_role, msg_type, content,
        )


async def _update_task_status(task_id: str, status: str):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE agent_os_tasks SET status=$1, updated_at=NOW() WHERE id=$2",
            status, uuid.UUID(task_id),
        )


async def _save_task_result(task_id: str, result: str):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE agent_os_tasks SET result=$1, status='done', updated_at=NOW() WHERE id=$2",
            result, uuid.UUID(task_id),
        )
