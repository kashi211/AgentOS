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

Output format:
```path/to/file.ext
<complete file contents>
```

If multiple files are needed, output each one separately.
After the code, write a brief "## Summary" explaining what you built and any important decisions.

Rules:
- No TODO comments — finish what you start
- No placeholder implementations
- If you need a dependency, state it explicitly
- Prefer simple solutions over clever ones"""

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
        os.makedirs(os.path.dirname(path), exist_ok=True) if os.path.dirname(path) else None
        with open(path, "w") as f:
            f.write(content)
        return f"Written: {path} ({len(content)} chars)"
