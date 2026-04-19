"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Send,
  LogOut,
  QrCode as QrIcon,
  PhoneCall,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { showToast, updateToast } from "@/lib/ui-store";
import { UILayer } from "@/components/ui/ui-layer";

// All calls to the bisnesgpt backend go through our server proxy at
// /api/whatsapp/bsg/<path>. That sidesteps CORS and keeps the backend URL in
// one place. The proxy preserves query strings and method.
const BSG = "/api/whatsapp/bsg";

const STORAGE_EMAIL = "mb_wa_email";

interface UserConfig {
  company_id: string;
  role?: string;
  name?: string;
  email?: string;
}

interface PhoneStatus {
  phoneIndex: number;
  status: string; // "ready" | "authenticated" | "qr" | "loading" | "disconnected"
  qrCode: string | null;
  phoneInfo?: string | null;
}

interface BotStatus {
  qrCode: string | null;
  status: string;
  phones?: PhoneStatus[];
  phoneCount?: number;
  phoneInfo?: boolean | string;
}

interface Contact {
  contact_id: string;
  contactName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  chat_id?: string;
  lastMessage?: string;
  last_message?: string;
  lastMessageAt?: string;
  last_message_at?: string;
}

interface WAMessage {
  id?: string;
  messageId?: string;
  chat_id?: string;
  from_me?: boolean;
  fromMe?: boolean;
  timestamp?: number;
  createdAt?: string;
  text?: { body?: string } | string;
  body?: string;
  type?: string;
}

export default function WhatsAppPage() {
  const { theme } = useAppStore();
  const isDark = theme === "dark";
  const [email, setEmail] = useState<string | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WAMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Bootstrap email from localStorage (client-only).
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_EMAIL) : null;
    setEmail(saved);
    setLoadingMe(false);
  }, []);

  // Once we have an email, pull user config to get the companyId.
  useEffect(() => {
    if (!email) {
      setConfig(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${BSG}/user/config?email=${encodeURIComponent(email)}`);
        if (!res.ok) {
          setConfig(null);
          return;
        }
        const data = (await res.json()) as UserConfig;
        if (!data?.company_id) {
          setConfig(null);
          return;
        }
        setConfig(data);
      } catch {
        setConfig(null);
      }
    })();
  }, [email]);

  // Poll bot status every 5s while we have a companyId.
  useEffect(() => {
    if (!config?.company_id) return;
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const r = await fetch(`${BSG}/bot-status/${encodeURIComponent(config.company_id)}`);
        if (!r.ok || cancelled) return;
        const data = (await r.json()) as BotStatus;
        setBotStatus(data);
      } catch {
        /* ignore */
      }
    };
    fetchStatus();
    const t = setInterval(fetchStatus, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [config?.company_id]);

  // Load contacts once we're authenticated to WhatsApp.
  const phoneReady = useMemo(() => {
    if (!botStatus) return false;
    if (Array.isArray(botStatus.phones) && botStatus.phones.length > 0) {
      return botStatus.phones.some((p) => p.status === "ready" || p.status === "authenticated");
    }
    return botStatus.status === "ready" || botStatus.status === "authenticated";
  }, [botStatus]);

  async function loadContacts() {
    if (!config?.company_id || !email) return;
    setContactsLoading(true);
    try {
      const r = await fetch(
        `${BSG}/companies/${encodeURIComponent(config.company_id)}/contacts?email=${encodeURIComponent(email)}`
      );
      if (!r.ok) return;
      const data = await r.json();
      setContacts(Array.isArray(data?.contacts) ? data.contacts : []);
    } finally {
      setContactsLoading(false);
    }
  }

  useEffect(() => {
    if (phoneReady) loadContacts();
  }, [phoneReady, config?.company_id]);

  // Load messages for the active chat whenever it changes; also poll every 5s.
  useEffect(() => {
    if (!activeChatId || !config?.company_id || !email) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    const fetchMessages = async () => {
      setMessagesLoading(true);
      try {
        // Try a few plausible endpoint shapes. Backend exposes conversation
        // messages under /api/companies/{id}/messages?chatId=... in most
        // installations; fall back to a direct messages endpoint.
        const r = await fetch(
          `${BSG}/messages/${encodeURIComponent(config.company_id)}/${encodeURIComponent(activeChatId)}?email=${encodeURIComponent(email)}`
        );
        if (!r.ok) {
          if (!cancelled) setMessages([]);
          return;
        }
        const data = await r.json();
        if (cancelled) return;
        const list: WAMessage[] = Array.isArray(data?.messages)
          ? data.messages
          : Array.isArray(data)
            ? data
            : [];
        setMessages(list);
      } finally {
        setMessagesLoading(false);
      }
    };
    fetchMessages();
    const t = setInterval(fetchMessages, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [activeChatId, config?.company_id, email]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  function handleLogout() {
    localStorage.removeItem(STORAGE_EMAIL);
    setEmail(null);
    setConfig(null);
    setBotStatus(null);
    setContacts([]);
    setActiveChatId(null);
    setMessages([]);
  }

  async function sendDraft() {
    if (!draft.trim() || !activeChatId || !config?.company_id) return;
    setSending(true);
    const toastId = showToast("Sending…", { kind: "loading" });
    try {
      const res = await fetch(
        `${BSG}/v2/messages/text/${encodeURIComponent(config.company_id)}/0`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: activeChatId, message: draft }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        updateToast(toastId, { kind: "error", message: data?.error || "Send failed" });
        return;
      }
      updateToast(toastId, { kind: "success", message: "Sent." });
      setDraft("");
      // Re-fetch messages immediately.
      const r = await fetch(
        `${BSG}/messages/${encodeURIComponent(config.company_id)}/${encodeURIComponent(activeChatId)}?email=${encodeURIComponent(email!)}`
      );
      if (r.ok) {
        const data = await r.json();
        const list: WAMessage[] = Array.isArray(data?.messages)
          ? data.messages
          : Array.isArray(data)
            ? data
            : [];
        setMessages(list);
      }
    } finally {
      setSending(false);
    }
  }

  // --- rendering ----------------------------------------------------------

  const bg = isDark ? "#0b0f14" : "#eae6df";
  const panel = isDark ? "bg-[#0f1720] border-gray-800 text-white" : "bg-white border-gray-200 text-[#0d1117]";

  if (loadingMe) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: bg }}>
        <Loader2 className="h-6 w-6 animate-spin text-[#25d366]" />
      </div>
    );
  }

  if (!email) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center" style={{ background: bg }}>
          <LoginForm
            isDark={isDark}
            onSuccess={(signedInEmail) => {
              localStorage.setItem(STORAGE_EMAIL, signedInEmail);
              setEmail(signedInEmail);
            }}
          />
        </div>
        <UILayer />
      </>
    );
  }

  // Email saved but no config yet = still resolving OR backend rejected.
  if (!config) {
    return (
      <>
        <TopBar email={email} onLogout={handleLogout} isDark={isDark} connected={false} />
        <div className="flex items-center justify-center py-20">
          <div className={`w-full max-w-sm rounded-2xl border p-6 text-center ${panel}`}>
            <p className="text-sm font-semibold">Couldn't load your Adletic Inbox config.</p>
            <p className="mt-1 text-[12px] opacity-70">
              The email saved here isn't recognised by Adletic Inbox. Sign out and try again.
            </p>
          </div>
        </div>
        <UILayer />
      </>
    );
  }

  if (!phoneReady) {
    // Grab the first QR we can find in the status payload.
    const qrCode =
      botStatus?.phones?.find((p) => p.qrCode)?.qrCode ?? botStatus?.qrCode ?? null;
    return (
      <>
        <TopBar email={email} onLogout={handleLogout} isDark={isDark} connected={false} />
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-10">
          <div className={`w-full rounded-2xl border p-6 ${panel}`}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "#25d36622" }}>
                <QrIcon className="h-5 w-5" style={{ color: "#25d366" }} />
              </div>
              <div>
                <h2 className="text-base font-bold">Scan to connect WhatsApp</h2>
                <p className="text-[12px] opacity-70">
                  Open WhatsApp → Settings → Linked Devices → Link a device.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center rounded-xl border border-dashed p-6" style={{ borderColor: isDark ? "#1f2937" : "#e5e7eb" }}>
              {qrCode ? (
                <img
                  src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="WhatsApp QR"
                  className="h-60 w-60 rounded-lg bg-white p-2"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-[#25d366]" />
                  <p className="text-[12px] opacity-70">
                    Waiting for a QR code from the server…
                  </p>
                </div>
              )}
            </div>
            <p className="mt-3 text-center text-[11px] opacity-60">
              Status: <span className="font-semibold">{botStatus?.status ?? "checking…"}</span>
            </p>
          </div>
        </div>
        <UILayer />
      </>
    );
  }

  const activeContact = contacts.find((c) => (c.chat_id || c.contact_id) === activeChatId) || null;

  return (
    <>
      <TopBar email={email} onLogout={handleLogout} isDark={isDark} connected={true} />
      <main className="mx-auto flex h-[calc(100vh-56px)] w-full max-w-6xl overflow-hidden px-0 md:px-4 md:py-4">
        <aside className={`flex w-full max-w-[320px] flex-col overflow-hidden border md:rounded-l-xl ${panel} ${activeChatId ? "hidden md:flex" : "flex"}`}>
          <div className={`flex items-center justify-between border-b px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider ${isDark ? "border-gray-800 text-gray-400" : "border-gray-200 text-gray-500"}`}>
            <span>Chats</span>
            <button
              onClick={loadContacts}
              className={`rounded-lg p-1 transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-gray-100"}`}
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${contactsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {contactsLoading && contacts.length === 0 ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            ) : contacts.length === 0 ? (
              <p className={`px-4 py-8 text-center text-[12px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                No contacts synced yet.
              </p>
            ) : (
              contacts.map((c) => {
                const id = c.chat_id || c.contact_id;
                const name =
                  c.contactName || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone || id;
                const active = activeChatId === id;
                return (
                  <button
                    key={c.contact_id}
                    onClick={() => setActiveChatId(id)}
                    className={`flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition-colors ${
                      active
                        ? isDark ? "border-gray-800 bg-white/5" : "border-gray-200 bg-[#f0f2f5]"
                        : isDark ? "border-gray-800 hover:bg-white/[0.03]" : "border-gray-100 hover:bg-gray-50"
                    }`}
                  >
                    <Avatar name={name} />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-[13px] font-semibold">{name}</p>
                      <p className={`truncate text-[11.5px] ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                        {c.lastMessage || c.last_message || c.phone || "—"}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section
          className={`flex flex-1 flex-col overflow-hidden border-t border-b border-r md:rounded-r-xl ${panel} ${activeChatId ? "flex" : "hidden md:flex"}`}
          style={{ background: isDark ? "#0f1720" : "#e5ddd5" }}
        >
          {!activeChatId ? (
            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "#25d36622" }}>
                <MessageSquare className="h-7 w-7" style={{ color: "#25d366" }} />
              </div>
              <h3 className="mt-3 text-lg font-bold">Pick a chat</h3>
              <p className={`mt-1 max-w-sm text-[13px] ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Your AI assistant replies on its own. Jump in manually from here when you need to.
              </p>
            </div>
          ) : (
            <>
              <div className={`flex items-center gap-3 border-b px-4 py-2.5 ${isDark ? "border-gray-800" : "border-gray-200 bg-[#f0f2f5]"}`}>
                <button onClick={() => setActiveChatId(null)} className="md:hidden text-gray-400">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <Avatar name={activeContact?.contactName || activeChatId || "?"} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate">
                    {activeContact?.contactName || activeContact?.phone || activeChatId}
                  </p>
                  <p className={`text-[10.5px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    {activeContact?.phone || ""}
                  </p>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
                {messagesLoading && messages.length === 0 ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className={`text-center text-[12px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    No messages yet.
                  </p>
                ) : (
                  messages.map((m, i) => <Bubble key={m.id || m.messageId || i} msg={m} isDark={isDark} />)
                )}
              </div>

              <div className={`border-t px-3 py-2 ${isDark ? "border-gray-800" : "border-gray-200 bg-[#f0f2f5]"}`}>
                <div className={`flex items-end gap-2 rounded-xl border px-3 py-1.5 ${isDark ? "border-gray-700 bg-[#1a2229]" : "border-gray-200 bg-white"}`}>
                  <textarea
                    value={draft}
                    placeholder="Type a reply…"
                    rows={1}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendDraft();
                      }
                    }}
                    className="flex-1 resize-none bg-transparent py-1.5 text-[13.5px] outline-none placeholder:text-gray-400"
                    style={{ maxHeight: 120 }}
                  />
                  <button
                    onClick={sendDraft}
                    disabled={!draft.trim() || sending}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40"
                    style={{ background: "#25d366" }}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
      <UILayer />
    </>
  );
}

// --- Login form -------------------------------------------------------------

function LoginForm({
  isDark,
  onSuccess,
}: {
  isDark: boolean;
  onSuccess: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const panel = isDark ? "bg-[#0f1720] border-gray-800 text-white" : "bg-white border-gray-200 text-[#0d1117]";
  const input = isDark
    ? "border-gray-700 bg-[#0b0f14] text-white placeholder-gray-500 focus:border-[#25d366]"
    : "border-gray-200 bg-gray-50 text-[#0d1117] placeholder-gray-400 focus:border-[#25d366] focus:bg-white";

  async function submit() {
    if (!email.trim() || !password) {
      showToast("Enter email and password", { kind: "error" });
      return;
    }
    setBusy(true);
    const toastId = showToast("Signing in…", { kind: "loading" });
    try {
      const res = await fetch(`${BSG}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        updateToast(toastId, {
          kind: "error",
          message: data?.error || "Invalid credentials",
        });
        return;
      }
      updateToast(toastId, { kind: "success", message: "Signed in." });
      onSuccess(email.trim());
    } catch {
      updateToast(toastId, { kind: "error", message: "Connection error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`w-full max-w-sm rounded-2xl border p-6 shadow-xl ${panel}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "#25d36622" }}>
          <MessageSquare className="h-5 w-5" style={{ color: "#25d366" }} />
        </div>
        <div>
          <h1 className="text-base font-bold">WhatsApp AI</h1>
          <p className={`text-[11.5px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Sign in with your Adletic Inbox account
          </p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <input
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className={`w-full rounded-lg border px-3 py-2 text-[13px] outline-none ${input}`}
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className={`w-full rounded-lg border px-3 py-2 text-[13px] outline-none ${input}`}
        />
        <button
          onClick={submit}
          disabled={busy}
          className="w-full rounded-lg py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
          style={{ background: "#25d366" }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
      <p className={`mt-3 text-center text-[11px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
        Don't have an account? Create one at app.adleticagency.com.
      </p>
      <div className="mt-4 text-center">
        <Link href="/generate" className="text-[11px] font-semibold text-gray-400 hover:text-gray-600">
          ← Back to canvas
        </Link>
      </div>
    </div>
  );
}

// --- Top bar ----------------------------------------------------------------

function TopBar({
  email,
  onLogout,
  isDark,
  connected,
}: {
  email: string;
  onLogout: () => void;
  isDark: boolean;
  connected: boolean;
}) {
  const bg = isDark ? "bg-[#0f1720] border-gray-800" : "bg-white border-gray-200";
  return (
    <header className={`sticky top-0 z-20 border-b ${bg}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/generate" className="flex items-center gap-2 text-[13px] font-semibold hover:text-[#25d366]">
          <ArrowLeft className="h-4 w-4" /> Back to canvas
        </Link>
        <div className="flex items-center gap-2 text-sm font-bold">
          <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: "#25d366" }}>
            <MessageSquare className="h-3.5 w-3.5 text-white" />
          </div>
          WhatsApp AI
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              connected ? "bg-[#25d366]/10 text-[#25d366]" : "bg-yellow-500/10 text-yellow-600"
            }`}
          >
            <PhoneCall className="h-3 w-3" /> {connected ? "Connected" : "Not connected"}
          </span>
          <span className={`hidden text-[11px] font-semibold sm:inline ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            {email}
          </span>
          <button
            onClick={onLogout}
            className={`rounded-lg p-1.5 ${isDark ? "text-gray-400 hover:bg-white/5 hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-black"}`}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

// --- Bubble + Avatar --------------------------------------------------------

function Bubble({ msg, isDark }: { msg: WAMessage; isDark: boolean }) {
  const mine = msg.from_me ?? msg.fromMe ?? false;
  const textBody =
    typeof msg.text === "string"
      ? msg.text
      : (msg.text as { body?: string } | undefined)?.body || msg.body || "";
  const bg = mine ? "#d9fdd3" : isDark ? "#1e2732" : "#ffffff";
  const color = mine ? "#0d1117" : isDark ? "#f3f4f6" : "#0d1117";
  const ts = msg.timestamp
    ? new Date(msg.timestamp * 1000)
    : msg.createdAt
      ? new Date(msg.createdAt)
      : null;
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[80%] rounded-2xl px-3 py-2 text-[13.5px] leading-relaxed shadow-sm"
        style={{
          background: bg,
          color,
          borderBottomRightRadius: mine ? 4 : undefined,
          borderBottomLeftRadius: mine ? undefined : 4,
        }}
      >
        <p className="whitespace-pre-wrap">{textBody}</p>
        {ts && (
          <p className="mt-0.5 text-right text-[9px] opacity-60">
            {ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const hash = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = [140, 12, 200, 260, 340, 28];
  const hue = hues[hash % hues.length];
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-black text-white"
      style={{ background: `hsl(${hue}, 55%, 45%)` }}
    >
      {initial}
    </div>
  );
}
