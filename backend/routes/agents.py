import json
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

CONFIG_FILE = "agent_configs.json"

AGENT_DEFAULTS: dict[str, dict] = {
    "ceo":       {"model": "claude-opus-4-7",           "max_tokens": 8096},
    "planner":   {"model": "claude-opus-4-7",           "max_tokens": 8096},
    "developer": {"model": "claude-opus-4-7",           "max_tokens": 8096},
    "qa":        {"model": "claude-sonnet-4-6",         "max_tokens": 4096},
    "writer":    {"model": "claude-sonnet-4-6",         "max_tokens": 4096},
}

WORKFLOW_DEFAULTS = {"skip_qa": False, "skip_writer": False}


def _read_file() -> dict:
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE) as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _write_file(data: dict):
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f, indent=2)


def _get_default_prompt(role: str) -> str:
    """Instantiate the agent class without __init__ to get its default system_prompt."""
    from agents.ceo import CEOAgent
    from agents.planner import PlannerAgent
    from agents.developer import DeveloperAgent
    from agents.qa import QAAgent
    from agents.writer import WriterAgent

    cls_map = {
        "ceo": CEOAgent, "planner": PlannerAgent,
        "developer": DeveloperAgent, "qa": QAAgent, "writer": WriterAgent,
    }
    cls = cls_map.get(role)
    if not cls:
        return ""
    obj = object.__new__(cls)
    return cls.system_prompt.fget(obj)


# ── Models ────────────────────────────────────────────────────────────────────

class AgentConfigUpdate(BaseModel):
    model: str
    max_tokens: int
    system_prompt: str | None = None  # None = use class default


class WorkflowUpdate(BaseModel):
    skip_qa: bool = False
    skip_writer: bool = False


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
def get_all_configs():
    stored = _read_file()
    result = {}
    for role, defaults in AGENT_DEFAULTS.items():
        override = stored.get(role, {})
        default_prompt = _get_default_prompt(role)
        result[role] = {
            "model":                  override.get("model", defaults["model"]),
            "max_tokens":             override.get("max_tokens", defaults["max_tokens"]),
            "system_prompt":          override.get("system_prompt"),   # None = using default
            "default_model":          defaults["model"],
            "default_max_tokens":     defaults["max_tokens"],
            "default_system_prompt":  default_prompt,
            "is_customized":          bool(override),
        }
    result["workflow"] = {**WORKFLOW_DEFAULTS, **stored.get("workflow", {})}
    return result


@router.get("/workflow/config")
def get_workflow():
    stored = _read_file()
    return {**WORKFLOW_DEFAULTS, **stored.get("workflow", {})}


@router.put("/workflow/config")
def update_workflow(body: WorkflowUpdate):
    stored = _read_file()
    stored["workflow"] = body.model_dump()
    _write_file(stored)
    return {"saved": True}


@router.put("/{role}")
def update_agent_config(role: str, body: AgentConfigUpdate):
    if role not in AGENT_DEFAULTS:
        raise HTTPException(404, f"Unknown agent role: {role}")
    stored = _read_file()
    stored[role] = {
        "model":         body.model,
        "max_tokens":    body.max_tokens,
        "system_prompt": body.system_prompt,
    }
    _write_file(stored)
    return {"saved": True, "role": role}


@router.delete("/{role}")
def reset_agent_config(role: str):
    if role not in AGENT_DEFAULTS:
        raise HTTPException(404, f"Unknown agent role: {role}")
    stored = _read_file()
    stored.pop(role, None)
    _write_file(stored)
    return {"reset": True, "role": role}
