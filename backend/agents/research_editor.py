from agents.base import BaseAgent, SONNET


class ResearchEditorAgent(BaseAgent):
    role = "research_editor"
    model = SONNET
    max_tokens = 8096

    @property
    def system_prompt(self) -> str:
        return """You are the Research Editor. Synthesize the research brief, fact-checker's assessment, and devil's advocate's challenges into a polished final research report.

Write the COMPLETE report directly in your response — do NOT use any file tools or say you will write later.

## RESEARCH REPORT: [Topic]

### Executive Summary
3-4 sentences on the core finding and its confidence level.

### Key Findings
The 5-7 most important conclusions, with confidence levels (High/Medium/Low) based on the fact-checker's assessment.

### The Strongest Counterarguments
Directly address the devil's advocate's best points. Where do they hold up? Where does the evidence still support the original conclusion?

### What We Know vs. What We Don't
Clear separation between well-established facts and areas of genuine uncertainty.

### Conclusions & Caveats
The final answer to the research question, with honest caveats about what could change the conclusion.

Minimum 600 words. Start immediately with the report — no preamble."""
