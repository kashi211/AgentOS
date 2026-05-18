"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GitBranch,
  Bot,
  ListTodo,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
} from "lucide-react";

const nav = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/projects", label: "Projects", icon: ListTodo },
];

const secondaryNav = [
  { href: "/architecture", label: "Architecture", icon: GitBranch },
  { href: "/observability", label: "Observability", icon: BarChart3 },
];

function SidebarContent({ onClose, collapsed, onToggleCollapse }: {
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();

  if (collapsed) {
    return (
      <aside
        style={{
          background: "#ffffff",
          borderRight: "1px solid var(--card-border)",
          width: "56px",
          minWidth: "56px",
        }}
        className="h-full flex flex-col items-center py-3 gap-1"
      >
        {/* Logo icon */}
        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 mb-2" style={{ background: "#0a0a0f" }}>
          <Image src="/agentos.png" alt="AgentOS" width={32} height={32} className="w-full h-full object-cover" />
        </div>

        {/* Nav icons */}
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className="w-9 h-9 flex items-center justify-center rounded-lg transition-all"
              style={{
                background: active ? "var(--accent-light)" : "transparent",
                color: active ? "var(--accent)" : "var(--muted)",
              }}
            >
              <Icon size={17} />
            </Link>
          );
        })}

        <div className="flex-1" />

        {/* Secondary nav icons */}
        {secondaryNav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className="w-9 h-9 flex items-center justify-center rounded-lg transition-all"
              style={{
                color: active ? "var(--accent)" : "var(--muted-light)",
                background: active ? "var(--accent-light)" : "transparent",
              }}
            >
              <Icon size={15} />
            </Link>
          );
        })}

        {/* Expand button */}
        <button
          onClick={onToggleCollapse}
          title="Expand sidebar"
          className="w-9 h-9 flex items-center justify-center rounded-lg mt-1"
          style={{ color: "var(--muted-light)" }}
        >
          <ChevronRight size={16} />
        </button>
      </aside>
    );
  }

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
        <div className="flex items-center gap-1">
          {onToggleCollapse && (
            <button onClick={onToggleCollapse} title="Collapse sidebar" className="p-1 rounded-md" style={{ color: "var(--muted)" }}>
              <ChevronLeft size={16} />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-1 rounded-md" style={{ color: "var(--muted)" }}>
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Primary Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        <p className="text-xs font-semibold px-3 py-2 uppercase tracking-widest" style={{ color: "var(--muted-light)" }}>
          Navigation
        </p>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? "var(--accent-light)" : "transparent",
                color: active ? "var(--accent)" : "var(--muted)",
              }}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} style={{ color: "var(--accent)" }} />}
            </Link>
          );
        })}
      </nav>

      {/* Secondary Nav */}
      <div className="px-3 pb-2 space-y-0.5">
        {secondaryNav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all"
              style={{
                color: active ? "var(--accent)" : "var(--muted-light)",
                background: active ? "var(--accent-light)" : "transparent",
                fontSize: "12px",
              }}
            >
              <Icon size={13} className="shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>

    </aside>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    setCollapsed(c => {
      localStorage.setItem("sidebar-collapsed", String(!c));
      return !c;
    });
  };

  return (
    <>
      {/* Mobile top bar */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 h-14 border-b"
        style={{ background: "#ffffff", borderColor: "var(--card-border)" }}
      >
        <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg" style={{ color: "var(--foreground)" }}>
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md overflow-hidden" style={{ background: "#0a0a0f" }}>
            <Image src="/agentos.png" alt="AgentOS" width={28} height={28} className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-sm" style={{ color: "var(--foreground)" }}>AgentOS</span>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full">
        <SidebarContent collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </div>

      {/* Mobile drawer backdrop */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" style={{ background: "rgba(0,0,0,0.35)" }} onClick={() => setOpen(false)} />
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
