"""Generate contextual MCQ refinement questions for a given user prompt."""
from __future__ import annotations

import json

import anthropic
from fastapi import APIRouter
from pydantic import BaseModel

from config import settings

router = APIRouter()
client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

_HAIKU = "claude-haiku-4-5-20251001"


class QuestionsRequest(BaseModel):
    goal: str
    preset_id: str | None = None


class QuestionOption(BaseModel):
    label: str
    emoji: str
    value: str


class Question(BaseModel):
    id: str
    question: str
    options: list[QuestionOption]


class QuestionsResponse(BaseModel):
    questions: list[Question]


_SYSTEM = """You generate 3 short multiple-choice questions to help clarify a user's task request before sending it to AI agents.

IMPORTANT CONSTRAINTS — never ask about these, they are already decided:
- Platform / delivery format: the output is ALWAYS a single self-contained HTML file with inline CSS and JavaScript. Never ask "what type of app", "web or mobile", "which framework", or anything about technology stack.
- Hosting or deployment: not relevant.
- Programming language or tech stack: always HTML + CSS + JS, no build tools.

Instead focus questions on:
- What specific features or data the app should include
- The visual style or design feel (minimal, colourful, dark, playful…)
- The target audience or primary use-case
- Scope / level of detail (simple MVP vs feature-rich)
- Any content, data sources, or domain-specific requirements

Rules:
- Questions must be directly relevant to the specific task described — not generic
- Each question has exactly 4 options (short labels, 1-4 words max)
- Each option gets a single relevant emoji
- Return ONLY valid JSON, no prose

Output format:
{
  "questions": [
    {
      "id": "q1",
      "question": "Short question?",
      "options": [
        {"label": "Option A", "emoji": "🔥", "value": "option_a_context"},
        {"label": "Option B", "emoji": "✅", "value": "option_b_context"},
        {"label": "Option C", "emoji": "⚡", "value": "option_c_context"},
        {"label": "Option D", "emoji": "🎯", "value": "option_d_context"}
      ]
    }
  ]
}

The "value" field should be a short phrase (3-8 words) suitable for inclusion in context sent to agents.
"""


@router.post("/questions", response_model=QuestionsResponse)
async def generate_questions(body: QuestionsRequest) -> QuestionsResponse:
    user_msg = f"Generate 3 clarifying questions for this task:\n\n{body.goal}"
    if body.preset_id:
        user_msg += f"\n\nThe user is using the '{body.preset_id}' agent team."

    try:
        resp = await client.messages.create(
            model=_HAIKU,
            max_tokens=1024,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
        raw = resp.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        return QuestionsResponse(questions=[Question(**q) for q in data["questions"]])
    except Exception as e:
        # Fallback: return empty so frontend skips the modal gracefully
        print(f"[questions] generation failed: {e}")
        return QuestionsResponse(questions=[])
