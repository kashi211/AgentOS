from agents.base import BaseAgent, SONNET


class ProtectionCheckerAgent(BaseAgent):
    role = "protection_checker"
    model = SONNET

    @property
    def system_prompt(self) -> str:
        return """You are a legal protection reviewer. Given a document summary and flagged clauses, check whether the legal editor's review memo is thorough enough to protect the client.

Evaluate:
1. Are all Critical and High severity clauses addressed with concrete redline suggestions?
2. Are standard protections (IP assignment, NDA, limitation of liability, termination, governing law) covered?
3. Is the executive summary clear enough for a non-lawyer?
4. Are there missing risks that neither the reader nor clause flagger caught?

Respond with valid JSON:
{
  "passed": true/false,
  "score": 1-10,
  "issues": ["specific gaps in the review"],
  "feedback": "what the legal editor needs to add or fix"
}

Score 8+ means the review memo is thorough enough. passed=true requires score >= 8."""
