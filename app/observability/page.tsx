"use client";

import { useEffect, useState } from "react";
import {
  DollarSign,
  Zap,
  Clock,
  BarChart3,
  CheckCircle2,
  Bot,
  TrendingUp,
  FlaskConical,
  RefreshCw,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Totals {
  total_tasks?: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
  total_cost_usd?: number;
  avg_latency_ms?: number;
}

interface PresetRow {
  preset_id: string;
  task_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
}

interface AgentRow {
  agent_role: string;
  call_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
}

interface EvalRow {
  task_id: string;
  goal: string;
  preset_id: string | null;
  created_at: string;
  scores: {
    correctness?: number;
    completeness?: number;
    quality?: number;
    overall?: number;
    reasoning?: string;
  };
}

interface MetricsData {
  totals: Totals;
  by_preset: PresetRow[];
  by_agent: AgentRow[];
  recent_evals: EvalRow[];
}

function fmt(n: number | undefined | null, decimals = 2): string {
  if (n == null) return "—";
  return n.toFixed(decimals);
}

function fmtMs(ms: number | undefined | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTokens(n: number | undefined | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function ScoreBadge({ label, value }: { label: string; value?: number }) {
  if (value == null) return null;
  const pct = value / 10;
  const color =
    pct >= 0.8
      ? { bg: "#f0fdf4", border: "#bbf7d0", text: "#16a34a" }
      : pct >= 0.6
      ? { bg: "#fffbeb", border: "#fde68a", text: "#d97706" }
      : { bg: "#fef2f2", border: "#fecaca", text: "#dc2626" };

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{
        background: color.bg,
        border: `1px solid ${color.border}`,
        color: color.text,
      }}
    >
      {label}: {value}/10
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      className="rounded-xl p-5 flex items-start gap-4"
      style={{
        background: "var(--card)",
        border: "1px solid var(--card-border)",
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "var(--accent-light)" }}
      >
        <Icon size={20} style={{ color: "var(--accent)" }} />
      </div>
      <div>
        <div className="text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
          {label}
        </div>
        <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          {value}
        </div>
        {sub && (
          <div className="text-xs mt-0.5" style={{ color: "var(--muted-light)" }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ObservabilityPage() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/metrics/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const hasData =
    data &&
    (data.totals?.total_tasks != null ||
      data.by_preset.length > 0 ||
      data.by_agent.length > 0);

  return (
    <div className="flex-1 overflow-auto p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-bold mb-1"
            style={{ color: "var(--foreground)" }}
          >
            Observability
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Token usage, cost, latency, and LLM-as-judge eval scores across all
            tasks
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: "var(--accent-light)",
            color: "var(--accent)",
            border: "1px solid var(--card-border)",
          }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center py-24">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          />
        </div>
      )}

      {error && (
        <div
          className="rounded-xl p-4 mb-6 text-sm"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#dc2626",
          }}
        >
          Failed to load metrics: {error}
        </div>
      )}

      {data && !hasData && (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <FlaskConical
            size={48}
            className="mx-auto mb-4"
            style={{ color: "var(--muted-light)" }}
          />
          <div
            className="text-lg font-semibold mb-2"
            style={{ color: "var(--foreground)" }}
          >
            No data yet
          </div>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Run some tasks to start seeing token usage, cost, and eval scores
            here.
          </p>
        </div>
      )}

      {data && hasData && (
        <div className="space-y-8">
          {/* Top stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={DollarSign}
              label="Total Cost"
              value={`$${fmt(data.totals.total_cost_usd, 4)}`}
              sub={`${data.totals.total_tasks ?? 0} tasks`}
            />
            <StatCard
              icon={Zap}
              label="Total Tokens"
              value={fmtTokens(
                (data.totals.total_input_tokens ?? 0) +
                  (data.totals.total_output_tokens ?? 0)
              )}
              sub={`${fmtTokens(data.totals.total_input_tokens)} in / ${fmtTokens(data.totals.total_output_tokens)} out`}
            />
            <StatCard
              icon={Clock}
              label="Avg Latency"
              value={fmtMs(data.totals.avg_latency_ms)}
              sub="per agent call"
            />
            <StatCard
              icon={CheckCircle2}
              label="Evals Run"
              value={String(data.recent_evals.length)}
              sub="LLM-as-judge scored"
            />
          </div>

          {/* Cost by preset */}
          {data.by_preset.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: "var(--card)",
                border: "1px solid var(--card-border)",
              }}
            >
              <div
                className="px-5 py-4 border-b flex items-center gap-2"
                style={{ borderColor: "var(--card-border)" }}
              >
                <TrendingUp size={16} style={{ color: "var(--accent)" }} />
                <h2
                  className="font-semibold text-sm"
                  style={{ color: "var(--foreground)" }}
                >
                  Cost by Preset
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      style={{
                        background: "var(--card-border)",
                        color: "var(--muted)",
                      }}
                    >
                      {[
                        "Preset",
                        "Tasks",
                        "Input Tokens",
                        "Output Tokens",
                        "Total Cost",
                        "Avg Latency",
                        "p50",
                        "p95",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_preset.map((row, i) => (
                      <tr
                        key={row.preset_id}
                        style={{
                          borderTop:
                            i > 0 ? "1px solid var(--card-border)" : undefined,
                          color: "var(--foreground)",
                        }}
                      >
                        <td className="px-4 py-3 font-medium">
                          {row.preset_id}
                        </td>
                        <td className="px-4 py-3">{row.task_count}</td>
                        <td className="px-4 py-3">
                          {fmtTokens(row.total_input_tokens)}
                        </td>
                        <td className="px-4 py-3">
                          {fmtTokens(row.total_output_tokens)}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          ${fmt(row.total_cost_usd, 4)}
                        </td>
                        <td className="px-4 py-3">
                          {fmtMs(row.avg_latency_ms)}
                        </td>
                        <td className="px-4 py-3">
                          {fmtMs(row.p50_latency_ms)}
                        </td>
                        <td className="px-4 py-3">
                          {fmtMs(row.p95_latency_ms)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cost by agent */}
          {data.by_agent.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: "var(--card)",
                border: "1px solid var(--card-border)",
              }}
            >
              <div
                className="px-5 py-4 border-b flex items-center gap-2"
                style={{ borderColor: "var(--card-border)" }}
              >
                <Bot size={16} style={{ color: "var(--accent)" }} />
                <h2
                  className="font-semibold text-sm"
                  style={{ color: "var(--foreground)" }}
                >
                  Cost by Agent
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      style={{
                        background: "var(--card-border)",
                        color: "var(--muted)",
                      }}
                    >
                      {[
                        "Agent",
                        "Calls",
                        "Total Cost",
                        "Avg Latency",
                        "p50",
                        "p95",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_agent.map((row, i) => (
                      <tr
                        key={row.agent_role}
                        style={{
                          borderTop:
                            i > 0 ? "1px solid var(--card-border)" : undefined,
                          color: "var(--foreground)",
                        }}
                      >
                        <td className="px-4 py-3 font-medium">
                          {row.agent_role}
                        </td>
                        <td className="px-4 py-3">{row.call_count}</td>
                        <td className="px-4 py-3 font-semibold">
                          ${fmt(row.total_cost_usd, 4)}
                        </td>
                        <td className="px-4 py-3">
                          {fmtMs(row.avg_latency_ms)}
                        </td>
                        <td className="px-4 py-3">
                          {fmtMs(row.p50_latency_ms)}
                        </td>
                        <td className="px-4 py-3">
                          {fmtMs(row.p95_latency_ms)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent evals */}
          {data.recent_evals.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: "var(--card)",
                border: "1px solid var(--card-border)",
              }}
            >
              <div
                className="px-5 py-4 border-b flex items-center gap-2"
                style={{ borderColor: "var(--card-border)" }}
              >
                <BarChart3 size={16} style={{ color: "var(--accent)" }} />
                <h2
                  className="font-semibold text-sm"
                  style={{ color: "var(--foreground)" }}
                >
                  Recent Evals
                </h2>
                <span
                  className="ml-auto text-xs"
                  style={{ color: "var(--muted)" }}
                >
                  LLM-as-judge via claude-haiku
                </span>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
                {data.recent_evals.map((ev) => (
                  <div key={ev.task_id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: "var(--foreground)" }}
                        >
                          {ev.goal}
                        </p>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "var(--muted)" }}
                        >
                          {ev.preset_id ?? "custom"} ·{" "}
                          {new Date(ev.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <ScoreBadge
                        label="Correctness"
                        value={ev.scores.correctness}
                      />
                      <ScoreBadge
                        label="Completeness"
                        value={ev.scores.completeness}
                      />
                      <ScoreBadge label="Quality" value={ev.scores.quality} />
                      <ScoreBadge label="Overall" value={ev.scores.overall} />
                    </div>
                    {ev.scores.reasoning && (
                      <p
                        className="text-xs italic"
                        style={{ color: "var(--muted)" }}
                      >
                        {ev.scores.reasoning}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
