from __future__ import annotations

import json
import os
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
        if handler:
            return await handler(**input)
        return f"Tool '{name}' not implemented"

    def parse_json(self, text: str) -> dict | list:
        """Extract JSON from a response that may contain prose."""
        start = text.find("{") if "{" in text else text.find("[")
        end = text.rfind("}") + 1 if "}" in text else text.rfind("]") + 1
        return json.loads(text[start:end])
