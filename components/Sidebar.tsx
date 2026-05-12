"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GitBranch,
  Map,
  Bot,
  ListTodo,
  Layers,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

const nav = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/architecture", label: "Architecture", icon: GitBranch },
  { href: "/plan", label: "Dev Plan", icon: Map },
  { href: "/presets", label: "Presets", icon: Layers },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/projects", label: "Projects", icon: ListTodo },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      style={{
        background: "#ffffff",
        borderRight: "1px solid var(--card-border)",
        width: "240px",
        minWidth: "240px",
      }}
      className="h-full flex flex-col"
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--card-border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0" style={{ background: "#0a0a0f" }}>
            <Image src="/agentos.png" alt="AgentOS" width={32} height={32} className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="font-bold text-sm leading-none" style={{ color: "var(--foreground)" }}>AgentOS</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Multi-Agent AI</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-md" style={{ color: "var(--muted)" }}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        <p className="text-xs font-semibold px-3 py-2 uppercase tracking-widest" style={{ color: "var(--muted-light)" }}>
          Navigation
        </p>
        {nav.map(({ href, label, icon: Icon }) => {
          const soon = false;
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={soon ? "#" : href}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative"
              style={{
                background: active ? "var(--accent-light)" : "transparent",
                color: active ? "var(--accent)" : soon ? "var(--muted-light)" : "var(--muted)",
                cursor: soon ? "default" : "pointer",
              }}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} style={{ color: "var(--accent)" }} />}
              {soon && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: "var(--accent-light)", color: "var(--accent)", fontSize: "10px" }}
                >
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t" style={{ borderColor: "var(--card-border)" }}>
        <div
          className="rounded-lg p-3"
          style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full pulse-dot" style={{ background: "var(--success)" }} />
            <span className="text-xs font-semibold" style={{ color: "var(--success)" }}>
              Alpha Build
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 h-14 border-b"
        style={{ background: "#ffffff", borderColor: "var(--card-border)" }}
      >
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 rounded-lg"
          style={{ color: "var(--foreground)" }}
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md overflow-hidden" style={{ background: "#0a0a0f" }}>
            <Image src="/agentos.png" alt="AgentOS" width={28} height={28} className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-sm" style={{ color: "var(--foreground)" }}>AgentOS</span>
        </div>
      </div>

      {/* Desktop sidebar — always visible */}
      <div className="hidden lg:flex h-full">
        <SidebarContent />
      </div>

      {/* Mobile drawer backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className="fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300"
        style={{ transform: open ? "translateX(0)" : "translateX(-100%)" }}
      >
        <SidebarContent onClose={() => setOpen(false)} />
      </div>
    </>
  );
}
