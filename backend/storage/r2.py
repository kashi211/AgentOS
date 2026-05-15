"""Cloudflare R2 storage (S3-compatible). Falls back to local filesystem if not configured."""
from __future__ import annotations
import os
from config import settings

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    if not (settings.r2_account_id and settings.r2_access_key_id and settings.r2_secret_access_key):
        return None
    import boto3
    _client = boto3.client(
        "s3",
        endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
    )
    return _client


def write_file(task_id: str, filename: str, content: str) -> str:
    """Write a file. Uses R2 if configured, local filesystem otherwise."""
    client = _get_client()
    safe = os.path.basename(filename)
    if client:
        key = f"{task_id}/{safe}"
        client.put_object(
            Bucket=settings.r2_bucket_name,
            Key=key,
            Body=content.encode("utf-8"),
            ContentType="text/plain",
        )
        return f"Uploaded to R2: {key}"
    # Local fallback
    out = os.path.join("output", task_id)
    os.makedirs(out, exist_ok=True)
    path = os.path.join(out, safe)
    with open(path, "w") as f:
        f.write(content)
    return f"Written locally: {safe} ({len(content)} chars)"


def read_file(task_id: str, filename: str) -> str:
    """Read a file from R2 or local filesystem."""
    client = _get_client()
    safe = os.path.basename(filename)
    if client:
        try:
            resp = client.get_object(Bucket=settings.r2_bucket_name, Key=f"{task_id}/{safe}")
            return resp["Body"].read().decode("utf-8")
        except Exception:
            pass
    path = os.path.join("output", task_id, safe)
    if os.path.exists(path):
        with open(path) as f:
            return f.read()
    return ""


def list_files(task_id: str) -> list[dict]:
    """List all files for a task."""
    client = _get_client()
    files = []
    if client:
        try:
            resp = client.list_objects_v2(Bucket=settings.r2_bucket_name, Prefix=f"{task_id}/")
            for obj in resp.get("Contents", []):
                key = obj["Key"]
                rel = key[len(f"{task_id}/"):]
                if rel:
                    files.append({"path": rel, "size": obj["Size"]})
        except Exception:
            pass
    if not files:
        # Local fallback
        out = os.path.join("output", task_id)
        if os.path.isdir(out):
            for root, _, filenames in os.walk(out):
                for name in filenames:
                    full = os.path.join(root, name)
                    rel = os.path.relpath(full, out)
                    files.append({"path": rel, "size": os.path.getsize(full)})
    return sorted(files, key=lambda f: f["path"])
