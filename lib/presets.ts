export interface Agent {
  id: string;
  role: string;
  icon: string;
  color: string;
  model: string;
  description: string;
  responsibilities: string[];
  systemPrompt: string;
  tools: string[];
  // Optional advanced config (undefined = use system defaults)
  maxTokens?: number;        // output token limit (default 4096)
  temperature?: number;      // 0.0–1.0 (default 1.0)
  maxContextChars?: number;  // cap on accumulated context passed in (default unlimited)
  timeoutSeconds?: number;   // per-agent wall-clock timeout (default 300)
  maxRetries?: number;       // retry count on transient error (default 0)
}

export interface WorkflowLoop {
  id: string;
  fromId: string;
  toId: string;
  maxIterations: number;
  condition: string;
}

export interface Workflow {
  nodeIds: string[];
  loops: WorkflowLoop[];
}

export interface Preset {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  category: string;
  categoryColor: string;
  description: string;
  agents: Agent[];
  workflow: Workflow;
  isBuiltIn: boolean;
  createdAt?: string;
}

/* ─── Storage keys ───────────────────────────────────────── */
export const STORAGE_AGENTS    = "agentos_agents";
export const STORAGE_WORKFLOW  = "agentos_workflow";
export const STORAGE_PRESETS   = "agentos_custom_presets";
export const STORAGE_ACTIVE    = "agentos_active_preset";

/* ─── Built-in presets ───────────────────────────────────── */

export const BUILTIN_PRESETS: Preset[] = [
  /* 1 ─ Software Development */
  {
    id: "software-dev",
    name: "Software Development",
    tagline: "Plan → Build → QA → Ship",
    icon: "💻",
    category: "Engineering",
    categoryColor: "#0284c7",
    description:
      "A full software team: CEO defines the scope, Planner breaks it down, Developer builds it, QA stress-tests it, Writer documents it. QA can loop Developer back for up to 2 revision cycles before escalating.",
    agents: [
      {
        id: "ceo", role: "CEO", icon: "👔", color: "#1d4ed8", model: "Claude Opus 4.7",
        description: "Receives the user's goal, defines success criteria, and produces a structured execution plan.",
        responsibilities: ["Interprets ambiguous goals into clear deliverables", "Produces structured JSON execution plans", "Reviews final output quality", "Escalates blockers to the user"],
        systemPrompt: "You are the CEO of AgentOS. Given a goal, produce a structured execution plan assigning work to Planner, Developer, QA, and Writer agents...",
        tools: [],
      },
      {
        id: "planner", role: "Planner", icon: "🗺️", color: "#1e40af", model: "Claude Opus 4.7",
        description: "Decomposes the CEO plan into a dependency-ordered list of concrete steps with agent assignments.",
        responsibilities: ["Breaks goals into dependency-ordered steps", "Assigns each step to the right agent", "Identifies steps that can run in parallel", "Surfaces constraints and edge cases upfront"],
        systemPrompt: "You are the Planner. Decompose the CEO's plan into a detailed, dependency-ordered JSON step list with agent assignments...",
        tools: [],
      },
      {
        id: "developer", role: "Developer", icon: "💻", color: "#0284c7", model: "Claude Opus 4.7",
        description: "Implements each assigned step — writing complete, production-quality code.",
        responsibilities: ["Writes complete, working code — no placeholders", "Uses file tools to read context and write output", "Incorporates QA feedback on revision cycles", "Documents key decisions inline"],
        systemPrompt: "You are the Developer. Write complete, production-quality code for each assigned step...",
        tools: ["read_file", "write_file"],
      },
      {
        id: "qa", role: "QA", icon: "🔍", color: "#059669", model: "Claude Sonnet 4.6",
        description: "Reviews Developer output against the task description. Scores 0–10 and returns structured pass/fail with feedback.",
        responsibilities: ["Scores output 0–10 (≥7 passes)", "Returns structured JSON pass/fail verdict", "Provides line-specific feedback for failures", "Escalates after 2 failed revision cycles"],
        systemPrompt: "You are the QA Agent. Review developer output and return a JSON verdict with score, issues, and concrete feedback...",
        tools: [],
      },
      {
        id: "writer", role: "Writer", icon: "✍️", color: "#d97706", model: "Claude Sonnet 4.6",
        description: "Generates professional documentation and READMEs once all development steps are complete.",
        responsibilities: ["Writes GitHub-flavoured Markdown docs", "Summarises what was built and key decisions", "Generates setup and usage instructions", "Produces the final deliverable report"],
        systemPrompt: "You are the Writer. Produce clear, professional Markdown documentation summarising what was built...",
        tools: [],
      },
    ],
    workflow: {
      nodeIds: ["ceo", "planner", "developer", "qa", "writer"],
      loops: [{ id: "qa-dev-loop", fromId: "qa", toId: "developer", maxIterations: 2, condition: "score < 7" }],
    },
    isBuiltIn: true,
  },

  /* 2 ─ Research & Intelligence */
  {
    id: "research-intelligence",
    name: "Research & Intelligence",
    tagline: "Source → Verify → Challenge → Publish",
    icon: "🔬",
    category: "Research",
    categoryColor: "#1e40af",
    description:
      "A Researcher pulls sources, Fact-Checker independently verifies each claim, Devil's Advocate pokes holes in the argument, and Editor produces the final polished document. Three adversarial perspectives on every conclusion — something a single LLM call simply can't do.",
    agents: [
      {
        id: "researcher", role: "Researcher", icon: "🔬", color: "#1e40af", model: "Claude Opus 4.7",
        description: "Pulls primary and secondary sources, synthesizes information, and builds the initial research brief with citations.",
        responsibilities: ["Searches for primary and secondary sources", "Synthesizes information into structured briefs", "Identifies key claims that need verification", "Flags areas of uncertainty or conflicting evidence"],
        systemPrompt: "You are the Researcher. Pull together the best available sources on the given topic and synthesize them into a clear, structured brief. Always cite your sources and flag any claims that need independent verification.",
        tools: ["web_search", "read_file"],
      },
      {
        id: "fact_checker", role: "Fact-Checker", icon: "✅", color: "#059669", model: "Claude Opus 4.7",
        description: "Independently verifies each claim in the research brief, scores confidence levels, and flags unsupported assertions.",
        responsibilities: ["Independently verifies each factual claim", "Assigns confidence scores (High/Medium/Low)", "Flags unsupported or weakly-sourced claims", "Returns structured verification report"],
        systemPrompt: "You are the Fact-Checker. Independently verify each claim in the research brief. For each claim, assign a confidence level (High/Medium/Low) and flag anything that cannot be verified. Return a structured JSON verification report.",
        tools: ["web_search"],
      },
      {
        id: "devils_advocate", role: "Devil's Advocate", icon: "😈", color: "#dc2626", model: "Claude Opus 4.7",
        description: "Actively argues against the research conclusions — identifying logical gaps, alternative interpretations, and counterevidence.",
        responsibilities: ["Argues against the main research conclusions", "Identifies logical gaps and unsupported leaps", "Surfaces alternative interpretations of the data", "Challenges methodology and source quality"],
        systemPrompt: "You are the Devil's Advocate. Actively challenge the research conclusions. Find the weakest points in the argument, identify alternative explanations, and surface any evidence that contradicts the conclusions.",
        tools: [],
      },
      {
        id: "editor", role: "Editor", icon: "📝", color: "#d97706", model: "Claude Sonnet 4.6",
        description: "Synthesizes all inputs into a final polished document that addresses every challenge raised.",
        responsibilities: ["Synthesizes research + fact-checker report + challenges", "Produces clear, well-structured final document", "Explicitly addresses Devil's Advocate objections", "Ensures consistent voice and professional quality"],
        systemPrompt: "You are the Editor. Synthesize the researcher's brief, the fact-checker's report, and the devil's advocate's challenges into a single, polished final document. Explicitly acknowledge and address the key challenges raised.",
        tools: [],
      },
    ],
    workflow: {
      nodeIds: ["researcher", "fact_checker", "devils_advocate", "editor"],
      loops: [{ id: "fc-res-loop", fromId: "fact_checker", toId: "researcher", maxIterations: 1, condition: "unverified claims > 3" }],
    },
    isBuiltIn: true,
  },

  /* 3 ─ Investment & Business Analysis */
  {
    id: "investment-analysis",
    name: "Investment & Business Analysis",
    tagline: "Thesis → Bear Case → Data → Risk → Decision",
    icon: "📈",
    category: "Finance",
    categoryColor: "#059669",
    description:
      "Analyst builds the investment thesis, Bear Case agent argues against it, Data agent pulls the numbers, Risk agent maps failure modes, Synthesizer produces the final memo. The equivalent of a Goldman Sachs research desk — not a single analyst's opinion.",
    agents: [
      {
        id: "analyst", role: "Analyst", icon: "📊", color: "#059669", model: "Claude Opus 4.7",
        description: "Builds the investment or business thesis with supporting rationale and key assumptions.",
        responsibilities: ["Defines the investment thesis and key assumptions", "Identifies the primary value drivers", "Structures the opportunity in a clear framework", "Sets expectations for upside and timeline"],
        systemPrompt: "You are the Analyst. Build a clear, well-structured investment or business thesis. Identify key assumptions, value drivers, and expected outcomes. Structure your output as a professional investment memo.",
        tools: [],
      },
      {
        id: "bear_case", role: "Bear Case", icon: "🐻", color: "#dc2626", model: "Claude Opus 4.7",
        description: "Constructs the strongest possible counter-thesis — why the investment will fail, be disrupted, or underperform.",
        responsibilities: ["Constructs the strongest possible counter-thesis", "Identifies market, competitive, and execution risks", "Challenges every key assumption in the bull case", "Quantifies downside scenarios"],
        systemPrompt: "You are the Bear Case analyst. Construct the strongest possible argument for why this investment or business will fail. Challenge every assumption in the bull case thesis and quantify the downside scenarios.",
        tools: [],
      },
      {
        id: "data_agent", role: "Data Agent", icon: "🗄️", color: "#0284c7", model: "Claude Sonnet 4.6",
        description: "Pulls and structures the key data points, metrics, and comparables needed to evaluate the thesis.",
        responsibilities: ["Identifies the key metrics and data points needed", "Pulls market size, growth rates, and comparables", "Structures data into clear tables", "Flags data gaps and quality issues"],
        systemPrompt: "You are the Data Agent. Pull together the key data needed to evaluate the investment thesis: market size, growth rates, comparable companies, financial metrics, and relevant benchmarks.",
        tools: ["web_search"],
      },
      {
        id: "risk_agent", role: "Risk Agent", icon: "⚠️", color: "#d97706", model: "Claude Sonnet 4.6",
        description: "Identifies and categorizes all material risks: market, regulatory, operational, competitive, and macro.",
        responsibilities: ["Identifies and categorizes all material risks", "Assesses likelihood and impact for each risk", "Identifies early warning indicators", "Suggests mitigation strategies"],
        systemPrompt: "You are the Risk Agent. Identify all material risks across market, regulatory, operational, competitive, and macro dimensions. For each risk, assess likelihood and potential impact, then suggest mitigation strategies.",
        tools: [],
      },
      {
        id: "synthesizer", role: "Synthesizer", icon: "🧠", color: "#1e40af", model: "Claude Opus 4.7",
        description: "Integrates bull case, bear case, data, and risk into a final balanced investment decision memo.",
        responsibilities: ["Integrates all agent outputs into a unified memo", "Weighs bull vs. bear arguments with the data", "Produces a clear recommendation with rationale", "Identifies the key swing factors"],
        systemPrompt: "You are the Synthesizer. Take the analyst's thesis, the bear case, the data analysis, and the risk assessment and produce a final, balanced investment memo with a clear recommendation.",
        tools: [],
      },
    ],
    workflow: {
      nodeIds: ["analyst", "bear_case", "data_agent", "risk_agent", "synthesizer"],
      loops: [],
    },
    isBuiltIn: true,
  },

  /* 4 ─ Legal Document Review */
  {
    id: "legal-review",
    name: "Legal Document Review",
    tagline: "Read → Flag → Protect → Finalize",
    icon: "⚖️",
    category: "Legal",
    categoryColor: "#64748b",
    description:
      "One agent reads for meaning, another flags ambiguous clauses, another checks for missing standard protections, a Legal Editor synthesizes everything into a prioritized review memo. Catches what a solo review will miss.",
    agents: [
      {
        id: "reader", role: "Reader", icon: "📄", color: "#64748b", model: "Claude Opus 4.7",
        description: "Reads the document for overall meaning, structure, and intent — producing a plain-language summary.",
        responsibilities: ["Produces a plain-language summary of the document", "Identifies the key obligations of each party", "Maps the document structure and key sections", "Flags anything that is unclear or unusual"],
        systemPrompt: "You are the Reader. Read the legal document carefully and produce a clear, plain-language summary of what it actually says. Identify the key obligations of each party, important dates, and any sections that seem unusual.",
        tools: ["read_file"],
      },
      {
        id: "clause_flagger", role: "Clause Flagger", icon: "🚩", color: "#dc2626", model: "Claude Opus 4.7",
        description: "Identifies and flags ambiguous, one-sided, or potentially harmful clauses that require closer attention.",
        responsibilities: ["Flags ambiguous or poorly-defined terms", "Identifies clauses that favor one party excessively", "Highlights unusual liability or indemnification terms", "Returns a prioritized list by severity"],
        systemPrompt: "You are the Clause Flagger. Review the document and flag any clauses that are ambiguous, one-sided, or potentially harmful. Prioritize by severity (Critical / High / Medium) and explain why each flagged clause is problematic.",
        tools: [],
      },
      {
        id: "protection_checker", role: "Protection Checker", icon: "🛡️", color: "#1e40af", model: "Claude Sonnet 4.6",
        description: "Checks for missing standard legal protections that should typically be present in this type of agreement.",
        responsibilities: ["Identifies missing standard protective clauses", "Checks for IP assignment and confidentiality provisions", "Verifies dispute resolution and governing law clauses", "Flags missing termination and liability terms"],
        systemPrompt: "You are the Protection Checker. Review the document for missing standard protective provisions. Check for: IP assignment, NDA terms, limitation of liability, indemnification, dispute resolution, governing law, and termination rights.",
        tools: [],
      },
      {
        id: "legal_editor", role: "Legal Editor", icon: "✏️", color: "#d97706", model: "Claude Opus 4.7",
        description: "Synthesizes all findings into a structured review memo with prioritized recommendations and suggested redlines.",
        responsibilities: ["Synthesizes all agent findings into a review memo", "Prioritizes issues by risk level", "Drafts suggested redline language for key issues", "Produces an executive summary for non-lawyers"],
        systemPrompt: "You are the Legal Editor. Take the reader summary, the flagged clauses, and the protection checker's findings and synthesize them into a professional legal review memo. Prioritize issues by risk level and include suggested redline language.",
        tools: [],
      },
    ],
    workflow: {
      nodeIds: ["reader", "clause_flagger", "protection_checker", "legal_editor"],
      loops: [{ id: "flag-read-loop", fromId: "clause_flagger", toId: "reader", maxIterations: 1, condition: "ambiguous sections found" }],
    },
    isBuiltIn: true,
  },

  /* 5 ─ Content & Marketing Pipeline */
  {
    id: "content-marketing",
    name: "Content & Marketing Pipeline",
    tagline: "Draft → SEO → Brand → Edit → Publish",
    icon: "📣",
    category: "Marketing",
    categoryColor: "#ec4899",
    description:
      "Writer produces the draft, SEO agent optimizes for search intent, Brand Voice agent checks consistency with brand guidelines, Editor tightens it into the final publish-ready piece. The full content team in one workflow.",
    agents: [
      {
        id: "content_writer", role: "Writer", icon: "✍️", color: "#ec4899", model: "Claude Sonnet 4.6",
        description: "Produces the initial content draft based on the brief, optimized for clarity and engagement.",
        responsibilities: ["Writes the initial draft based on the brief", "Structures content for maximum readability", "Crafts a compelling hook and strong conclusion", "Keeps the target audience front of mind"],
        systemPrompt: "You are the Writer. Produce a well-structured, engaging draft based on the content brief. Focus on clarity, a compelling hook, and a clear call to action.",
        tools: [],
      },
      {
        id: "seo_agent", role: "SEO Agent", icon: "🔍", color: "#0284c7", model: "Claude Sonnet 4.6",
        description: "Optimizes the content for search intent, keyword placement, and structure to maximize organic discoverability.",
        responsibilities: ["Identifies target keywords and search intent", "Optimizes headings, meta description, and structure", "Checks keyword density and natural placement", "Recommends internal linking opportunities"],
        systemPrompt: "You are the SEO Agent. Optimize the draft for search. Identify primary and secondary keywords, optimize the title, headings, and meta description, and ensure keywords are placed naturally.",
        tools: [],
      },
      {
        id: "brand_voice", role: "Brand Voice", icon: "🎯", color: "#1e40af", model: "Claude Sonnet 4.6",
        description: "Checks the content against brand voice guidelines — tone, terminology, style, and messaging consistency.",
        responsibilities: ["Checks tone against brand voice guidelines", "Flags off-brand terminology or messaging", "Ensures consistent use of brand-specific language", "Verifies claims align with brand positioning"],
        systemPrompt: "You are the Brand Voice agent. Review the content for brand consistency. Check tone, terminology, and messaging against brand guidelines. Flag anything off-brand and suggest corrected versions.",
        tools: [],
      },
      {
        id: "content_editor", role: "Editor", icon: "📝", color: "#d97706", model: "Claude Sonnet 4.6",
        description: "Tightens the final draft — cutting redundancy, sharpening sentences, ensuring publish-readiness.",
        responsibilities: ["Tightens prose and eliminates redundancy", "Sharpens the opening and closing", "Ensures consistent style throughout", "Produces the final publish-ready version"],
        systemPrompt: "You are the Editor. Take the SEO-optimized, brand-checked draft and tighten it. Cut unnecessary words, sharpen every sentence, and produce the final publish-ready version.",
        tools: [],
      },
    ],
    workflow: {
      nodeIds: ["content_writer", "seo_agent", "brand_voice", "content_editor"],
      loops: [{ id: "editor-writer-loop", fromId: "content_editor", toId: "content_writer", maxIterations: 2, condition: "quality score < 8" }],
    },
    isBuiltIn: true,
  },

  /* 6 ─ Academic Literature Review */
  {
    id: "academic-review",
    name: "Academic Literature Review",
    tagline: "Summarize → Critique → Synthesize → Cite",
    icon: "🎓",
    category: "Research",
    categoryColor: "#1e40af",
    description:
      "Summarizer distills papers, Critic evaluates methodology quality and flags bias, Synthesizer identifies consensus and disagreement across the literature, Citation agent formats all references. A week of PhD-level literature review in an hour.",
    agents: [
      {
        id: "summarizer", role: "Summarizer", icon: "📚", color: "#1e40af", model: "Claude Opus 4.7",
        description: "Reads and distills each paper into a structured summary: key claims, methodology, findings, and limitations.",
        responsibilities: ["Distills each paper into a structured summary", "Extracts key claims, methodology, and findings", "Identifies study limitations and scope", "Uses a consistent format for all papers"],
        systemPrompt: "You are the Summarizer. For each paper, produce a structured summary: (1) Core thesis, (2) Methodology, (3) Key findings, (4) Limitations, (5) Notable quotes.",
        tools: ["read_file"],
      },
      {
        id: "critic", role: "Critic", icon: "🧐", color: "#dc2626", model: "Claude Opus 4.7",
        description: "Evaluates methodological rigor, sample quality, and potential biases — rating each paper's reliability.",
        responsibilities: ["Evaluates statistical methodology and rigor", "Identifies potential biases and confounders", "Assesses sample size and representativeness", "Flags replication concerns and publication bias"],
        systemPrompt: "You are the Critic. Evaluate each paper's methodological quality. Look for: small samples, selection bias, p-hacking, lack of replication, and conflicts of interest. Rate reliability (Strong / Moderate / Weak) with justification.",
        tools: [],
      },
      {
        id: "literature_synthesizer", role: "Synthesizer", icon: "🧩", color: "#059669", model: "Claude Opus 4.7",
        description: "Identifies consensus, disagreement, and knowledge gaps across all papers — producing the core review narrative.",
        responsibilities: ["Maps areas of consensus across papers", "Identifies key debates and disagreements", "Surfaces knowledge gaps in the literature", "Produces the core literature review narrative"],
        systemPrompt: "You are the Synthesizer. Given all paper summaries and quality ratings, identify: (1) Areas of consensus, (2) Active debates, (3) Knowledge gaps, (4) Evolution of thinking over time.",
        tools: [],
      },
      {
        id: "citation_agent", role: "Citation Agent", icon: "📎", color: "#64748b", model: "Claude Haiku 4.5",
        description: "Formats all references in the required citation style and checks for completeness and accuracy.",
        responsibilities: ["Formats references in the specified citation style", "Checks all citations for completeness", "Cross-references in-text citations with bibliography", "Flags missing bibliographic information"],
        systemPrompt: "You are the Citation Agent. Format all references in the specified citation style (APA, MLA, Chicago). Check each citation for completeness — author, year, title, journal, volume, pages, DOI.",
        tools: [],
      },
    ],
    workflow: {
      nodeIds: ["summarizer", "critic", "literature_synthesizer", "citation_agent"],
      loops: [{ id: "crit-sum-loop", fromId: "critic", toId: "summarizer", maxIterations: 1, condition: "methodology unclear" }],
    },
    isBuiltIn: true,
  },
];

/* ─── Storage helpers ────────────────────────────────────── */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function loadCustomPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_PRESETS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveCustomPresets(presets: Preset[]): void {
  localStorage.setItem(STORAGE_PRESETS, JSON.stringify(presets));
}

export function loadActivePresetId(): string | null {
  return localStorage.getItem(STORAGE_ACTIVE);
}

export function activatePreset(preset: Preset): void {
  localStorage.setItem(STORAGE_AGENTS, JSON.stringify(preset.agents));
  localStorage.setItem(STORAGE_WORKFLOW, JSON.stringify(preset.workflow));
  localStorage.setItem(STORAGE_ACTIVE, preset.id);
}

/* ─── API sync ───────────────────────────────────────────── */

export async function fetchPresetsFromAPI(): Promise<Preset[]> {
  try {
    const res = await fetch(`${API}/presets/`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function upsertPresetToAPI(preset: Preset): Promise<void> {
  try {
    await fetch(`${API}/presets/${preset.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: preset }),
    });
  } catch {}
}

export async function deletePresetFromAPI(id: string): Promise<void> {
  try {
    await fetch(`${API}/presets/${id}`, { method: "DELETE" });
  } catch {}
}
