"""
browser.py — Playwright-based sandbox for QA agent browser testing.

Workflow:
  1. Receive a dict of {filename: content} files (from R2)
  2. Write them to a temp directory
  3. Serve via a local HTTP server (handles relative asset paths)
  4. Launch headless Chromium, navigate, run test steps
  5. Return structured results (console logs, errors, screenshots, DOM checks)
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import tempfile
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Any


# ── Local HTTP server ─────────────────────────────────────────────────────────

class _QuietHandler(SimpleHTTPRequestHandler):
    """Serves files from a fixed directory, suppresses access logs."""

    def __init__(self, *args, directory: str, **kwargs):
        self._serve_dir = directory
        super().__init__(*args, directory=directory, **kwargs)

    def log_message(self, fmt, *args):  # silence request logs
        pass

    def log_error(self, fmt, *args):
        pass


def _start_server(directory: str) -> tuple[HTTPServer, int]:
    """Start an HTTP server on a free port in a background thread."""
    server = HTTPServer(
        ("127.0.0.1", 0),
        lambda *a, **kw: _QuietHandler(*a, directory=directory, **kw),
    )
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, port


# ── Test step executor ────────────────────────────────────────────────────────

async def _execute_steps(page, steps: list[dict]) -> list[dict]:
    """Execute a list of test steps on a Playwright page. Returns result dicts."""
    results = []

    for step in steps:
        action = step.get("action", "").lower()
        selector = step.get("selector", "")
        result: dict[str, Any] = {"action": action, "ok": True}

        try:
            if action == "screenshot":
                png = await page.screenshot(full_page=True)
                result["screenshot_base64"] = base64.b64encode(png).decode()
                result["note"] = "Screenshot captured"

            elif action == "click":
                await page.wait_for_selector(selector, timeout=5000)
                await page.click(selector)
                result["note"] = f"Clicked {selector!r}"

            elif action == "fill":
                value = step.get("value", "")
                await page.wait_for_selector(selector, timeout=5000)
                await page.fill(selector, value)
                result["note"] = f"Filled {selector!r} with {value!r}"

            elif action == "select":
                value = step.get("value", "")
                await page.wait_for_selector(selector, timeout=5000)
                await page.select_option(selector, value)
                result["note"] = f"Selected {value!r} in {selector!r}"

            elif action == "assert_visible":
                await page.wait_for_selector(selector, timeout=5000)
                visible = await page.is_visible(selector)
                result["ok"] = visible
                result["note"] = f"{selector!r} is {'visible' if visible else 'NOT visible'}"

            elif action == "assert_text":
                contains = step.get("contains", "")
                await page.wait_for_selector(selector, timeout=5000)
                text = await page.inner_text(selector)
                result["ok"] = contains.lower() in text.lower()
                result["actual_text"] = text[:300]
                result["note"] = (
                    f"{selector!r} contains {contains!r}: {result['ok']}"
                )

            elif action == "assert_not_visible":
                visible = await page.is_visible(selector)
                result["ok"] = not visible
                result["note"] = f"{selector!r} is {'visible (unexpected)' if visible else 'not visible (correct)'}"

            elif action == "wait":
                ms = int(step.get("ms", 500))
                await asyncio.sleep(ms / 1000)
                result["note"] = f"Waited {ms}ms"

            elif action == "get_text":
                await page.wait_for_selector(selector, timeout=5000)
                text = await page.inner_text(selector)
                result["text"] = text[:500]
                result["note"] = f"Text of {selector!r}: {text[:200]!r}"

            elif action == "dom_snapshot":
                # Return a trimmed DOM snapshot (body only, truncated)
                body_html = await page.evaluate("document.body.innerHTML")
                result["dom"] = body_html[:3000]
                result["note"] = "DOM snapshot captured (first 3000 chars)"

            elif action == "console_errors":
                # Caller should collect these via the listener — this is a no-op marker
                result["note"] = "Console errors are returned in the top-level 'console_errors' field"

            else:
                result["ok"] = False
                result["note"] = f"Unknown action: {action!r}"

        except Exception as e:
            result["ok"] = False
            result["error"] = str(e)
            result["note"] = f"Step failed: {e}"

        results.append(result)

    return results


# ── Public API ────────────────────────────────────────────────────────────────

async def run_browser_test(
    files: dict[str, str],          # {filename: text_content} from R2
    entry_point: str = "index.html",
    steps: list[dict] | None = None,
    timeout_ms: int = 30_000,
) -> dict:
    """
    Load `files` into a temp dir, serve them over HTTP, navigate Playwright
    to `entry_point`, execute `steps`, and return a result dict:

    {
        "ok": bool,
        "entry_point": str,
        "url": str,
        "page_title": str,
        "console_logs": [...],
        "console_errors": [...],
        "js_errors": [...],          # uncaught JS exceptions
        "step_results": [...],
        "error": str | None,         # top-level error if launch failed
    }
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return {
            "ok": False,
            "error": "playwright not installed — run: pip install playwright && playwright install chromium",
            "console_errors": [],
            "console_logs": [],
            "js_errors": [],
            "step_results": [],
        }

    console_logs: list[str] = []
    console_errors: list[str] = []
    js_errors: list[str] = []

    with tempfile.TemporaryDirectory(prefix="agent_os_qa_") as tmpdir:
        # Write all files to temp dir (create subdirs as needed)
        for filename, content in files.items():
            dest = Path(tmpdir) / filename
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(content, encoding="utf-8")

        # Verify entry point exists
        entry_path = Path(tmpdir) / entry_point
        if not entry_path.exists():
            # Try to find any .html file
            html_files = list(Path(tmpdir).rglob("*.html"))
            if html_files:
                entry_point = str(html_files[0].relative_to(tmpdir))
            else:
                return {
                    "ok": False,
                    "error": f"Entry point {entry_point!r} not found. Files: {list(files.keys())}",
                    "console_errors": [],
                    "console_logs": [],
                    "js_errors": [],
                    "step_results": [],
                }

        # Start local HTTP server
        server, port = _start_server(tmpdir)
        url = f"http://127.0.0.1:{port}/{entry_point}"

        try:
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                    ],
                )
                context = await browser.new_context(
                    viewport={"width": 1280, "height": 800},
                )
                page = await context.new_page()

                # Capture console output
                page.on("console", lambda msg: (
                    console_errors.append(f"[{msg.type}] {msg.text}")
                    if msg.type in ("error", "warning")
                    else console_logs.append(f"[{msg.type}] {msg.text}")
                ))

                # Capture uncaught JS exceptions
                page.on("pageerror", lambda err: js_errors.append(str(err)))

                # Navigate
                resp = await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                status = resp.status if resp else None

                # Small settle time for JS to initialise
                await asyncio.sleep(0.5)

                page_title = await page.title()

                # Execute test steps
                step_results = await _execute_steps(page, steps or [])

                # Skip auto-screenshot — base64 images bloat the LLM context window.
                # QA judges from js_errors, console_errors, and step_results instead.

                await browser.close()

        finally:
            server.shutdown()

    failed_steps = [s for s in step_results if not s.get("ok", True)]
    overall_ok = (
        len(js_errors) == 0
        and len(failed_steps) == 0
        and not any("error" in s for s in step_results if not s.get("ok", True))
    )

    return {
        "ok": overall_ok,
        "entry_point": entry_point,
        "url": url,
        "http_status": status,
        "page_title": page_title,
        "console_logs": console_logs[:50],
        "console_errors": console_errors[:50],
        "js_errors": js_errors[:20],
        "step_results": [
            {k: v for k, v in s.items() if k != "screenshot_base64"}  # strip from summary
            for s in step_results
        ],
        # Screenshots are available in step_results under screenshot_base64
        "screenshots": [
            s["screenshot_base64"]
            for s in step_results
            if "screenshot_base64" in s
        ],
    }
