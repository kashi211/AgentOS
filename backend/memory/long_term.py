"""Long-term cross-task memory using Pinecone vector search."""
from __future__ import annotations
import hashlib
from config import settings

_pc = None
_index = None


def _get_index():
    global _pc, _index
    if not settings.pinecone_api_key:
        return None
    if _index is None:
        from pinecone import Pinecone, ServerlessSpec
        _pc = Pinecone(api_key=settings.pinecone_api_key)
        # Create index if not exists (dimension 1024 for multilingual-e5-large)
        existing = [i.name for i in _pc.list_indexes()]
        if settings.pinecone_index not in existing:
            _pc.create_index(
                name=settings.pinecone_index,
                dimension=1024,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
        _index = _pc.Index(settings.pinecone_index)
    return _index


def _embed(texts: list[str]) -> list[list[float]]:
    """Use Pinecone's hosted inference to embed texts."""
    if not _pc:
        return []
    result = _pc.inference.embed(
        model="multilingual-e5-large",
        inputs=texts,
        parameters={"input_type": "passage", "truncate": "END"},
    )
    return [r.values for r in result]


async def store_memory(task_id: str, agent_role: str, goal: str, content: str):
    """Store an agent output as a long-term memory vector."""
    index = _get_index()
    if not index:
        return
    try:
        text = f"Goal: {goal}\nAgent: {agent_role}\nOutput: {content[:1500]}"
        embeddings = _embed([text])
        if not embeddings:
            return
        vector_id = hashlib.md5(f"{task_id}:{agent_role}".encode()).hexdigest()
        index.upsert(vectors=[{
            "id": vector_id,
            "values": embeddings[0],
            "metadata": {
                "task_id": task_id,
                "agent_role": agent_role,
                "goal": goal[:200],
                "content": content[:500],
            },
        }])
    except Exception as e:
        print(f"[pinecone] store failed: {e}")


async def retrieve_memories(query: str, top_k: int = 3, exclude_task_id: str = "") -> list[str]:
    """Retrieve relevant past agent outputs for context."""
    index = _get_index()
    if not index:
        return []
    try:
        embeddings = _embed([query])
        if not embeddings:
            return []
        results = index.query(vector=embeddings[0], top_k=top_k + 2, include_metadata=True)
        memories = []
        for match in results.matches:
            if match.metadata.get("task_id") == exclude_task_id:
                continue
            if match.score < 0.7:
                continue
            role = match.metadata.get("agent_role", "agent")
            content = match.metadata.get("content", "")
            goal = match.metadata.get("goal", "")
            memories.append(f"[Past {role} on '{goal}']: {content}")
            if len(memories) >= top_k:
                break
        return memories
    except Exception as e:
        print(f"[pinecone] retrieve failed: {e}")
        return []
