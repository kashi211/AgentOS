"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, RefreshCw, Send, Loader2 } from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS  = process.env.NEXT_PUBLIC_WS_URL  ?? "ws://localhost:8000";

interface TaskFile { path: string; size: number; }

interface AgentEvent {
  type: string;
  agent: string;
  content: string;
}

interface EditThread {
  id: string;
  message: string;
  events: AgentEvent[];
  done: boolean;
  failed: boolean;
}

const agentColor: Record<string, string> = {
  ceo: "#4f46e5", planner: "#7c3aed", developer: "#0284c7",
  qa: "#059669", writer: "#d97706", system: "#64748b",
};
const agentIcon: Record<string, string> = {
  ceo: "👔", planner: "🗺️", developer: "💻",
  qa: "🔍", writer: "✍️", system: "⚙️",
};

function fileIcon(path: string) {
  if (path.endsWith(".html")) return "🌐";
  if (path.endsWith(".css")) return "🎨";
  if (path.endsWith(".js") || path.endsWith(".ts")) return "⚡";
  if (path.endsWith(".py")) return "🐍";
  if (path.endsWith(".md")) return "📝";
  if (path.endsWith(".json")) return "📋";
  return "📄";
}

export default function ProjectPage() {
  const params = useParams();
  const task_id = params.task_id as string;

  const [goal, setGoal] = useState("");
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [mode, setMode] = useState<"demo" | "code">("demo");
  const [iframeKey, setIframeKey] = useState(0);

  // Chat / edit state
  const [editInput, setEditInput] = useState("");
  const [threads, setThreads] = useState<EditThread[]>([]);
  const [editing, setEditing] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const editWsRef = useRef<WebSocket | null>(null);

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API}/tasks/${task_id}/files`);
      if (!res.ok) return;
      const list: TaskFile[] = await res.json();
      setFiles(list);
      return list;
    } catch {}
  };

  useEffect(() => {
    fetch(`${API}/tasks/${task_id}`)
      .then((r) => r.json())
      .then((d) => setGoal(d.goal ?? ""))
      .catch(() => {});

    fetchFiles().then((list) => {
      if (!list?.length) return;
      const html = list.find((f) => f.path === "index.html") ?? list[0];
      if (html) selectFile(html.path);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task_id]);

  // Auto-scroll chat
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [threads]);

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

  const sendEdit = async () => {
    const msg = editInput.trim();
    if (!msg || editing) return;
    setEditInput("");
    setEditing(true);

    const threadId = Date.now().toString();
    setThreads((prev) => [...prev, { id: threadId, message: msg, events: [], done: false, failed: false }]);

    let editTaskId: string;
    try {
      const res = await fetch(`${API}/tasks/${task_id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok) throw new Error("Edit request failed");
      ({ edit_task_id: editTaskId } = await res.json());
    } catch {
      setThreads((prev) => prev.map((t) => t.id === threadId ? { ...t, failed: true } : t));
      setEditing(false);
      return;
    }

    const ws = new WebSocket(`${WS}/ws/${editTaskId}`);
    editWsRef.current = ws;

    ws.onmessage = (e) => {
      const event: AgentEvent = JSON.parse(e.data);
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== threadId) return t;
          const done = event.type === "done";
          const failed = event.type === "error";
          return { ...t, events: [...t.events, event], done, failed };
        })
      );

      if (event.type === "done") {
        setEditing(false);
        ws.close();
        // Refresh files list and reload iframe
        fetchFiles().then(() => {
          setIframeKey((k) => k + 1);
          if (selectedFile) selectFile(selectedFile);
        });
      }
      if (event.type === "error") {
        setEditing(false);
        ws.close();
      }
    };

    ws.onerror = () => {
      setThreads((prev) => prev.map((t) => t.id === threadId ? { ...t, failed: true } : t));
      setEditing(false);
    };
  };

  const hasDemo = selectedFile?.endsWith(".html") ?? false;
  const demoSrc = `${API}/output/${task_id}/${selectedFile}`;
  // srcdoc embeds HTML directly — avoids all cross-origin iframe restrictions
  const iframeSrcdoc = hasDemo && fileContent ? fileContent : undefined;

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#0f172a", overflow: "hidden" }}>

      {/* Top bar */}
      <div style={{ height: 52, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", borderBottom: "1px solid #1e293b", flexShrink: 0, background: "#0a0f1e" }}>
        <Link href="/projects" style={{ color: "#475569", display: "flex", alignItems: "center", padding: 6, borderRadius: 6, border: "1px solid #1e293b" }}>
          <ArrowLeft size={15} style={{ color: "#94a3b8" }} />
        </Link>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", border: "1px solid #1e293b", borderRadius: 8, padding: "0 12px", height: 34, overflow: "hidden", minWidth: 0 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
          <span style={{ color: "#94a3b8", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{goal || task_id}</span>
        </div>
        <button onClick={() => { if (selectedFile) selectFile(selectedFile); setIframeKey((k) => k + 1); fetchFiles(); }} style={{ color: "#94a3b8", display: "flex", padding: 6, borderRadius: 6, border: "1px solid #1e293b", cursor: "pointer", background: "transparent" }} title="Reload">
          <RefreshCw size={14} />
        </button>
        {hasDemo && (
          <a href={demoSrc} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 14px", height: 34, borderRadius: 8, background: "#4f46e5", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
            <ExternalLink size={13} /> Open App
          </a>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* File tree */}
        <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", background: "#0a0f1e", overflow: "hidden" }}>
          <div style={{ padding: "10px 16px 8px", borderBottom: "1px solid #1e293b" }}>
            <span style={{ color: "#475569", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Files · {files.length}</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {files.map((f) => (
              <button key={f.path} onClick={() => selectFile(f.path)} style={{ width: "100%", textAlign: "left", padding: "9px 14px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", border: "none", borderLeft: selectedFile === f.path ? "2px solid #4f46e5" : "2px solid transparent", background: selectedFile === f.path ? "rgba(79,70,229,0.12)" : "transparent" }}>
                <span style={{ fontSize: 13 }}>{fileIcon(f.path)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: selectedFile === f.path ? "#a5b4fc" : "#94a3b8", fontSize: 12, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: selectedFile === f.path ? 600 : 400 }}>{f.path}</div>
                  <div style={{ color: "#334155", fontSize: 10, marginTop: 1 }}>{(f.size / 1024).toFixed(1)} KB</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main viewer */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          {/* Tab bar */}
          {selectedFile && (
            <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "0 12px", height: 40, borderBottom: "1px solid #1e293b", flexShrink: 0, background: "#0a0f1e" }}>
              {hasDemo && (
                <button onClick={() => setMode("demo")} style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", background: mode === "demo" ? "rgba(79,70,229,0.15)" : "transparent", color: mode === "demo" ? "#a5b4fc" : "#475569" }}>🌐 Demo</button>
              )}
              <button onClick={() => setMode("code")} style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", background: mode === "code" ? "rgba(79,70,229,0.15)" : "transparent", color: mode === "code" ? "#a5b4fc" : "#475569" }}>{"</>"} Code</button>
              <div style={{ flex: 1 }} />
              <span style={{ color: "#334155", fontSize: 11, fontFamily: "monospace" }}>{selectedFile}</span>
            </div>
          )}

          {!selectedFile ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: "#334155", fontSize: 14 }}>Select a file</p>
            </div>
          ) : loadingContent ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Loader2 size={20} style={{ color: "#4f46e5", animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : mode === "demo" && hasDemo ? (
            <iframe
              key={`${iframeKey}-${selectedFile}`}
              srcDoc={iframeSrcdoc}
              style={{ flex: 1, width: "100%", border: "none", background: "#fff" }}
              sandbox="allow-scripts allow-forms allow-modals allow-popups"
              title="App Demo"
            />
          ) : (
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              <pre style={{ margin: 0, color: "#e2e8f0", fontSize: 13, lineHeight: 1.7, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{fileContent}</pre>
            </div>
          )}
        </div>

        {/* Chat panel */}
        <div style={{ width: 340, flexShrink: 0, borderLeft: "1px solid #1e293b", display: "flex", flexDirection: "column", background: "#0a0f1e", overflow: "hidden" }}>
          {/* Chat header */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
            <p style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, margin: 0 }}>Edit with Agents</p>
            <p style={{ color: "#334155", fontSize: 11, margin: "2px 0 0" }}>Describe a change — the full team will implement it</p>
          </div>

          {/* Thread feed */}
          <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 16 }}>
            {threads.length === 0 && (
              <div style={{ textAlign: "center", paddingTop: 40 }}>
                <p style={{ fontSize: 24, marginBottom: 8 }}>✨</p>
                <p style={{ color: "#334155", fontSize: 13 }}>Ask the team to make changes</p>
                <p style={{ color: "#1e293b", fontSize: 12, marginTop: 4 }}>e.g. &ldquo;add a dark mode toggle&rdquo; or &ldquo;make the buttons bigger&rdquo;</p>
              </div>
            )}
            {threads.map((thread) => (
              <div key={thread.id}>
                {/* User message */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                  <div style={{ background: "#4f46e5", color: "#fff", borderRadius: "12px 12px 4px 12px", padding: "8px 12px", fontSize: 13, maxWidth: "85%", lineHeight: 1.5 }}>
                    {thread.message}
                  </div>
                </div>
                {/* Agent events */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {thread.events.map((ev, i) => {
                    const color = agentColor[ev.agent] ?? "#64748b";
                    const icon = agentIcon[ev.agent] ?? "⚙️";
                    return (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: `${color}15`, border: `1px solid ${color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, marginTop: 1 }}>{icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                            <span style={{ color, fontSize: 10, fontWeight: 700, textTransform: "capitalize" }}>{ev.agent}</span>
                            <span style={{ background: "#1e293b", color: "#475569", fontSize: 9, padding: "1px 5px", borderRadius: 4 }}>{ev.type}</span>
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.5, background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: "6px 10px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                            {ev.content.slice(0, 300)}{ev.content.length > 300 ? "…" : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!thread.done && !thread.failed && thread.events.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px" }}>
                      <Loader2 size={12} style={{ color: "#4f46e5", animation: "spin 0.8s linear infinite" }} />
                      <span style={{ color: "#334155", fontSize: 11 }}>agents working…</span>
                    </div>
                  )}
                  {thread.done && (
                    <div style={{ background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#34d399", fontWeight: 600 }}>
                      ✓ Changes applied — preview updated
                    </div>
                  )}
                  {thread.failed && (
                    <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.15)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#f87171" }}>
                      ✗ Something went wrong
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: "12px 14px", borderTop: "1px solid #1e293b", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                value={editInput}
                onChange={(e) => setEditInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendEdit(); } }}
                placeholder="Describe a change to the project…"
                rows={2}
                disabled={editing}
                style={{ flex: 1, background: "#111827", border: "1px solid #1e293b", borderRadius: 10, color: "#e2e8f0", fontSize: 13, padding: "8px 12px", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, opacity: editing ? 0.5 : 1 }}
              />
              <button
                onClick={sendEdit}
                disabled={!editInput.trim() || editing}
                style={{ width: 36, height: 36, borderRadius: 10, background: editing || !editInput.trim() ? "#1e293b" : "#4f46e5", border: "none", cursor: editing || !editInput.trim() ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                {editing ? <Loader2 size={15} style={{ color: "#475569", animation: "spin 0.8s linear infinite" }} /> : <Send size={15} style={{ color: "#fff" }} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
