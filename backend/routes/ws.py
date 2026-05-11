import json
from collections import defaultdict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

# task_id → set of connected WebSocket clients
_connections: dict[str, set[WebSocket]] = defaultdict(set)


@router.websocket("/{task_id}")
async def task_ws(websocket: WebSocket, task_id: str):
    await websocket.accept()
    _connections[task_id].add(websocket)
    try:
        while True:
            # Keep alive — client can send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        _connections[task_id].discard(websocket)


async def broadcast(task_id: str, event: dict):
    """Send an event to all WebSocket clients watching this task."""
    dead = set()
    for ws in _connections.get(task_id, set()):
        try:
            await ws.send_text(json.dumps(event))
        except Exception:
            dead.add(ws)
    for ws in dead:
        _connections[task_id].discard(ws)
