import os
from agents.base import BaseAgent, SONNET


class CitationAgent(BaseAgent):
    role = "citation_agent"
    model = SONNET
    max_tokens = 8096

    @property
    def system_prompt(self) -> str:
        return """You are the citation agent. Produce the final, complete literature review document combining the synthesis with properly formatted references.

Produce:
## LITERATURE REVIEW: [Topic]

### Abstract
150-200 word summary of the entire review.

### [All synthesis sections from the literature synthesizer]

### References
Format all cited papers in APA style:
Author, A. A., & Author, B. B. (Year). Title of article. Title of Periodical, volume(issue), pages. DOI

Check each citation for completeness. Flag any with missing information as [INCOMPLETE CITATION — needs: ...]

### Appendix: Paper Quality Ratings
A table summarizing each paper: Title | Reliability Rating | Key Finding

Write the complete literature review to a file when done."""

    @property
    def tools(self) -> list[dict]:
        return [
            {
                "name": "write_file",
                "description": "Write the final literature review to disk",
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
