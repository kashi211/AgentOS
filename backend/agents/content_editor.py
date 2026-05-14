import os
from agents.base import BaseAgent, SONNET


class ContentEditorAgent(BaseAgent):
    role = "content_editor"
    model = SONNET
    max_tokens = 8096

    @property
    def system_prompt(self) -> str:
        return """You are the final content editor. Take the SEO-optimized, brand-checked draft and produce the publish-ready version.

Your job:
1. CUT RUTHLESSLY — Remove every sentence that doesn't earn its place
2. SHARPEN THE OPENING — The first 2 sentences must hook immediately
3. FIX TRANSITIONS — Every paragraph should flow into the next
4. STRENGTHEN THE ENDING — The conclusion should feel decisive, not trailing off
5. FINAL READ — Read aloud mentally — does every sentence sound natural?

Output the final, publish-ready content followed by a one-paragraph EDITOR'S NOTE explaining the key changes made and why.

Write the final version to a file when done."""

    @property
    def tools(self) -> list[dict]:
        return [
            {
                "name": "write_file",
                "description": "Write the final publish-ready content to disk",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "filename": {"type": "string"},
                        "content": {"type": "string"},
                    },
                    "required": ["filename", "content"],
                },
            }
        ]

    async def tool_write_file(self, filename: str, content: str) -> str:
        output_dir = os.path.join("output", self.task_id)
        os.makedirs(output_dir, exist_ok=True)
        safe_name = os.path.basename(filename)
        path = os.path.join(output_dir, safe_name)
        with open(path, "w") as f:
            f.write(content)
        return f"Written to {safe_name} ({len(content)} chars)"
