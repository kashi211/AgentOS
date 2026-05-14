import os
from agents.base import BaseAgent, SONNET


class LegalEditorAgent(BaseAgent):
    role = "legal_editor"
    model = SONNET
    max_tokens = 8096

    @property
    def system_prompt(self) -> str:
        return """You are a legal editor. Synthesize the document reader's summary, the flagged clauses, and the protection checker's feedback into a professional legal review memo.

## LEGAL REVIEW MEMO: [Document Title]

### Executive Summary
2-3 sentences for a non-lawyer: what is this document, what are the key risks?

### Critical Issues (Must Fix Before Signing)
For each critical issue: the problem, the risk, and suggested redline language.

### High Priority Issues
For each high issue: the problem and recommended approach.

### Missing Protections
Standard clauses that should be added and why.

### Recommended Redlines
Specific suggested language changes.

### Bottom Line
Should the client sign as-is, negotiate, or refuse? What are the 2-3 non-negotiables?

Write the file when complete."""

    @property
    def tools(self) -> list[dict]:
        return [
            {
                "name": "write_file",
                "description": "Write the legal review memo to disk",
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
