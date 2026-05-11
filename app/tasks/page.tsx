"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, CheckCircle2, XCircle, Clock, RefreshCw, FileCode, Download } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS  = process.env.NEXT_PUBLIC_WS_URL  ?? "ws://localhost:8000";

type TaskStatus = "pending" | "planning" | "executing" | "reviewing" | "done" | "failed";

interface Task {
  id: string;
  goal: string;
  status: TaskStatus;
  created_at: string;
}

interface LiveEvent {
  type: string;
  agent: string;
  content: string;
  node?: string;
}

interface Message {
  id: string;
  agent_role: string;
  type: string;
  content: string;
  created_at: string;
}

const agentColor: Record<string, string> = {
  ceo: "#4f46e5",
  planner: "#7c3aed",
  developer: "#0284c7",
  qa: "#059669",
  writer: "#d97706",
  system: "#64748b",
};

const agentIcon: Record<string, string> = {
  ceo: "👔",
  planner: "🗺️",
  developer: "💻",
  qa: "🔍",
  writer: "✍️",
  system: "⚙️",
};

const statusConfig: Record<TaskStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending:   { label: "Pending",   color: "#94a3b8", icon: Clock },
  planning:  { label: "Planning",  color: "#4f46e5", icon: Loader2 },
  executing: { label: "Executing", color: "#0284c7", icon: Loader2 },
  reviewing: { label: "Reviewing", color: "#d97706", icon: Loader2 },
  done:      { label: "Done",      color: "#059669", icon: CheckCircle2 },
  failed:    { label: "Failed",    color: "#dc2626", icon: XCircle },
};

interface TaskFile {
  path: string;
  size: number;
}

export default function TasksPage() {
  const [goal, setGoal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [loadingFile, setLoadingFile] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch task list
  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API}/tasks/`);
      if (res.ok) setTasks(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll feed
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [liveEvents, messages]);

  const fetchFiles = async (taskId: string) => {
    try {
      const res = await fetch(`${API}/tasks/${taskId}/files`);
      if (res.ok) setFiles(await res.json());
    } catch {}
  };

  const viewFile = async (taskId: string, filePath: string) => {
    setSelectedFile(filePath);
    setLoadingFile(true);
    try {
      const res = await fetch(`${API}/tasks/${taskId}/files/${filePath}`);
      if (res.ok) setFileContent(await res.text());
    } finally {
      setLoadingFile(false);
    }
  };

  // Select a task and subscribe to its WS feed
  const selectTask = async (taskId: string) => {
    setSelectedId(taskId);
    setLiveEvents([]);
    setFiles([]);
    setSelectedFile(null);
    setFileContent("");
    setLoadingMessages(true);

    // Close previous WS
    wsRef.current?.close();

    // Load existing messages
    try {
      const res = await fetch(`${API}/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } finally {
      setLoadingMessages(false);
    }

    // Load files
    fetchFiles(taskId);

    // Open WebSocket for live events
    const ws = new WebSocket(`${WS}/ws/${taskId}`);
    ws.onmessage = (e) => {
      const event: LiveEvent = JSON.parse(e.data);
      setLiveEvents((prev) => [...prev, event]);
      // Refresh task status and files when done
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          if (event.type === "done") { fetchFiles(taskId); return { ...t, status: "done" }; }
          if (event.type === "error") return { ...t, status: "failed" };
          if (event.agent === "ceo") return { ...t, status: "planning" };
          if (event.agent === "developer") return { ...t, status: "executing" };
          if (event.agent === "qa") return { ...t, status: "reviewing" };
          return t;
        })
      );
    };
    wsRef.current = ws;
  };

  const submitTask = async () => {
    if (!goal.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/tasks/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setGoal("");
        await fetchTasks();
        selectTask(data.task_id);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTask = tasks.find((t) => t.id === selectedId);
  const allFeedItems = [
    ...messages.map((m) => ({ ...m, isLive: false })),
    ...liveEvents.map((e, i) => ({
      id: `live-${i}`,
      agent_role: e.agent,
      type: e.type,
      content: e.content,
      created_at: new Date().toISOString(),
      isLive: true,
    })),
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-8 lg:px-10 pt-8 pb-6 border-b" style={{ borderColor: "var(--card-border)" }}>
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--foreground)" }}>Tasks</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Submit a goal and watch your agent team execute it in real time.
        </p>

        {/* Goal input */}
        <div className="flex gap-2 mt-4">
          <textarea
            className="flex-1 px-4 py-3 rounded-xl text-sm resize-none border outline-none transition-all"
            style={{
              background: "var(--card)",
              borderColor: "var(--card-border)",
              color: "var(--foreground)",
              minHeight: "52px",
              maxHeight: "120px",
            }}
            placeholder='e.g. "Build a Python REST API with FastAPI that manages a todo list"'
            value={goal}
            rows={1}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitTask(); }
            }}
          />
          <button
            onClick={submitTask}
            disabled={!goal.trim() || submitting}
            className="px-4 py-3 rounded-xl text-sm font-semibold text-white flex items-center gap-2 shrink-0 transition-all disabled:opacity-50"
            style={{ background: "var(--accent)", boxShadow: "0 2px 8px rgba(79,70,229,0.25)" }}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {submitting ? "Submitting…" : "Run"}
          </button>
        </div>
      </div>

      {/* Body — task list + feed */}
      <div className="flex flex-1 overflow-hidden">

        {/* Task list */}
        <div
          className="w-72 shrink-0 border-r overflow-y-auto"
          style={{ borderColor: "var(--card-border)", background: "#fafafa" }}
        >
          <div className="p-3 flex items-center justify-between border-b" style={{ borderColor: "var(--card-border)" }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-light)" }}>
              {tasks.length} task{tasks.length !== 1 ? "s" : ""}
            </span>
            <button onClick={fetchTasks} className="p-1 rounded" style={{ color: "var(--muted)" }}>
              <RefreshCw size={13} />
            </button>
          </div>

          {tasks.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm" style={{ color: "var(--muted)" }}>No tasks yet. Submit a goal above.</p>
            </div>
          ) : (
            tasks.map((task) => {
              const cfg = statusConfig[task.status] ?? statusConfig.pending;
              const Icon = cfg.icon;
              const active = task.id === selectedId;
              return (
                <button
                  key={task.id}
                  onClick={() => selectTask(task.id)}
                  className="w-full text-left px-4 py-3 border-b transition-all"
                  style={{
                    borderColor: "var(--card-border)",
                    background: active ? "var(--accent-light)" : "transparent",
                    borderLeft: active ? `3px solid var(--accent)` : "3px solid transparent",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon
                      size={12}
                      className={["planning", "executing", "reviewing"].includes(task.status) ? "animate-spin" : ""}
                      style={{ color: cfg.color, flexShrink: 0 }}
                    />
                    <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <p className="text-xs leading-snug line-clamp-2" style={{ color: active ? "var(--accent)" : "var(--foreground)" }}>
                    {task.goal}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted-light)" }}>
                    {new Date(task.created_at).toLocaleTimeString()}
                  </p>
                </button>
              );
            })
          )}
        </div>

        {/* Feed */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-3">🤖</div>
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Select a task to see the agent feed</p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Or submit a new goal above</p>
              </div>
            </div>
          ) : (
            <>
              {/* Selected task header */}
              <div className="px-6 py-3 border-b flex items-center gap-3" style={{ borderColor: "var(--card-border)" }}>
                {selectedTask && (() => {
                  const cfg = statusConfig[selectedTask.status] ?? statusConfig.pending;
                  const Icon = cfg.icon;
                  return (
                    <>
                      <Icon
                        size={14}
                        className={["planning", "executing", "reviewing"].includes(selectedTask.status) ? "animate-spin" : ""}
                        style={{ color: cfg.color }}
                      />
                      <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                      <span className="text-sm font-medium truncate flex-1" style={{ color: "var(--foreground)" }}>
                        {selectedTask.goal}
                      </span>
                      {files.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: "rgba(2,132,199,0.08)", color: "#0284c7", border: "1px solid rgba(2,132,199,0.15)" }}>
                          {files.length} file{files.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Events + Files side by side */}
              <div className="flex flex-1 overflow-hidden">
                {/* Events feed */}
                <div ref={feedRef} className="flex-1 overflow-y-auto p-6 space-y-3">
                  {loadingMessages ? (
                    <div className="flex justify-center pt-8">
                      <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
                    </div>
                  ) : allFeedItems.length === 0 ? (
                    <div className="text-center pt-8">
                      <Loader2 size={20} className="animate-spin mx-auto mb-2" style={{ color: "var(--accent)" }} />
                      <p className="text-sm" style={{ color: "var(--muted)" }}>Agents are starting up…</p>
                    </div>
                  ) : (
                    allFeedItems.map((item) => {
                      const color = agentColor[item.agent_role] ?? "#64748b";
                      const icon = agentIcon[item.agent_role] ?? "⚙️";
                      return (
                        <div key={item.id} className="flex gap-3">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 mt-0.5"
                            style={{ background: `${color}10`, border: `1px solid ${color}20` }}
                          >
                            {icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold capitalize" style={{ color }}>
                                {item.agent_role}
                              </span>
                              <span
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{ background: "var(--card-border)", color: "var(--muted)", fontSize: 10 }}
                              >
                                {item.type}
                              </span>
                              {"isLive" in item && item.isLive && (
                                <span className="text-xs" style={{ color: "var(--accent)", fontSize: 10 }}>● live</span>
                              )}
                            </div>
                            <div
                              className="text-sm leading-relaxed whitespace-pre-wrap rounded-lg px-3 py-2"
                              style={{
                                background: "var(--card)",
                                border: "1px solid var(--card-border)",
                                color: "var(--foreground)",
                                fontFamily: item.type === "tool_call" ? "var(--font-mono)" : "inherit",
                                fontSize: item.type === "tool_call" ? 12 : 13,
                              }}
                            >
                              {item.content}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Files panel — only shown when files exist */}
                {files.length > 0 && (
                  <div className="w-72 shrink-0 border-l flex flex-col overflow-hidden" style={{ borderColor: "var(--card-border)", background: "#fafafa" }}>
                    <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
                      <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--muted-light)" }}>
                        <FileCode size={12} /> Output Files
                      </span>
                      <button
                        onClick={() => selectedId && fetchFiles(selectedId)}
                        className="p-1 rounded"
                        style={{ color: "var(--muted)" }}
                      >
                        <RefreshCw size={12} />
                      </button>
                    </div>

                    {/* File list */}
                    <div className="overflow-y-auto border-b" style={{ maxHeight: "40%", borderColor: "var(--card-border)" }}>
                      {files.map((f) => (
                        <button
                          key={f.path}
                          onClick={() => selectedId && viewFile(selectedId, f.path)}
                          className="w-full text-left px-4 py-2.5 border-b text-xs transition-all"
                          style={{
                            borderColor: "var(--card-border)",
                            background: selectedFile === f.path ? "var(--accent-light)" : "transparent",
                            color: selectedFile === f.path ? "var(--accent)" : "var(--foreground)",
                            fontFamily: "var(--font-mono)",
                            borderLeft: selectedFile === f.path ? "3px solid var(--accent)" : "3px solid transparent",
                          }}
                        >
                          <div className="truncate">{f.path}</div>
                          <div className="text-xs mt-0.5" style={{ color: "var(--muted-light)" }}>{(f.size / 1024).toFixed(1)} KB</div>
                        </button>
                      ))}
                    </div>

                    {/* File content viewer */}
                    <div className="flex-1 overflow-auto p-3">
                      {!selectedFile ? (
                        <p className="text-xs text-center pt-6" style={{ color: "var(--muted)" }}>Select a file to preview</p>
                      ) : loadingFile ? (
                        <div className="flex justify-center pt-6">
                          <Loader2 size={16} className="animate-spin" style={{ color: "var(--muted)" }} />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono truncate" style={{ color: "var(--muted)" }}>{selectedFile}</span>
                            <a
                              href={`${API}/tasks/${selectedId}/files/${selectedFile}`}
                              download={selectedFile.split("/").pop()}
                              className="p-1 rounded shrink-0"
                              style={{ color: "var(--accent)" }}
                              title="Download"
                            >
                              <Download size={12} />
                            </a>
                          </div>
                          <pre
                            className="text-xs leading-relaxed whitespace-pre-wrap rounded-lg p-3 overflow-auto"
                            style={{
                              background: "var(--card)",
                              border: "1px solid var(--card-border)",
                              color: "var(--foreground)",
                              fontFamily: "var(--font-mono)",
                              maxHeight: "400px",
                            }}
                          >
                            {fileContent}
                          </pre>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
