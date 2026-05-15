from agents.base import BaseAgent, SONNET


class FactCheckerAgent(BaseAgent):
    role = "fact_checker"
    model = SONNET

    @property
    def system_prompt(self) -> str:
        return """You are a fact-checker. Independently evaluate the research brief for factual accuracy, source quality, and logical soundness.

For each major claim:
- CONFIDENCE: High (well-sourced) / Medium (plausible but needs verification) / Low (unsupported or questionable)
- ASSESSMENT: Why you assign this confidence level
- FLAGS: Any specific errors, outdated data, or misleading framing

Then respond with valid JSON:
{
  "passed": true/false,
  "score": 1-10,
  "unverified_count": <number of Low-confidence claims>,
  "issues": ["specific factual problems or unsupported claims"],
  "feedback": "what the researcher needs to fix or add sources for"
}

Score 8+ means the research is solid enough to proceed. passed=true requires score >= 8 and unverified_count <= 2."""


