"""Braintrust logging + LLM-as-judge eval for completed tasks."""
from __future__ import annotations
import json
from config import settings

def _get_logger():
    if not settings.braintrust_api_key:
        return None
    try:
        import braintrust
        return braintrust.init_logger(project="AgentOS", api_key=settings.braintrust_api_key)
    except Exception as e:
        print(f"[braintrust] init error: {e}")
        return None

async def judge_output(goal: str, output: str, preset_id: str | None) -> dict:
    """Use claude-haiku to score the final output 1-10 on quality axes."""
    from agents.base import client, _HAIKU
    prompt = f"""You are an expert evaluator. Rate this AI agent output strictly and concisely.

Task goal: {goal[:500]}

Agent output (first 2000 chars): {output[:2000]}

Score on each dimension from 1-10:
- correctness: factual accuracy and soundness of reasoning
- completeness: covers all important aspects of the task
- quality: clarity, structure, and usefulness of the writing

Return ONLY valid JSON, no other text:
{{"correctness": 7, "completeness": 8, "quality": 8, "overall": 8, "reasoning": "one sentence"}}"""

    try:
        resp = await client.messages.create(
            model=_HAIKU,
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.content[0].text.strip()
        # strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        print(f"[braintrust] judge error: {e}")
        return {"correctness": 0, "completeness": 0, "quality": 0, "overall": 0, "reasoning": str(e)}

async def log_task_completion(
    task_id: str,
    goal: str,
    final_output: str,
    preset_id: str | None,
    total_cost_usd: float,
    total_latency_ms: int,
) -> dict | None:
    """Judge output quality and log everything to Braintrust. Returns scores dict."""
    scores = await judge_output(goal, final_output, preset_id)

    # Save scores to DB
    try:
        from db.connection import get_pool
        import uuid as _uuid
        pool = get_pool()
        async with pool.acquire() as conn:
            # Store scores as a task-level metric row with role='__eval__'
            await conn.execute(
                """INSERT INTO task_metrics
                   (task_id, agent_role, preset_id, model, input_tokens, output_tokens, cost_usd, latency_ms)
                   VALUES ($1,'__eval__',$2,'judge',$3,$4,$5,$6)""",
                _uuid.UUID(task_id), preset_id,
                scores.get("correctness", 0), scores.get("completeness", 0),
                scores.get("overall", 0) / 10.0,  # store overall as cost_usd field (0-1 scale)
                scores.get("quality", 0),
            )
            # Store the eval scores as a message of type 'eval'
            await conn.execute(
                """INSERT INTO messages (task_id, agent_role, type, content, metadata)
                   VALUES ($1, 'system', 'eval', $2, $3::jsonb)""",
                _uuid.UUID(task_id),
                scores.get("reasoning", ""),
                json.dumps(scores),
            )
    except Exception as e:
        print(f"[braintrust] db store error: {e}")

    # Log to Braintrust
    logger = _get_logger()
    if logger:
        try:
            logger.log(
                input={"goal": goal, "preset_id": preset_id},
                output=final_output[:4000],
                scores={
                    "correctness": scores.get("correctness", 0) / 10.0,
                    "completeness": scores.get("completeness", 0) / 10.0,
                    "quality": scores.get("quality", 0) / 10.0,
                    "overall": scores.get("overall", 0) / 10.0,
                },
                metadata={
                    "task_id": task_id,
                    "preset_id": preset_id or "custom",
                    "total_cost_usd": total_cost_usd,
                    "total_latency_ms": total_latency_ms,
                    "reasoning": scores.get("reasoning", ""),
                },
            )
            print(f"[braintrust] logged task {task_id} — overall {scores.get('overall')}/10")
        except Exception as e:
            print(f"[braintrust] log error: {e}")

    return scores
