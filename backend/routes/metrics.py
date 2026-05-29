from __future__ import annotations
import json
from fastapi import APIRouter
from db.connection import get_pool

def _parse_meta(val) -> dict:
    """asyncpg returns JSONB as str or dict depending on version — handle both."""
    if val is None:
        return {}
    if isinstance(val, dict):
        return val
    try:
        return json.loads(val)
    except Exception:
        return {}

def _row(r) -> dict:
    """Convert asyncpg Record to plain dict, serializing floats safely."""
    return {k: (float(v) if hasattr(v, '__float__') and not isinstance(v, (int, bool)) else v)
            for k, v in dict(r).items()}

router = APIRouter(prefix="/metrics", tags=["metrics"])

@router.get("/")
async def get_metrics_summary():
    """Aggregate metrics: total cost, tokens, latency by preset."""
    pool = get_pool()
    async with pool.acquire() as conn:
        # Per-preset aggregates (exclude __eval__ rows)
        rows = await conn.fetch("""
            SELECT
                COALESCE(t.preset_id, 'custom') as preset_id,
                COUNT(DISTINCT m.task_id) as task_count,
                SUM(m.input_tokens) as total_input_tokens,
                SUM(m.output_tokens) as total_output_tokens,
                SUM(m.cost_usd) as total_cost_usd,
                AVG(m.latency_ms) as avg_latency_ms,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m.latency_ms) as p50_latency_ms,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY m.latency_ms) as p95_latency_ms
            FROM agent_os_task_metrics m
            JOIN agent_os_tasks t ON t.id = m.task_id
            WHERE m.agent_role != '__eval__'
            GROUP BY COALESCE(t.preset_id, 'custom')
            ORDER BY total_cost_usd DESC
        """)

        # Per-agent aggregates
        agent_rows = await conn.fetch("""
            SELECT
                m.agent_role,
                COUNT(*) as call_count,
                SUM(m.input_tokens) as total_input_tokens,
                SUM(m.output_tokens) as total_output_tokens,
                SUM(m.cost_usd) as total_cost_usd,
                AVG(m.latency_ms) as avg_latency_ms,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m.latency_ms) as p50_latency_ms,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY m.latency_ms) as p95_latency_ms
            FROM agent_os_task_metrics m
            WHERE m.agent_role != '__eval__'
            GROUP BY m.agent_role
            ORDER BY total_cost_usd DESC
            LIMIT 20
        """)

        # Overall totals
        totals = await conn.fetchrow("""
            SELECT
                COUNT(DISTINCT task_id) as total_tasks,
                SUM(input_tokens) as total_input_tokens,
                SUM(output_tokens) as total_output_tokens,
                SUM(cost_usd) as total_cost_usd,
                AVG(latency_ms) as avg_latency_ms
            FROM agent_os_task_metrics
            WHERE agent_role != '__eval__'
        """)

        # Recent eval scores
        eval_rows = await conn.fetch("""
            SELECT m.task_id::text, t.goal, t.preset_id, msg.metadata,
                   m.created_at
            FROM agent_os_task_metrics m
            JOIN agent_os_tasks t ON t.id = m.task_id
            LEFT JOIN agent_os_messages msg ON msg.task_id = m.task_id AND msg.type = 'eval'
            WHERE m.agent_role = '__eval__'
            ORDER BY m.created_at DESC
            LIMIT 10
        """)

    return {
        "totals": _row(totals) if totals else {},
        "by_preset": [_row(r) for r in rows],
        "by_agent": [_row(r) for r in agent_rows],
        "recent_evals": [
            {
                **{k: v for k, v in _row(r).items() if k != "metadata"},
                "scores": _parse_meta(r["metadata"]),
                "task_id": r["task_id"],
            }
            for r in eval_rows
        ],
    }

@router.get("/tasks/{task_id}")
async def get_task_metrics(task_id: str):
    """Metrics for a single task."""
    pool = get_pool()
    import uuid
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT agent_role, model, input_tokens, output_tokens, cost_usd, latency_ms, created_at
            FROM agent_os_task_metrics
            WHERE task_id = $1 AND agent_role != '__eval__'
            ORDER BY created_at
        """, uuid.UUID(task_id))
        eval_row = await conn.fetchrow("""
            SELECT metadata FROM agent_os_messages
            WHERE task_id = $1 AND type = 'eval'
            ORDER BY created_at DESC LIMIT 1
        """, uuid.UUID(task_id))
    return {
        "agents": [_row(r) for r in rows],
        "eval": _parse_meta(eval_row["metadata"]) if eval_row and eval_row["metadata"] else None,
    }
