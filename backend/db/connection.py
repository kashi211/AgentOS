import asyncpg
from config import settings

_pool: asyncpg.Pool | None = None


async def init_db():
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=1,
        max_size=10,
        statement_cache_size=0,       # prevents InvalidCachedStatementError after schema migrations
        max_inactive_connection_lifetime=300,  # recycle idle connections every 5 min
                                               # Neon drops idle connections at ~5 min, so this
                                               # prevents asyncpg handing a dead socket to a request
        command_timeout=30,           # any single query hanging > 30s is killed, not hung forever
    )
    await _create_schema()


async def close_db():
    if _pool:
        await _pool.close()


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialised")
    return _pool


async def _create_schema():
    async with _pool.acquire() as conn:
        await conn.execute(SCHEMA_SQL)


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS agent_os_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_os_tasks (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal           TEXT NOT NULL DEFAULT '',
    status         VARCHAR(50)  DEFAULT 'pending',
    result         TEXT,
    preset_id      TEXT,
    web_search     BOOLEAN      DEFAULT FALSE,
    user_id        UUID         REFERENCES agent_os_users(id),
    parent_task_id UUID         REFERENCES agent_os_tasks(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ  DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_os_subtasks (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id        UUID REFERENCES agent_os_tasks(id) ON DELETE CASCADE,
    agent_role     VARCHAR(50)  NOT NULL,
    description    TEXT         NOT NULL,
    status         VARCHAR(50)  DEFAULT 'pending',
    result         TEXT,
    revision_count INT          DEFAULT 0,
    created_at     TIMESTAMPTZ  DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_os_messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    UUID REFERENCES agent_os_tasks(id) ON DELETE CASCADE,
    agent_role VARCHAR(50),
    type       VARCHAR(50),
    content    TEXT        NOT NULL,
    metadata   JSONB       DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_os_memory (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID REFERENCES agent_os_tasks(id) ON DELETE CASCADE,
    agent_role  VARCHAR(50),
    content     TEXT        NOT NULL,
    memory_type VARCHAR(50) DEFAULT 'short_term',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_os_custom_presets (
    id         TEXT PRIMARY KEY,
    data       JSONB       NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_os_task_metrics (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id       UUID REFERENCES agent_os_tasks(id) ON DELETE CASCADE,
    agent_role    VARCHAR(100) NOT NULL,
    preset_id     TEXT,
    model         VARCHAR(100),
    input_tokens  INT         DEFAULT 0,
    output_tokens INT         DEFAULT 0,
    cost_usd      FLOAT       DEFAULT 0,
    latency_ms    INT         DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_os_tasks_user_id          ON agent_os_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_os_messages_task_id       ON agent_os_messages(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_os_subtasks_task_id       ON agent_os_subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_os_memory_task_agent      ON agent_os_memory(task_id, agent_role);
CREATE INDEX IF NOT EXISTS idx_agent_os_task_metrics_task_id   ON agent_os_task_metrics(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_os_task_metrics_preset_id ON agent_os_task_metrics(preset_id);
"""
