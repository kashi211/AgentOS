from upstash_redis import AsyncRedis
from config import settings

_redis: AsyncRedis | None = None

TTL = 60 * 60 * 2  # 2 hours


def get_redis() -> AsyncRedis:
    global _redis
    if _redis is None:
        _redis = AsyncRedis(
            url=settings.upstash_redis_url,
            token=settings.upstash_redis_token,
        )
    return _redis


class MemoryStore:
    """Short-term per-task memory backed by Upstash Redis."""

    def __init__(self, task_id: str):
        self.task_id = task_id
        self.redis = get_redis()

    def _key(self, agent_role: str) -> str:
        return f"agentos:{self.task_id}:{agent_role}:context"

    async def save_context(self, agent_role: str, content: str):
        key = self._key(agent_role)
        existing = await self.redis.get(key) or ""
        updated = f"{existing}\n{content}".strip()[-2000:]  # cap at 2k chars
        await self.redis.set(key, updated, ex=TTL)

    async def get_context(self, agent_role: str) -> str:
        return (await self.redis.get(self._key(agent_role))) or ""

    async def clear(self, agent_role: str):
        await self.redis.delete(self._key(agent_role))
