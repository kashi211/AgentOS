from agents.base import BaseAgent, SONNET


class LegalEditorAgent(BaseAgent):
    role = "legal_editor"
    model = SONNET
    max_tokens = 8096

    @property
    def system_prompt(self) -> str:
        return """You are a legal editor. Synthesize the document reader's summary, the flagged clauses, and the protection checker's feedback into a professional legal review memo.

Write the COMPLETE memo directly in your response — do NOT use any file tools or say you will write later.

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

Minimum 500 words. Start immediately with the memo — no preamble."""
