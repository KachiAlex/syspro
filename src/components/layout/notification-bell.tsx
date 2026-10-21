"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

type AppNotification = {
  id: string;
  event_type: string;
  title: string;
  body?: string;
  link?: string;
  read_at?: string | null;
  created_at: string;
};

const POLL_MS = 30_000;

export function NotificationBell() {
  const { tenantSlug } = useTenantContext();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!tenantSlug) return;
    try {
      const res = await fetch(`/api/notifications?tenantSlug=${encodeURIComponent(tenantSlug)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      // polling failure is silent — the next interval retries
    }
  }, [tenantSlug]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAll = async () => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug }),
    });
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  };

  const markOne = async (n: AppNotification) => {
    if (n.read_at) return;
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug, ids: [n.id] }),
    });
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    setUnread((u) => Math.max(0, u - 1));
  };

  return (
    <div ref={rootRef} className="relative hidden sm:block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-theme-sidebar-text hover:text-theme-sidebar-text-active hover:bg-theme-sidebar-hover rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-theme-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[90vw] bg-theme-surface border border-theme-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-theme-border">
            <p className="text-sm font-semibold text-theme-text">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-sm text-theme-text-tertiary text-center">No notifications yet</p>
            ) : (
              items.map((n) => {
                const content = (
                  <div
                    className={`px-4 py-3 border-b border-theme-border last:border-b-0 hover:bg-theme-sidebar-hover transition-colors ${n.read_at ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read_at && <span className="mt-1.5 w-2 h-2 rounded-full bg-theme-danger shrink-0" />}
                      <div className={n.read_at ? "pl-4" : ""}>
                        <p className="text-sm font-medium text-theme-text">{n.title}</p>
                        {n.body && (
                          <p className="text-xs text-theme-text-tertiary mt-0.5 line-clamp-2 whitespace-pre-line">{n.body}</p>
                        )}
                        <p className="text-[10px] text-theme-text-tertiary mt-1">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => { markOne(n); setOpen(false); }} className="block">
                    {content}
                  </Link>
                ) : (
                  <div key={n.id} onClick={() => markOne(n)} className="cursor-pointer">
                    {content}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
