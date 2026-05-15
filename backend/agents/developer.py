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

## Summary (required after every task)
After writing all files, output a "## Summary" section that includes:
- Which files were written
- The exact before→after values for every change made (e.g. `background: #e0e7ff` → `background: #000000`)
- This lets QA verify the change without needing raw file output"""

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
