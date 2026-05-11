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
→ Build a SINGLE self-contained `index.html` with all CSS and JavaScript embedded inline.
  - Use vanilla HTML/CSS/JS — no build step, no npm, no external framework downloads
  - CDN links (e.g. Chart.js from cdnjs) are allowed for charting/utility libraries only
  - Make it look polished: clean modern design, good spacing, readable typography, subtle colors
  - The file must work by simply opening it in a browser — no server required
  - Always write_file with path = "index.html"

**For APIs and backend services** (REST APIs, data pipelines, automation scripts called by other code):
→ Build Python (FastAPI or stdlib). Include requirements.txt and a README.md.

**For CLI utilities** (scripts the user runs in a terminal):
→ Build a Python script with a clear docstring explaining usage.

## Rules
- ALWAYS call write_file for every file — never just show code in markdown
- Call read_file first if you need to check existing code before modifying it
- No TODO comments — finish what you start
- No placeholder implementations
- Prefer simple, working solutions over clever ones
- After writing all files, write a brief "## Summary" listing the files written and key decisions"""

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
        import os
        # Write to output_task_id dir (may differ from task_id on edit runs)
        safe_path = os.path.join("output", self.output_task_id, path.lstrip("/"))
        os.makedirs(os.path.dirname(safe_path), exist_ok=True)
        with open(safe_path, "w") as f:
            f.write(content)
        return f"Written: {safe_path} ({len(content)} chars)"
