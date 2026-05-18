from __future__ import annotations

import asyncio
import json
import os
import time
from abc import ABC, abstractmethod
from typing import Any

import anthropic
from config import settings
from memory.store import MemoryStore

_AGENT_CONFIG_FILE = "agent_configs.json"


def _load_agent_override(role: str) -> dict:
    try:
        with open(_AGENT_CONFIG_FILE) as f:
            return json.load(f).get(role, {})
    except Exception:
        return {}

client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

_HAIKU  = "claude-haiku-4-5-20251001"
_SONNET = "claude-sonnet-4-6"
_OPUS   = "claude-opus-4-7"

# DEV_MODE=true collapses all models to Haiku to minimise token spend
OPUS   = _HAIKU if settings.dev_mode else _OPUS
SONNET = _HAIKU if settings.dev_mode else _SONNET


class BaseAgent(ABC):
    role: str
    model: str = SONNET
    max_tokens: int = 4096

    def __init__(self, task_id: str, memory: MemoryStore):
        self.task_id = task_id
        self.memory = memory
        self._conversation: list[dict] = []

        # Apply user overrides from agent_configs.json (if any)
        override = _load_agent_override(self.role)
        if override.get("model"):
            self.model = override["model"]
        if override.get("max_tokens"):
            self.max_tokens = override["max_tokens"]
        self._custom_system_prompt: str | None = override.get("system_prompt") or None

    @property
    @abstractmethod
    def system_prompt(self) -> str: ...

    @property
    def tools(self) -> list[dict]:
        return []

    async def run(self, user_message: str) -> str:
        self._conversation.append({"role": "user", "content": user_message})

        # Load short-term context from Redis
        context = await self.memory.get_context(self.role)
        active_prompt = self._custom_system_prompt or self.system_prompt

        # Retrieve long-term memories from Pinecone
        memory_context = ""
        try:
            from memory.long_term import retrieve_memories
            memories = await retrieve_memories(user_message[:500], exclude_task_id=self.task_id)
            if memories:
                memory_context = "\n\n## Relevant past work\n" + "\n".join(memories)
        except Exception as e:
            print(f"[pinecone] retrieve error (silent): {e}")

        system = [
            {
                "type": "text",
                "text": active_prompt
                    + (f"\n\n## Recent context\n{context}" if context else "")
                    + memory_context,
                "cache_control": {"type": "ephemeral"},
            }
        ]

        text_parts: list[str] = []

        # Import streaming registry
        from streaming import get_stream_callback
        stream_callback = get_stream_callback(self.task_id)

        # Token accumulators across all loop turns
        _total_input = 0
        _total_output = 0
        start_time = time.time()

        # Proper agentic tool-use loop: keep going until stop_reason != "tool_use"
        first_turn = True
        while True:
            if stream_callback and first_turn and not self.tools:
                # Stream first text-only turn token by token
                text_parts_current: list[str] = []
                async with client.messages.stream(
                    model=self.model,
                    max_tokens=self.max_tokens,
                    system=system,
                    messages=self._conversation,
                ) as stream:
                    async for text in stream.text_stream:
                        text_parts_current.append(text)
                        try:
                            await stream_callback(self.role, text)
                        except Exception:
                            pass
                    response = await stream.get_final_message()
                _total_input += getattr(response.usage, 'input_tokens', 0)
                _total_output += getattr(response.usage, 'output_tokens', 0)
                if "".join(text_parts_current).strip():
                    text_parts.append("".join(text_parts_current))
                first_turn = False
            else:
                response = await client.messages.create(
                    model=self.model,
                    max_tokens=self.max_tokens,
                    system=system,
                    messages=self._conversation,
                    tools=self.tools if self.tools else anthropic.NOT_GIVEN,
                )
                _total_input += getattr(response.usage, 'input_tokens', 0)
                _total_output += getattr(response.usage, 'output_tokens', 0)
                # Accumulate any text from this turn
                for block in response.content:
                    if block.type == "text" and block.text.strip():
                        text_parts.append(block.text)
                first_turn = False

            # Append assistant turn to conversation history
            self._conversation.append({"role": "assistant", "content": response.content})

            if response.stop_reason != "tool_use":
                break

            # Call every requested tool and feed all results back in one user turn
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = await self._call_tool(block.name, block.input)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })

            self._conversation.append({"role": "user", "content": tool_results})

        result = "\n".join(text_parts)

        latency_ms = int((time.time() - start_time) * 1000)
        try:
            from metrics.tracker import save_metric
            asyncio.create_task(save_metric(
                task_id=self.task_id,
                agent_role=self.role,
                model=self.model,
                input_tokens=_total_input,
                output_tokens=_total_output,
                latency_ms=latency_ms,
            ))
        except Exception:
            pass

        # Persist to short-term memory
        await self.memory.save_context(self.role, f"[{self.role}] {result[:500]}")

        # Store long-term memory in Pinecone
        try:
            from memory.long_term import store_memory
            await store_memory(self.task_id, self.role, user_message[:200], result[:1500])
        except Exception as e:
            print(f"[pinecone] store error (silent): {e}")

        return result

    async def _call_tool(self, name: str, input: dict[str, Any]) -> str:
        handler = getattr(self, f"tool_{name}", None)
        if not handler:
            return f"Tool '{name}' not implemented"
        try:
            return await handler(**input)
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            print(f"[tool_error] {self.role}.{name} raised: {e}\n{tb}")
            return f"Tool '{name}' raised an error: {e}"

    # ── Built-in tool: web_search (Serper) ────────────────────
    @staticmethod
    def _web_search_tool_def() -> dict:
        return {
            "name": "web_search",
            "description": (
                "Search the web for current information, news, prices, events, or any data "
                "not available in training knowledge. Use this for anything time-sensitive."
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query",
                    },
                    "num_results": {
                        "type": "integer",
                        "description": "Number of results to return (default 5, max 10)",
                        "default": 5,
                    },
                },
                "required": ["query"],
            },
        }

    async def tool_web_search(self, query: str, num_results: int = 5) -> str:
        """Hit Serper and return formatted search results."""
        from config import settings
        import urllib.request

        if not settings.serper_api_key:
            return "Web search is not configured. Add SERPER_API_KEY to the environment."

        num_results = min(max(1, num_results), 10)
        payload = json.dumps({"q": query, "num": num_results}).encode()
        req = urllib.request.Request(
            "https://google.serper.dev/search",
            data=payload,
            headers={
                "X-API-KEY": settings.serper_api_key,
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
        except Exception as e:
            return f"Web search failed: {e}"

        lines: list[str] = [f'Search results for: "{query}"\n']

        # Answer box
        if ab := data.get("answerBox"):
            lines.append(f"[Answer] {ab.get('answer') or ab.get('snippet', '')}\n")

        # Organic results
        for i, r in enumerate(data.get("organic", [])[:num_results], 1):
            lines.append(f"{i}. {r.get('title', '')}")
            lines.append(f"   {r.get('snippet', '')}")
            lines.append(f"   {r.get('link', '')}\n")

        # Top news if present
        for n in data.get("news", [])[:3]:
            lines.append(f"[News] {n.get('title', '')} — {n.get('date', '')}")
            lines.append(f"   {n.get('snippet', '')}")
            lines.append(f"   {n.get('link', '')}\n")

        return "\n".join(lines)

    def parse_json(self, text: str) -> dict | list:
        """Extract JSON from a response that may contain prose."""
        start = text.find("{") if "{" in text else text.find("[")
        end = text.rfind("}") + 1 if "}" in text else text.rfind("]") + 1
        return json.loads(text[start:end])


async def fetch_web_context(query: str, num_results: int = 5) -> str:
    """Call Serper and return formatted search results as a context string.
    Returns an empty string if serper_api_key is not configured or the request fails.
    """
    import urllib.request as _urlreq

    if not settings.serper_api_key:
        return ""

    num_results = min(max(1, num_results), 10)
    payload = json.dumps({"q": query, "num": num_results}).encode()
    req = _urlreq.Request(
        "https://google.serper.dev/search",
        data=payload,
        headers={
            "X-API-KEY": settings.serper_api_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        import asyncio
        loop = asyncio.get_event_loop()

        def _do_request():
            with _urlreq.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read())

        data = await loop.run_in_executor(None, _do_request)
    except Exception as e:
        print(f"[web_context] Serper request failed: {e}")
        return ""

    lines: list[str] = [f'## Current Web Context (as of today)\nSearch: "{query}"\n']

    if ab := data.get("answerBox"):
        lines.append(f"**Quick answer:** {ab.get('answer') or ab.get('snippet', '')}\n")

    for i, r in enumerate(data.get("organic", [])[:num_results], 1):
        lines.append(f"{i}. **{r.get('title', '')}**")
        lines.append(f"   {r.get('snippet', '')}")
        lines.append(f"   Source: {r.get('link', '')}\n")

    for n in data.get("news", [])[:3]:
        lines.append(f"[News] **{n.get('title', '')}** — {n.get('date', '')}")
        lines.append(f"   {n.get('snippet', '')}")
        lines.append(f"   Source: {n.get('link', '')}\n")

    return "\n".join(lines)
