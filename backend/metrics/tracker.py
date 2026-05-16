"""Save per-agent token/cost/latency metrics to DB."""
from __future__ import annotations
import uuid
from db.connection import get_pool

# Pricing per million tokens (input, output)
_PRICING: dict[str, tuple[float, float]] = {
    "claude-haiku-4-5-20251001": (0.80,  4.00),
    "claude-haiku-4-5":         (0.80,  4.00),
    "claude-sonnet-4-6":        (3.00,  15.00),
    "claude-opus-4-7":          (15.00, 75.00),
}

def calc_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    inp, out = _PRICING.get(model, (3.00, 15.00))
    return (input_tokens / 1_000_000) * inp + (output_tokens / 1_000_000) * out

async def save_metric(
    task_id: str,
    agent_role: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    latency_ms: int,
    preset_id: str | None = None,
) -> None:
    cost = calc_cost(model, input_tokens, output_tokens)
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO task_metrics
                   (task_id, agent_role, preset_id, model, input_tokens, output_tokens, cost_usd, latency_ms)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8)""",
                uuid.UUID(task_id), agent_role, preset_id, model,
                input_tokens, output_tokens, cost, latency_ms,
            )
    except Exception as e:
        print(f"[metrics] save_metric error (silent): {e}")
