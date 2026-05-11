"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Code, RefreshCw } from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function PreviewPage() {
  const params = useParams();
  const task_id = params.task_id as string;
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    fetch(`${API}/tasks/${task_id}`)
      .then((r) => r.json())
      .then((d) => setGoal(d.goal ?? ""))
      .catch(() => {});
  }, [task_id]);

  const src = `${API}/output/${task_id}/index.html`;

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "#0f172a",
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          height: 48,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 16px",
          borderBottom: "1px solid #1e293b",
          flexShrink: 0,
          background: "#0f172a",
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            color: "#64748b",
            display: "flex",
            alignItems: "center",
            padding: 6,
            borderRadius: 6,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid #1e293b",
            cursor: "pointer",
          }}
          title="Back to tasks"
        >
          <ArrowLeft size={15} />
        </button>

        {/* URL bar */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid #1e293b",
            borderRadius: 8,
            padding: "0 12px",
            height: 32,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#22c55e",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              color: "#94a3b8",
              fontSize: 12,
              fontFamily: "var(--font-geist-mono, monospace)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {goal || task_id}
          </span>
        </div>

        {/* Actions */}
        <button
          onClick={() => setIframeKey((k) => k + 1)}
          style={{
            color: "#64748b",
            display: "flex",
            alignItems: "center",
            padding: 6,
            borderRadius: 6,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid #1e293b",
            cursor: "pointer",
          }}
          title="Reload"
        >
          <RefreshCw size={14} />
        </button>

        <Link
          href={`/tasks`}
          style={{
            color: "#64748b",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 10px",
            height: 32,
            borderRadius: 6,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid #1e293b",
            fontSize: 12,
            textDecoration: "none",
          }}
          title="View source"
        >
          <Code size={13} />
          <span style={{ color: "#94a3b8" }}>Code</span>
        </Link>

        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          style={{
            color: "#64748b",
            display: "flex",
            alignItems: "center",
            padding: 6,
            borderRadius: 6,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid #1e293b",
            cursor: "pointer",
          }}
          title="Open in new tab"
        >
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Full-screen iframe */}
      <iframe
        key={iframeKey}
        src={src}
        style={{ flex: 1, width: "100%", border: "none" }}
        sandbox="allow-scripts allow-forms allow-modals allow-popups"
        title="App Preview"
      />
    </div>
  );
}
