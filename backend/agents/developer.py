from agents.base import BaseAgent, OPUS


class DeveloperAgent(BaseAgent):
    role = "developer"
    model = OPUS  # code quality demands the best model
    max_tokens = 8096
    output_task_id: str  # where write_file actually writes — may differ from task_id on edits

    def __init__(self, task_id: str, memory, output_task_id: str | None = None):
        super().__init__(task_id, memory)
        self.output_task_id = output_task_id or task_id

    @property
    def system_prompt(self) -> str:
        return """You are the Developer at AgentOS. You write clean, working, production-quality code.

## What to build

**For user-facing apps** (calculators, games, todo lists, dashboards, converters, timers, forms, visualizations, anything a user interacts with):
→ Build ONE file: `index.html`. Everything — HTML, CSS, and JavaScript — must be embedded inside it.

STRICT rules for index.html:
- Put ALL styles inside a `<style>` tag in `<head>`. NEVER use `<link rel="stylesheet" href="...">` for local files.
- Put ALL JavaScript inside a `<script>` tag at the bottom of `<body>`. NEVER use `<script src="...">` for local files.
- CDN links for libraries are fine (e.g. `<script src="https://cdn.jsdelivr.net/..."></script>`).
- The file must work by opening it directly in a browser with no server — no fetch() calls to relative URLs.
- call write_file with path = "index.html" (just the filename, not a directory path).

**For APIs and backend services**:
→ Build Python (FastAPI or stdlib). Include requirements.txt and a README.md.

**For CLI utilities**:
→ Build a Python script with a clear docstring explaining usage.

## Rules
- ALWAYS call write_file for every file — never just show code in markdown
- write_file paths must be simple filenames or subdirs: "index.html", "app.py", "utils/helper.py"
  NEVER pass a path starting with "output/" — that is added automatically
- Call read_file first if you need to check existing code before modifying it
- No TODO comments — finish what you start
- No placeholder implementations
- After writing all files, write a brief "## Summary" listing what was written"""

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
        ]

    async def tool_read_file(self, path: str) -> str:
        import os
        # Try path as-is first, then inside the project output dir
        candidates = [path, os.path.join("output", self.output_task_id, path.lstrip("/"))]
        for p in candidates:
            try:
                with open(p) as f:
                    return f.read()
            except FileNotFoundError:
                continue
        return f"File not found: {path}"

    async def tool_write_file(self, path: str, content: str) -> str:
        import os, re
        # Strip any leading output/<uuid>/ prefix the model mistakenly adds
        path = re.sub(r"^output/[0-9a-f\-]+/", "", path.lstrip("/"))
        safe_path = os.path.join("output", self.output_task_id, path)
        os.makedirs(os.path.dirname(safe_path) or ".", exist_ok=True)
        with open(safe_path, "w") as f:
            f.write(content)
        return f"Written: {safe_path} ({len(content)} chars)"
