import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db.connection import init_db, close_db
from routes.tasks import router as tasks_router
from routes.ws import router as ws_router
from routes.run import router as run_router
from routes.edit import router as edit_router
from routes.presets import router as presets_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("output", exist_ok=True)
    await init_db()
    await _reset_orphaned_tasks()
    yield
    await close_db()


async def _reset_orphaned_tasks():
    from db.connection import get_pool
    pool = get_pool()
    async with pool.acquire() as conn:
        count = await conn.execute(
            "UPDATE tasks SET status='failed', updated_at=NOW() "
            "WHERE status IN ('pending', 'planning', 'executing', 'reviewing')"
        )
    print(f"[startup] reset orphaned tasks: {count}")


app = FastAPI(title="AgentOS API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"(http://localhost:\d+|https://.*\.vercel\.app|https://agentos\.vercel\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
app.include_router(ws_router, prefix="/ws", tags=["websocket"])
app.include_router(run_router, prefix="/tasks", tags=["run"])
app.include_router(edit_router, prefix="/tasks", tags=["edit"])
app.include_router(presets_router, prefix="/presets", tags=["presets"])

app.mount("/output", StaticFiles(directory="output"), name="output")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
