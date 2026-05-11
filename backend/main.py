from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.connection import init_db, close_db
from routes.tasks import router as tasks_router
from routes.ws import router as ws_router
from routes.run import router as run_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(title="AgentOS API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://agentos.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
app.include_router(ws_router, prefix="/ws", tags=["websocket"])
app.include_router(run_router, prefix="/tasks", tags=["run"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
