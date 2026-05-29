import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db.connection import get_pool

router = APIRouter()


class PresetUpsert(BaseModel):
    data: dict[str, Any]


@router.get("")
async def list_presets():
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, data FROM agentos_custom_presets ORDER BY created_at DESC"
        )
    return [json.loads(r["data"]) if isinstance(r["data"], str) else dict(r["data"]) for r in rows]


@router.put("/{preset_id}")
async def upsert_preset(preset_id: str, body: PresetUpsert):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO agentos_custom_presets (id, data)
            VALUES ($1, $2::jsonb)
            ON CONFLICT (id) DO UPDATE
              SET data = $2::jsonb, updated_at = NOW()
            """,
            preset_id,
            json.dumps(body.data),
        )
    return {"saved": True, "id": preset_id}


@router.delete("/{preset_id}")
async def delete_preset(preset_id: str):
    pool = get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM agentos_custom_presets WHERE id = $1", preset_id
        )
    if result == "DELETE 0":
        raise HTTPException(404, "Preset not found")
    return {"deleted": True, "id": preset_id}
