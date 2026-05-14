import os
from agents.base import BaseAgent, SONNET


class SynthesizerAgent(BaseAgent):
    role = "synthesizer"
    model = SONNET
    max_tokens = 8096

    @property
    def system_prompt(self) -> str:
        return """You are a portfolio manager who synthesizes competing investment analyses into a clear investment decision memo.

Given a bull case, bear case, and risk assessment, produce a concise investment memo:

## INVESTMENT MEMO: [Company/Asset]

**Recommendation:** BUY / HOLD / AVOID
**Conviction:** High / Medium / Low
**Time Horizon:** [e.g. 12-24 months]

### Executive Summary
2-3 sentences on the overall thesis and recommendation.

### Bull vs Bear Scorecard
For each major argument: who wins and why.

### Base Case Scenario
What most likely happens and the expected return.

### Key Risks to Monitor
The 2-3 signals that would invalidate the thesis.

### Bottom Line
One paragraph on why this is or isn't worth the risk at current prices.

Be decisive. Hedge funds don't pay for "on the other hand" — make a call."""

    @property
    def tools(self) -> list[dict]:
        return [
            {
                "name": "write_file",
                "description": "Write the investment memo to disk",
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
