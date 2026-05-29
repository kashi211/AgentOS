"""Braintrust logging + LLM-as-judge eval for completed tasks."""
from __future__ import annotations
import json
import time
from config import settings

_logger = None


def _get_logger():
    global _logger
    if _logger is not None:
        return _logger
    if not settings.braintrust_api_key:
        return None
    try:
        import braintrust
        _logger = braintrust.init_logger(project="AgentOS", api_key=settings.braintrust_api_key)
        return _logger
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
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        print(f"[braintrust] judge error: {e}")
        return {"correctness": 0, "completeness": 0, "quality": 0, "overall": 0, "reasoning": str(e)}


async def _fetch_qa_info(task_id: str) -> dict:
    """Pull the best QA score and revision count from the DB for this task."""
    try:
        from db.connection import get_pool
        import uuid as _uuid
        pool = get_pool()
        async with pool.acquire() as conn:
            # Latest QA agent_output message contains the JSON verdict
            rows = await conn.fetch(
                "SELECT content FROM agent_os_messages WHERE task_id=$1 AND agent_role='qa' AND type='agent_output' ORDER BY created_at",
                _uuid.UUID(task_id),
            )
            revision_count = len(rows)
            best_score = 0
            qa_passed = False
            for row in rows:
                try:
                    verdict = json.loads(row["content"]) if row["content"].strip().startswith("{") else {}
                    # content may be prose; try extracting embedded JSON
                    if not verdict:
                        import re
                        m = re.search(r'\{[^{}]+\}', row["content"], re.DOTALL)
                        if m:
                            verdict = json.loads(m.group())
                    score = verdict.get("score", 0)
                    if score > best_score:
                        best_score = score
                    if verdict.get("passed"):
                        qa_passed = True
                except Exception:
                    pass
            return {
                "qa_score": best_score,        # best QA score across all cycles (0–10)
                "qa_passed": qa_passed,
                "revision_count": revision_count,
            }
    except Exception as e:
        print(f"[braintrust] qa_info fetch error: {e}")
        return {"qa_score": None, "qa_passed": None, "revision_count": None}


async def log_task_completion(
    task_id: str,
    goal: str,
    final_output: str,
    preset_id: str | None,
    total_cost_usd: float,
    total_latency_ms: int,
    started_at: float | None = None,   # unix timestamp of when the task started
) -> dict | None:
    """Judge output quality and log everything to Braintrust. Returns scores dict."""
    log_start = started_at or (time.time() - total_latency_ms / 1000)
    log_end = time.time()

    scores = await judge_output(goal, final_output, preset_id)
    qa_info = await _fetch_qa_info(task_id)

    # Save scores to DB
    try:
        from db.connection import get_pool
        import uuid as _uuid
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO agent_os_task_metrics
                   (task_id, agent_role, preset_id, model, input_tokens, output_tokens, cost_usd, latency_ms)
                   VALUES ($1,'__eval__',$2,'judge',$3,$4,$5,$6)""",
                _uuid.UUID(task_id), preset_id,
                scores.get("correctness", 0), scores.get("completeness", 0),
                scores.get("overall", 0) / 10.0,
                scores.get("quality", 0),
            )
            await conn.execute(
                """INSERT INTO agent_os_messages (task_id, agent_role, type, content, metadata)
                   VALUES ($1, 'system', 'eval', $2, $3::jsonb)""",
                _uuid.UUID(task_id),
                scores.get("reasoning", ""),
                json.dumps({**scores, **qa_info}),
            )
    except Exception as e:
        print(f"[braintrust] db store error: {e}")

    # Log to Braintrust with correct timing and enriched metadata
    logger = _get_logger()
    if logger:
        try:
            tags = [preset_id or "custom"]
            if qa_info.get("qa_passed") is True:
                tags.append("qa_pass")
            elif qa_info.get("qa_passed") is False:
                tags.append("qa_fail")

            logger.log(
                input={"goal": goal, "preset_id": preset_id},
                output=final_output[:4000],
                scores={
                    "correctness":  scores.get("correctness", 0) / 10.0,
                    "completeness": scores.get("completeness", 0) / 10.0,
                    "quality":      scores.get("quality", 0) / 10.0,
                    "overall":      scores.get("overall", 0) / 10.0,
                    # QA score as a 0-1 signal alongside the LLM-judge scores
                    **({"qa_score": qa_info["qa_score"] / 10.0} if qa_info.get("qa_score") else {}),
                },
                metadata={
                    "task_id":        task_id,
                    "preset_id":      preset_id or "custom",
                    "total_cost_usd": total_cost_usd,
                    "total_latency_ms": total_latency_ms,
                    "reasoning":      scores.get("reasoning", ""),
                    "qa_passed":      qa_info.get("qa_passed"),
                    "qa_score":       qa_info.get("qa_score"),
                    "revision_count": qa_info.get("revision_count"),
                },
                metrics={
                    "start": log_start,
                    "end":   log_end,
                    "latency_ms": total_latency_ms,
                    "cost_usd":   total_cost_usd,
                },
                tags=tags,
            )
            logger.flush()
            print(
                f"[braintrust] logged task {task_id} — "
                f"overall {scores.get('overall')}/10 "
                f"qa={'pass' if qa_info.get('qa_passed') else 'fail'} "
                f"revisions={qa_info.get('revision_count')}"
            )
        except Exception as e:
            print(f"[braintrust] log error: {e}")

    return scores
