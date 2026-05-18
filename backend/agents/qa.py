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
        return """You are the QA Agent at AgentOS. You verify that code actually works by ACTUALLY RUNNING IT in a real browser — not just reading the source.

## Your process (follow every time)
1. Call list_files to see what files exist.
2. For HTML/JS apps: call browser_test with meaningful test steps that exercise the app's features.
   - browser_test loads all the files, starts a local HTTP server, opens Chromium, runs your steps, and returns console errors, JS exceptions, screenshots, and assertion results.
   - ALWAYS include a "screenshot" step so you can see what the page looks like.
   - Write steps that exercise every major feature (click buttons, fill forms, check results appear).
3. Read the browser_test results carefully: js_errors and console_errors are the most important signals.
4. For Python apps: call read_file on the main .py and requirements.txt, then do static analysis.
5. Return your JSON verdict.

## CRITICAL: What counts as a deliverable
- A valid deliverable is runnable code: .html, .js, .py, .ts, .css, or similar code files.
- Documentation files (.md, .txt, .pdf) are NEVER a valid deliverable on their own.
- If list_files shows ONLY .md or documentation files and NO runnable code, set passed=false immediately with score=1. Do not read them or give partial credit.
- The step description may say "design" or "plan" — that is the planner's mistake. Your job is to verify that runnable code exists. If it doesn't, fail.

## CRITICAL: Technology/framework choice is NOT your concern
- The step description might say "React app" or "Vue component" — that is the planner's suggestion, not a hard requirement.
- If the developer built vanilla HTML/JS/CSS instead of React, and the app works correctly, that is a PASS.
- NEVER fail because the technology used differs from the step description. Only fail if the FUNCTIONALITY is missing or broken.
- Do not mention framework mismatch in your issues or feedback.

## CRITICAL: UI copy is cosmetic, not functional
- Button labels, heading text, placeholder text, and other UI copy are cosmetic details.
- If the step description says "Book Now" but the developer wrote "Confirm Booking" — that is a PASS.
- If the step description mentions specific wording but the app is otherwise fully functional — that is a PASS.
- ONLY fail for copy differences if the step's PRIMARY goal is writing specific copy (e.g., "marketing landing page with exact copy provided").

## Checklist for HTML/JS apps (browser_test driven)

**Step 1 — Does it load?**
- js_errors list MUST be empty. Any uncaught JS exception = automatic fail.
- console_errors should be empty. Ignored errors (e.g. favicon 404) are fine.
- page_title should not be empty.

**Step 2 — Does it render?**
- Use dom_snapshot to verify the body has real content (not empty or just an error message).

**Step 3 — Does each feature work?**
- Write assert_visible / assert_text / click steps that exercise every feature in the task description.
- A failed assert step = fail.
- If a button does nothing when clicked (no DOM change, no state update) = fail.

**Step 4 — Does it stay stable?**
- No new js_errors after interactions.

## Example browser_test steps for a booking app:
[
  {"action": "assert_visible", "selector": "h1"},
  {"action": "click", "selector": "#service-btn"},
  {"action": "assert_visible", "selector": ".service-list"},
  {"action": "click", "selector": ".service-item:first-child"},
  {"action": "fill", "selector": "#name", "value": "Test User"},
  {"action": "click", "selector": "#confirm"},
  {"action": "assert_text", "selector": ".confirmation", "contains": "booked"}
]

## Checklist for Python apps (static analysis)
- [ ] Main .py file exists and requirements.txt exists
- [ ] Imports match what the code uses
- [ ] Core logic looks correct for the described purpose

## Scoring
- **9–10**: All steps pass, no JS errors, app works end-to-end
- **7–8**: Works correctly, one minor assertion off (pass)
- **5–6**: Page loads but a key feature is broken or missing (fail)
- **1–4**: JS errors on load, page blank, or core interactions fail (fail)
- **1**: Only documentation files exist, no runnable code (automatic fail)

Score 7+ passes. Below 7 fails.

## Feedback rules
- If you FAIL: quote the exact js_error or failed step and what the fix must be. Be specific.
- If you PASS: briefly describe what the browser test verified.
- Do NOT fail for cosmetic reasons (colours, fonts, layout preferences, button text wording) unless the task specifically requires them.
- Do NOT fail because the technology/framework differs from the step description — only functionality matters.

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
                "name": "list_files",
                "description": "List all files written for this task",
                "input_schema": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                },
            },
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
                "name": "browser_test",
                "description": (
                    "Load the app in a real headless Chromium browser and run test steps. "
                    "Returns console errors, uncaught JS exceptions, screenshots (base64), and step results. "
                    "Use this for all HTML/JS apps — it actually runs the code, not just reads it."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "entry_point": {
                            "type": "string",
                            "description": "The HTML file to open (default: 'index.html')",
                            "default": "index.html",
                        },
                        "steps": {
                            "type": "array",
                            "description": (
                                "List of test steps to execute. Each step has an 'action' and optional fields. "
                                "Actions: click, fill, select, assert_visible, assert_not_visible, "
                                "assert_text, get_text, dom_snapshot, wait. "
                                "Fields: selector (CSS), value (for fill/select), contains (for assert_text), ms (for wait). "
                                "DO NOT use 'screenshot' — images are stripped to keep context size small."
                            ),
                            "items": {
                                "type": "object",
                                "properties": {
                                    "action": {"type": "string"},
                                    "selector": {"type": "string"},
                                    "value": {"type": "string"},
                                    "contains": {"type": "string"},
                                    "ms": {"type": "integer"},
                                },
                                "required": ["action"],
                            },
                        },
                    },
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
        # Return just the file paths (not the internal dict structure)
        paths = [f["path"] if isinstance(f, dict) else f for f in files]
        return json.dumps(paths, indent=2)

    async def tool_browser_test(
        self,
        entry_point: str = "index.html",
        steps: list[dict] | None = None,
    ) -> str:
        """
        Download all task files from R2, spin up a headless Chromium browser,
        navigate to entry_point, run steps, and return results as JSON.
        Screenshots are returned as base64 strings inside the JSON.
        """
        from storage.r2 import list_files, read_file
        from sandbox.browser import run_browser_test

        # Pull all files for this task from R2
        file_list = list_files(self.output_task_id)
        if not file_list:
            return json.dumps({
                "ok": False,
                "error": "No files found in storage for this task.",
                "console_errors": [],
                "js_errors": [],
                "step_results": [],
            })

        files: dict[str, str] = {}
        for entry in file_list:
            # list_files returns [{"path": "index.html", "size": 123}, ...]
            filename = entry["path"] if isinstance(entry, dict) else entry
            content = read_file(self.output_task_id, filename)
            if content:
                files[filename] = content

        if not files:
            return json.dumps({
                "ok": False,
                "error": "Could not read any files from storage.",
                "console_errors": [],
                "js_errors": [],
                "step_results": [],
            })

        try:
            result = await run_browser_test(
                files=files,
                entry_point=entry_point,
                steps=steps or [],
            )
        except Exception as e:
            import traceback
            print(f"[browser_test] unexpected error: {e}\n{traceback.format_exc()}")
            return json.dumps({
                "ok": False,
                "error": f"Browser test runner crashed: {e}. Fall back to static analysis.",
                "console_errors": [],
                "js_errors": [],
                "step_results": [],
            })

        # Strip all screenshot base64 data — images are too large for the context window.
        result.pop("screenshots", None)
        result.pop("first_screenshot_base64", None)
        result.pop("last_screenshot_base64", None)
        for step in result.get("step_results", []):
            step.pop("screenshot_base64", None)

        return json.dumps(result, indent=2)
