"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Lock, LogIn, UserPlus } from "lucide-react";
import { setToken } from "@/lib/auth";
import Image from "next/image";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const endpoint = tab === "signin" ? "/auth/login" : "/auth/register";
      const res = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Something went wrong. Please try again.");
        return;
      }
      setToken(data.token);
      router.push("/projects");
    } catch {
      setError("Could not connect to the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--background, #f8f9fa)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-xl"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        {/* Header */}
        <div
          className="px-8 pt-8 pb-6 text-center"
          style={{ borderBottom: "1px solid var(--card-border)", background: "var(--accent-light)" }}
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0" style={{ background: "#0a0a0f" }}>
              <Image src="/agentos.png" alt="AgentOS" width={40} height={40} className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-bold" style={{ color: "var(--foreground)" }}>AgentOS</span>
          </div>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Multi-Agent AI Platform</p>
        </div>

        {/* Tab switcher */}
        <div
          className="flex"
          style={{ borderBottom: "1px solid var(--card-border)" }}
        >
          {(["signin", "register"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); }}
              className="flex-1 py-3 text-sm font-semibold transition-all"
              style={{
                color: tab === t ? "var(--accent)" : "var(--muted)",
                borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
                background: "transparent",
              }}
            >
              {t === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
          {/* Email */}
          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={{ color: "var(--foreground)" }}
            >
              Email
            </label>
            <div className="relative">
              <Mail
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted)" }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "var(--background, #fff)",
                  border: "1px solid var(--card-border)",
                  color: "var(--foreground)",
                }}
                autoComplete="email"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={{ color: "var(--foreground)" }}
            >
              Password
            </label>
            <div className="relative">
              <Lock
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted)" }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === "register" ? "Choose a strong password" : "Your password"}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "var(--background, #fff)",
                  border: "1px solid var(--card-border)",
                  color: "var(--foreground)",
                }}
                autoComplete={tab === "signin" ? "current-password" : "new-password"}
                required
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60"
            style={{ background: "var(--accent)", boxShadow: "0 2px 12px rgba(79,70,229,0.35)" }}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : tab === "signin" ? (
              <LogIn size={16} />
            ) : (
              <UserPlus size={16} />
            )}
            {loading
              ? tab === "signin"
                ? "Signing in…"
                : "Creating account…"
              : tab === "signin"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        {/* Footer note */}
        <div
          className="px-8 pb-6 text-center"
        >
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {tab === "signin" ? (
              <>
                No account?{" "}
                <button
                  onClick={() => { setTab("register"); setError(null); }}
                  className="font-semibold"
                  style={{ color: "var(--accent)" }}
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => { setTab("signin"); setError(null); }}
                  className="font-semibold"
                  style={{ color: "var(--accent)" }}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
