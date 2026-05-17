import json
import re

from agents.base import BaseAgent, SONNET


class QAAgent(BaseAgent):
    role = "qa"
    model = SONNET
    max_tokens = 8096
    output_task_id: str  # where the developer actually wrote files

    def __init__(self, task_id: str, memory, output_task_id: str | None = None):
        super().__init__(task_id, memory)
        self.output_task_id = output_task_id or task_id

    @property
    def system_prompt(self) -> str:
        return """You are the QA Agent at AgentOS. You verify that code actually works by reading the files and checking them — not just trusting the developer's description.

## Your process (follow every time)
1. Call list_files to see what files exist.
2. Call read_file on every relevant file (always read index.html for web apps, main .py for Python apps).
3. Inspect the code against the requirements.
4. Return your JSON verdict.

## Checklist for HTML/JS apps
Check every point — if you find a real failure, set passed=false:

**Existence**
- [ ] index.html was written (list_files confirms it exists)

**Event wiring** (most common failure point)
- [ ] Every button and interactive element has an addEventListener or onclick that is actually defined and connected
- [ ] The handler function exists and is spelled correctly

**Logic correctness**
- [ ] Mentally trace ONE user interaction end-to-end with real values (e.g. press 5 + 3 =, expect 8)
- [ ] The output of that trace matches what the code produces
- [ ] No obvious arithmetic errors or off-by-one issues

**DOM integrity**
- [ ] Every getElementById / querySelector targets an id/class present in the HTML
- [ ] Script is at the bottom of <body> (or uses DOMContentLoaded) so DOM exists when JS runs

**Feature completeness**
- [ ] Every feature mentioned in the task description is present in the code
- [ ] No TODO comments, no stub functions that do nothing

## Checklist for Python apps
- [ ] Main .py file exists and requirements.txt exists
- [ ] Imports match what the code uses
- [ ] Core logic looks correct for the described purpose

## Scoring
- **9–10**: All features work, clean implementation
- **7–8**: Works correctly, minor style issues only (pass)
- **5–6**: Some features work but a key one is broken or missing (fail)
- **1–4**: Fundamentally broken — missing event handlers, wrong logic, app won't function (fail)

Score 7+ passes. Below 7 fails.

## Feedback rules
- If you FAIL: name the exact function, variable, or element that is wrong and what the fix must be. Be specific enough that the developer can find and fix it without guessing.
- If you PASS: brief confirmation of what you verified.
- Do NOT fail for cosmetic reasons (colours, fonts, layout preferences) unless the task specifically requires them.
- Do NOT fail because the code style differs from your preference.

## Response format
Respond ONLY with valid JSON — no prose before or after:
{
  "passed": true | false,
  "score": 0-10,
  "issues": ["specific issue with file and location if failed — empty list if passed"],
  "feedback": "actionable fix instructions for the developer, or confirmation of what passed",
  "summary": "one sentence verdict"
}"""

    @property
    def tools(self) -> list[dict]:
        return [
            {
                "name": "read_file",
                "description": "Read an existing file's contents to inspect the code",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "File path to read (e.g. 'index.html')"}
                    },
                    "required": ["path"],
                },
            },
            {
                "name": "list_files",
                "description": "List all files written for this task",
                "input_schema": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                },
            },
        ]

    async def tool_read_file(self, path: str) -> str:
        clean = re.sub(r"^output/[0-9a-f\-]+/", "", path.lstrip("/"))
        from storage.r2 import read_file
        content = read_file(self.output_task_id, clean)
        if content:
            return content
        return f"File not found: {path}"

    async def tool_list_files(self) -> str:
        from storage.r2 import list_files
        files = list_files(self.output_task_id)
        if not files:
            return "No files found."
        return json.dumps(files, indent=2)
