from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import Any

import anthropic
from config import settings
from memory.store import MemoryStore

client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

# Opus 4.7 for heavy reasoning, Sonnet 4.6 for fast sub-tasks
OPUS = "claude-opus-4-7"
SONNET = "claude-sonnet-4-6"


class BaseAgent(ABC):
    role: str
    model: str = SONNET
    max_tokens: int = 4096

    def __init__(self, task_id: str, memory: MemoryStore):
        self.task_id = task_id
        self.memory = memory
        self._conversation: list[dict] = []

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

        response = await client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            system=[
                {
                    "type": "text",
                    # Prompt caching — system prompt is stable across turns
                    "text": self.system_prompt + (f"\n\n## Recent context\n{context}" if context else ""),
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=self._conversation,
            tools=self.tools if self.tools else anthropic.NOT_GIVEN,
        )

        result = await self._handle_response(response)
        self._conversation.append({"role": "assistant", "content": response.content})

        # Persist to short-term memory
        await self.memory.save_context(self.role, f"[{self.role}] {result[:500]}")

        return result

    async def _handle_response(self, response: anthropic.types.Message) -> str:
        parts = []
        for block in response.content:
            if block.type == "text":
                parts.append(block.text)
            elif block.type == "tool_use":
                tool_result = await self._call_tool(block.name, block.input)
                parts.append(f"[tool:{block.name}] {tool_result}")
        return "\n".join(parts)

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
