"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type User = {
  first_name: string;
  email: string;
};

type NotificationItem = {
  id: number;
  title: string;
  body: string;
  reg_no: string;
  recall_no: string;
  read_at: string | null;
  created_at: string;
};

export default function SiteHeaderNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/account/notifications");
      if (!response.ok) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }
      const data = await response.json();
      setNotifications((data.notifications ?? []) as NotificationItem[]);
      setUnreadCount(Number(data.unreadCount ?? 0));
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) {
            setUser(null);
            setNotifications([]);
            setUnreadCount(0);
          }
          return;
        }
        const data = await response.json();
        if (!cancelled) {
          setUser(data.user);
          await loadNotifications();
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setNotifications([]);
          setUnreadCount(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, loadNotifications]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      void loadNotifications();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [user, loadNotifications]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setNotifications([]);
    setUnreadCount(0);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  async function markRead(id?: number) {
    const now = new Date().toISOString();
    if (id) {
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === id && !item.read_at ? { ...item, read_at: now } : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } else {
      setNotifications((prev) =>
        prev.map((item) =>
          item.read_at ? item : { ...item, read_at: now },
        ),
      );
      setUnreadCount(0);
    }

    await fetch("/api/account/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    await loadNotifications();
  }

  async function onNotificationClick(item: NotificationItem) {
    if (!item.read_at) {
      await markRead(item.id);
    }
  }

  return (
    <nav className="flex flex-wrap items-center gap-3 text-sm font-semibold text-[var(--muted)] sm:gap-4">
      <Link href="/" className="hover:text-[var(--ink)]">
        Search
      </Link>
      {user ? (
        <>
          <div className="relative" ref={panelRef}>
            <button
              type="button"
              className="relative inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 hover:border-[var(--honda-red)] hover:text-[var(--honda-red)]"
              aria-label="Notifications"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
                <path d="M10 17a2 2 0 0 0 4 0" />
              </svg>
              Alerts
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--honda-red)] px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {open && (
              <div className="absolute right-0 z-[100] mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    Notifications
                  </p>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-[var(--honda-red)]"
                      onClick={() => void markRead()}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-[var(--muted)]">
                      No notifications yet.
                    </p>
                  ) : (
                    notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`block w-full border-b border-[var(--line)] px-3 py-3 text-left last:border-b-0 hover:bg-[#f7f9fc] ${
                          item.read_at
                            ? "bg-white text-[var(--muted)]"
                            : "bg-[#fff7f8]"
                        }`}
                        onClick={() => void onNotificationClick(item)}
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-1.5 flex h-2 w-2 shrink-0 items-center justify-center">
                            {!item.read_at && (
                              <span
                                className="h-2 w-2 rounded-full bg-[var(--honda-red)]"
                                aria-hidden="true"
                              />
                            )}
                          </span>
                          <div>
                            <p
                              className={`text-sm ${
                                item.read_at
                                  ? "font-medium text-[var(--muted)]"
                                  : "font-semibold text-[var(--ink)]"
                              }`}
                            >
                              {item.title}
                            </p>
                            <p className="mt-0.5 text-xs text-[var(--muted)]">
                              {item.body}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <div className="border-t border-[var(--line)] px-3 py-2">
                  <Link
                    href="/account"
                    className="text-xs font-semibold text-[var(--honda-red)]"
                    onClick={() => setOpen(false)}
                  >
                    Open account
                  </Link>
                </div>
              </div>
            )}
          </div>
          <Link href="/account" className="hover:text-[var(--ink)]">
            Hi, {user.first_name}
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 hover:border-[var(--honda-red)] hover:text-[var(--honda-red)]"
          >
            Log out
          </button>
        </>
      ) : (
        <>
          <Link href="/login" className="hover:text-[var(--ink)]">
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 hover:border-[var(--honda-red)] hover:text-[var(--honda-red)]"
          >
            Create account
          </Link>
        </>
      )}
    </nav>
  );
}
