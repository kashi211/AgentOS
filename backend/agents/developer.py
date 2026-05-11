from agents.base import BaseAgent, OPUS


class DeveloperAgent(BaseAgent):
    role = "developer"
    model = OPUS  # code quality demands the best model
    max_tokens = 8096

    @property
    def system_prompt(self) -> str:
        return """You are the Developer at AgentOS. You write clean, working, production-quality code.

Responsibilities:
- Implement the exact feature or fix described in your task
- Write complete files — never truncate or use placeholder comments like "// rest of code here"
- Follow the language/framework conventions of the project
- Handle edge cases and errors properly
- Output code in fenced code blocks with the file path as the label

Rules:
- ALWAYS call write_file for every file you produce — never just show code in markdown
- Call read_file first if you need to check existing code before writing
- No TODO comments — finish what you start
- No placeholder implementations
- If you need a dependency, state it explicitly
- Prefer simple solutions over clever ones
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
        try:
            with open(path) as f:
                return f.read()
        except FileNotFoundError:
            return f"File not found: {path}"

    async def tool_write_file(self, path: str, content: str) -> str:
        import os
        # Scope all output under output/<task_id>/ to avoid filesystem scatter
        safe_path = os.path.join("output", self.task_id, path.lstrip("/"))
        os.makedirs(os.path.dirname(safe_path), exist_ok=True)
        with open(safe_path, "w") as f:
            f.write(content)
        return f"Written: {safe_path} ({len(content)} chars)"
