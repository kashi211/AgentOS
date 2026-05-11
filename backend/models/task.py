from datetime import datetime
from uuid import UUID
from typing import Literal

from pydantic import BaseModel


class TaskCreate(BaseModel):
    goal: str


class SubtaskOut(BaseModel):
    id: UUID
    agent_role: str
    description: str
    status: str
    result: str | None
    revision_count: int


class MessageOut(BaseModel):
    id: UUID
    agent_role: str | None
    type: str
    content: str
    created_at: datetime


class TaskOut(BaseModel):
    id: UUID
    goal: str
    status: str
    result: str | None
    created_at: datetime
    subtasks: list[SubtaskOut] = []
    messages: list[MessageOut] = []


TaskStatus = Literal["pending", "planning", "executing", "reviewing", "done", "failed"]

AgentRole = Literal["ceo", "planner", "developer", "qa", "writer"]

MessageType = Literal["thinking", "delegation", "tool_call", "output", "error", "system"]
