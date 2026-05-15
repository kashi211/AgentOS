"""Global registry for streaming token callbacks."""
from __future__ import annotations
from typing import Any, Callable, Coroutine

# task_id → async callback(role: str, token: str)
_stream_registry: dict[str, Any] = {}


def register_stream(task_id: str, callback: Callable[[str, str], Coroutine]):
    _stream_registry[task_id] = callback


def unregister_stream(task_id: str):
    _stream_registry.pop(task_id, None)


def get_stream_callback(task_id: str) -> Callable[[str, str], Coroutine] | None:
    return _stream_registry.get(task_id)
