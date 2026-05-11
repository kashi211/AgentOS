"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, RefreshCw, FileCode, Download } from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface TaskFile {
  path: string;
  size: number;
}

function fileIcon(path: string) {
  if (path.endsWith(".html")) return "🌐";
  if (path.endsWith(".css")) return "🎨";
  if (path.endsWith(".js") || path.endsWith(".ts")) return "⚡";
  if (path.endsWith(".py")) return "🐍";
  if (path.endsWith(".md")) return "📝";
  if (path.endsWith(".json")) return "📋";
  return "📄";
}

type ViewMode = "demo" | "code";

export default function ProjectPage() {
  const params = useParams();
  const task_id = params.task_id as string;

  const [goal, setGoal] = useState("");
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [mode, setMode] = useState<ViewMode>("demo");
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    fetch(`${API}/tasks/${task_id}`)
      .then((r) => r.json())
      .then((d) => setGoal(d.goal ?? ""))
      .catch(() => {});

    fetch(`${API}/tasks/${task_id}/files`)
      .then((r) => r.json())
      .then((list: TaskFile[]) => {
        setFiles(list);
        // Auto-select index.html if it exists, otherwise first file
        const html = list.find((f) => f.path === "index.html") ?? list[0];
        if (html) selectFile(html.path);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task_id]);

  const selectFile = async (path: string) => {
    setSelectedFile(path);
    setMode(path.endsWith(".html") ? "demo" : "code");
    setLoadingContent(true);
    try {
      const res = await fetch(`${API}/tasks/${task_id}/files/${path}`);
      if (res.ok) setFileContent(await res.text());
    } finally {
      setLoadingContent(false);
    }
  };

  const hasDemo = selectedFile?.endsWith(".html") ?? false;
  const demoSrc = `${API}/output/${task_id}/${selectedFile}`;

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#0f172a" }}>

      {/* Top bar */}
      <div style={{
        height: 52,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 16px",
        borderBottom: "1px solid #1e293b",
        flexShrink: 0,
        background: "#0a0f1e",
      }}>
        <Link href="/tasks" style={{ color: "#475569", display: "flex", alignItems: "center", padding: 6, borderRadius: 6, border: "1px solid #1e293b" }}>
          <ArrowLeft size={15} style={{ color: "#94a3b8" }} />
        </Link>

        {/* Goal pill */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid #1e293b",
          borderRadius: 8,
          padding: "0 12px",
          height: 34,
          overflow: "hidden",
          minWidth: 0,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
          <span style={{ color: "#94a3b8", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {goal || task_id}
          </span>
        </div>

        <button
          onClick={() => setIframeKey((k) => k + 1)}
          style={{ color: "#475569", display: "flex", alignItems: "center", padding: 6, borderRadius: 6, border: "1px solid #1e293b", cursor: "pointer", background: "transparent" }}
          title="Reload preview"
        >
          <RefreshCw size={14} style={{ color: "#94a3b8" }} />
        </button>

        {selectedFile && (
          <a
            href={`${API}/tasks/${task_id}/files/${selectedFile}`}
            download={selectedFile.split("/").pop()}
            style={{ color: "#475569", display: "flex", alignItems: "center", padding: 6, borderRadius: 6, border: "1px solid #1e293b" }}
            title="Download current file"
          >
            <Download size={14} style={{ color: "#94a3b8" }} />
          </a>
        )}

        {hasDemo && (
          <a
            href={demoSrc}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 14px",
              height: 34,
              borderRadius: 8,
              background: "#4f46e5",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            <ExternalLink size={13} />
            Open App
          </a>
        )}
      </div>

      {/* Body — file tree + main panel */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* File tree */}
        <div style={{
          width: 240,
          flexShrink: 0,
          borderRight: "1px solid #1e293b",
          display: "flex",
          flexDirection: "column",
          background: "#0a0f1e",
          overflow: "hidden",
        }}>
          <div style={{ padding: "10px 16px 8px", borderBottom: "1px solid #1e293b" }}>
            <span style={{ color: "#475569", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Files · {files.length}
            </span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {files.map((f) => (
              <button
                key={f.path}
                onClick={() => selectFile(f.path)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  cursor: "pointer",
                  border: "none",
                  borderLeft: selectedFile === f.path ? "2px solid #4f46e5" : "2px solid transparent",
                  background: selectedFile === f.path ? "rgba(79,70,229,0.12)" : "transparent",
                  transition: "background 0.1s",
                }}
              >
                <span style={{ fontSize: 14 }}>{fileIcon(f.path)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    color: selectedFile === f.path ? "#a5b4fc" : "#94a3b8",
                    fontSize: 12,
                    fontFamily: "var(--font-geist-mono, monospace)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: selectedFile === f.path ? 600 : 400,
                  }}>
                    {f.path}
                  </div>
                  <div style={{ color: "#334155", fontSize: 10, marginTop: 1 }}>
                    {(f.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Tab bar */}
          {selectedFile && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: "0 16px",
              height: 42,
              borderBottom: "1px solid #1e293b",
              flexShrink: 0,
              background: "#0a0f1e",
            }}>
              {hasDemo && (
                <button
                  onClick={() => setMode("demo")}
                  style={{
                    padding: "4px 14px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "none",
                    background: mode === "demo" ? "rgba(79,70,229,0.15)" : "transparent",
                    color: mode === "demo" ? "#a5b4fc" : "#475569",
                  }}
                >
                  🌐 Demo
                </button>
              )}
              <button
                onClick={() => setMode("code")}
                style={{
                  padding: "4px 14px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  background: mode === "code" ? "rgba(79,70,229,0.15)" : "transparent",
                  color: mode === "code" ? "#a5b4fc" : "#475569",
                }}
              >
                <FileCode size={12} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
                Code
              </button>
              <div style={{ flex: 1 }} />
              <span style={{ color: "#334155", fontSize: 11, fontFamily: "var(--font-geist-mono, monospace)" }}>
                {selectedFile}
              </span>
            </div>
          )}

          {/* Content */}
          {!selectedFile ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: "#334155", fontSize: 14 }}>Select a file</p>
            </div>
          ) : loadingContent ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 20, height: 20, border: "2px solid #1e293b", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : mode === "demo" && hasDemo ? (
            <iframe
              key={iframeKey}
              src={demoSrc}
              style={{ flex: 1, width: "100%", border: "none", background: "#fff" }}
              sandbox="allow-scripts allow-forms allow-modals allow-popups"
              title="App Demo"
            />
          ) : (
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              <pre style={{
                margin: 0,
                color: "#e2e8f0",
                fontSize: 13,
                lineHeight: 1.7,
                fontFamily: "var(--font-geist-mono, monospace)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
                {fileContent}
              </pre>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
