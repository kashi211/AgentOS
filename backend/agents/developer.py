from agents.base import BaseAgent, _SONNET


class DeveloperAgent(BaseAgent):
    role = "developer"
    model = _SONNET  # always use best coding model — bypasses DEV_MODE Haiku downgrade
    max_tokens = 16000
    output_task_id: str  # where write_file actually writes — may differ from task_id on edits

    def __init__(self, task_id: str, memory, output_task_id: str | None = None):
        super().__init__(task_id, memory)
        self.output_task_id = output_task_id or task_id

    @property
    def system_prompt(self) -> str:
        return """You are the Developer at AgentOS. You write clean, complete, working code. QA will read your actual files — not just your description — so the code must genuinely work.

## What to build

**For user-facing apps** (calculators, games, todo lists, dashboards, converters, timers, forms, visualizations, anything a user interacts with):
→ Build ONE file: `index.html`. Everything — HTML, CSS, and JavaScript — must be embedded inside it.

STRICT rules for index.html:
- Put ALL styles inside a `<style>` tag in `<head>`. NEVER use `<link rel="stylesheet" href="...">` for local files.
- Put ALL JavaScript inside a `<script>` tag at the bottom of `<body>`. This ensures every HTML element exists before JS runs.
- CDN links for libraries are fine (e.g. `<script src="https://cdn.jsdelivr.net/..."></script>`).
- The file must work by opening it directly in a browser — no fetch() to relative URLs, no ES modules, no build step.
- Call write_file with path = "index.html" (just the filename, not a directory path).

**For APIs and backend services**:
→ Build Python (FastAPI or stdlib). Include requirements.txt and a README.md.

**For CLI utilities**:
→ Build a Python script with a clear docstring explaining usage.

## JavaScript quality checklist — verify EVERY point before writing

1. **Event wiring**: Every button and interactive element has a working addEventListener or onclick. List them mentally: button → handler → what it does. No orphaned elements.
2. **Logic trace**: Before writing, trace ONE full user interaction end-to-end. For a calculator: "user presses 5, +, 3, = → display should show 8". Confirm your code produces that.
3. **State initialisation**: Every variable used in event handlers is declared and initialised at the top of the script. No `undefined` surprises.
4. **DOM references**: Every `getElementById` / `querySelector` call targets an id/class that exists in the HTML. Check each one.
5. **Function existence**: Every function name used in event listeners is actually defined. No typos.
6. **Math correctness**: Trace arithmetic with real numbers. Check operator precedence.
7. **Feature completeness**: Every feature in the task is implemented. No stubs, no TODOs, no "coming soon".
8. **Edge cases**: Empty input, zero, negative numbers, rapid clicks — handle them or at least not crash.

## Self-verification (required before finishing)
After writing all files:
1. Call list_files to confirm the file was saved.
2. Re-read the critical JS logic (the main event handler or game loop) and trace through it once more.
3. Only then write your ## Summary.

## General rules
- ALWAYS call write_file for every file — never just show code in markdown
- write_file paths: simple filenames only ("index.html", "app.py"). NEVER prefix with "output/"
- Call read_file before modifying existing code
- No TODO comments or placeholder implementations — finish everything

## Summary (required after every task)
After writing all files, output a "## Summary" section:
- Files written and approximate size
- Main features implemented
- For edits: exact before → after values for every change
- Any assumptions or limitations"""

    @property
    def tools(self) -> list[dict]:
        return [
            {
                "name": "read_file",
                "description": "Read an existing file's contents",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "File path to read"}
                    },
                    "required": ["path"],
                },
            },
            {
                "name": "write_file",
                "description": "Write contents to a file",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "content": {"type": "string"},
                    },
                    "required": ["path", "content"],
                },
            },
            {
                "name": "list_files",
                "description": "List all files written so far for this task",
                "input_schema": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                },
            },
            {
                "name": "delete_file",
                "description": "Delete a file from the task output directory",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "File path to delete"},
                    },
                    "required": ["path"],
                },
            },
            {
                "name": "move_file",
                "description": "Rename or move a file within the task output directory",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "src": {"type": "string", "description": "Source file path"},
                        "dst": {"type": "string", "description": "Destination file path"},
                    },
                    "required": ["src", "dst"],
                },
            },
        ]

    async def tool_read_file(self, path: str) -> str:
        import re
        # Strip any leading output/<uuid>/ prefix the model mistakenly adds
        clean = re.sub(r"^output/[0-9a-f\-]+/", "", path.lstrip("/"))
        from storage.r2 import read_file
        content = read_file(self.output_task_id, clean)
        if content:
            return content
        return f"File not found: {path}"

    async def tool_write_file(self, path: str, content: str) -> str:
        import re
        # Strip any leading output/<uuid>/ prefix the model mistakenly adds
        clean = re.sub(r"^output/[0-9a-f\-]+/", "", path.lstrip("/"))
        from storage.r2 import write_file
        return write_file(self.output_task_id, clean, content)

    async def tool_list_files(self) -> str:
        from storage.r2 import list_files
        import json
        files = list_files(self.output_task_id)
        if not files:
            return "No files found."
        return json.dumps(files, indent=2)

    async def tool_delete_file(self, path: str) -> str:
        import re, os
        clean = re.sub(r"^output/[0-9a-f\-]+/", "", path.lstrip("/"))
        local = os.path.join("output", self.output_task_id, clean)
        if os.path.exists(local):
            os.remove(local)
            return f"Deleted {clean}."
        return f"File not found: {clean}"

    async def tool_move_file(self, src: str, dst: str) -> str:
        import re, os, shutil
        clean_src = re.sub(r"^output/[0-9a-f\-]+/", "", src.lstrip("/"))
        clean_dst = re.sub(r"^output/[0-9a-f\-]+/", "", dst.lstrip("/"))
        base = os.path.join("output", self.output_task_id)
        src_path = os.path.join(base, clean_src)
        dst_path = os.path.join(base, clean_dst)
        if not os.path.exists(src_path):
            return f"Source not found: {clean_src}"
        os.makedirs(os.path.dirname(dst_path), exist_ok=True)
        shutil.move(src_path, dst_path)
        return f"Moved {clean_src} → {clean_dst}."
