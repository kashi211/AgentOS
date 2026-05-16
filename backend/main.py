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
from routes.questions import router as questions_router
from routes.summary import router as summary_router
from routes.auth import router as auth_router
from routes.metrics import router as metrics_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("output", exist_ok=True)
    await init_db()

    # Re-run any tasks that were interrupted by the previous server shutdown
    from worker import recover_on_startup
    await recover_on_startup()

    yield

    await close_db()


app = FastAPI(title="AgentOS API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
app.include_router(ws_router, prefix="/ws", tags=["websocket"])
app.include_router(run_router, prefix="/tasks", tags=["run"])
app.include_router(edit_router, prefix="/tasks", tags=["edit"])
app.include_router(presets_router, prefix="/presets", tags=["presets"])
app.include_router(questions_router, prefix="/tasks", tags=["questions"])
app.include_router(summary_router, prefix="/tasks", tags=["summary"])
app.include_router(metrics_router)

app.mount("/output", StaticFiles(directory="output"), name="output")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
