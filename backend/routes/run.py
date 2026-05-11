import asyncio
import os
import uuid

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

router = APIRouter()

# Maps run_id -> absolute path of the file to execute
_pending: dict[str, str] = {}

TIMEOUT_SECONDS = 60


class RunRequest(BaseModel):
    file: str


@router.post("/{task_id}/run")
async def start_run(task_id: str, body: RunRequest):
    output_dir = os.path.join("output", task_id)
    safe = os.path.realpath(os.path.join(output_dir, body.file))
    root = os.path.realpath(output_dir)
    if not safe.startswith(root + os.sep) and safe != root:
        raise HTTPException(400, "Invalid path")
    if not os.path.isfile(safe):
        raise HTTPException(404, "File not found")

    run_id = str(uuid.uuid4())
    _pending[run_id] = safe
    return {"run_id": run_id}


@router.websocket("/run/{run_id}")
async def run_ws(ws: WebSocket, run_id: str):
    await ws.accept()

    safe = _pending.pop(run_id, None)
    if not safe:
        await ws.send_text("\r\n[error: unknown run_id]\r\n")
        await ws.close(1008)
        return

    proc = await asyncio.create_subprocess_exec(
        "python3", "-u", safe,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )

    async def stream_output():
        assert proc.stdout
        while True:
            chunk = await proc.stdout.read(256)
            if not chunk:
                break
            try:
                await ws.send_text(chunk.decode(errors="replace"))
            except Exception:
                break
        code = await proc.wait()
        try:
            await ws.send_text(f"\r\n[process exited with code {code}]\r\n")
            await ws.close()
        except Exception:
            pass

    async def receive_input():
        assert proc.stdin
        try:
            while True:
                data = await ws.receive_text()
                proc.stdin.write(data.encode())
                await proc.stdin.drain()
        except WebSocketDisconnect:
            pass
        except Exception:
            pass
        finally:
            try:
                proc.stdin.close()
            except Exception:
                pass

    try:
        await asyncio.wait_for(
            asyncio.gather(stream_output(), receive_input()),
            timeout=TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        try:
            await ws.send_text(f"\r\n[process killed after {TIMEOUT_SECONDS}s timeout]\r\n")
            await ws.close()
        except Exception:
            pass
    except Exception:
        pass
    finally:
        try:
            proc.kill()
        except Exception:
            pass
