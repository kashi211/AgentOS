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
    emoji: str = ""   # kept for backwards-compat; no longer shown in UI
    value: str


class Question(BaseModel):
    id: str
    question: str
    options: list[QuestionOption]


class QuestionsResponse(BaseModel):
    questions: list[Question]


# Base rules shared by all presets
_BASE_RULES = """Rules:
- Questions must be directly relevant to the specific task described — not generic
- Each question has exactly 4 options (short labels, 1-4 words max)
- Return ONLY valid JSON, no prose

Output format:
{
  "questions": [
    {
      "id": "q1",
      "question": "Short question?",
      "options": [
        {"label": "Option A", "emoji": "", "value": "option_a_context"},
        {"label": "Option B", "emoji": "", "value": "option_b_context"},
        {"label": "Option C", "emoji": "", "value": "option_c_context"},
        {"label": "Option D", "emoji": "", "value": "option_d_context"}
      ]
    }
  ]
}

The "value" field should be a short phrase (3-8 words) suitable for inclusion in context sent to agents."""

# Per-preset system prompts
_SYSTEMS: dict[str, str] = {
    "software-dev": f"""You generate 3 short multiple-choice questions to help clarify a software development task.

IMPORTANT: the output is always a single self-contained HTML file with inline CSS and JS.
Never ask about platform, tech stack, framework, hosting, or deployment.

Focus questions on:
- What specific features or data the app should include
- Visual style / design feel (minimal, colourful, dark, playful…)
- Target audience or primary use-case
- Scope (simple MVP vs feature-rich)

{_BASE_RULES}""",

    "research-intelligence": f"""You generate 3 short multiple-choice questions to help clarify a research task.

Focus questions on:
- Depth of analysis required (overview vs deep-dive)
- Key angle or perspective (technical, policy, business, historical…)
- Primary audience for the report (executive, academic, general public…)
- Scope of sources (recent only, all-time, specific regions/industries…)

{_BASE_RULES}""",

    "investment-analysis": f"""You generate 3 short multiple-choice questions to help clarify an investment analysis task.

Focus questions on:
- Investment horizon (short-term trade, medium-term position, long-term hold)
- Risk tolerance (conservative, moderate, aggressive)
- Key focus area (growth potential, valuation, competitive moat, risks…)
- Investor type (retail, institutional, venture, private equity…)

{_BASE_RULES}""",

    "legal-review": f"""You generate 3 short multiple-choice questions to help clarify a legal document review task.

Focus questions on:
- Type of document (contract, NDA, terms of service, employment agreement…)
- Reviewing party's role (buyer, seller, employee, employer, licensor…)
- Key concern (liability clauses, IP ownership, termination, payment terms…)
- Jurisdiction or governing law (if relevant)

{_BASE_RULES}""",

    "content-marketing": f"""You generate 3 short multiple-choice questions to help clarify a content or marketing task.

Focus questions on:
- Target audience (demographics, interests, pain points)
- Tone and voice (professional, casual, witty, authoritative…)
- Primary goal (awareness, lead generation, engagement, conversion…)
- Content length / format (short-form, long-form, social, blog…)

{_BASE_RULES}""",

    "academic-review": f"""You generate 3 short multiple-choice questions to help clarify an academic literature review task.

Focus questions on:
- Academic discipline or field
- Scope of literature (foundational only, recent 5 years, comprehensive…)
- Review structure (thematic, chronological, methodological…)
- Intended output (systematic review, narrative summary, meta-analysis overview…)

{_BASE_RULES}""",
}

# Fallback for custom presets
_DEFAULT_SYSTEM = f"""You generate 3 short multiple-choice questions to help clarify a task before it is sent to AI agents.

Focus questions on:
- The primary goal or desired outcome
- Scope and depth required
- Target audience for the output
- Any specific constraints or preferences

{_BASE_RULES}"""


@router.post("/questions", response_model=QuestionsResponse)
async def generate_questions(body: QuestionsRequest) -> QuestionsResponse:
    system = _SYSTEMS.get(body.preset_id or "", _DEFAULT_SYSTEM)
    user_msg = f"Generate 3 clarifying questions for this task:\n\n{body.goal}"

    try:
        resp = await client.messages.create(
            model=_HAIKU,
            max_tokens=1024,
            system=system,
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
