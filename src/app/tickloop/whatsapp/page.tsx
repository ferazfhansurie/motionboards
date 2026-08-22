"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw, Send } from "lucide-react";

interface Contact {
  id: string;
  phone_e164: string;
  name: string | null;
  last_message: string | null;
  last_message_at: string | null;
}
interface Message {
  id: string;
  phone_e164: string;
  direction: "inbound" | "outbound";
  source: "cloud_api" | "business_app" | "history";
  message_type: string | null;
  body: string | null;
  sent_at: string;
}

const SOURCE_LABEL: Record<Message["source"], string> = {
  cloud_api: "CRM",
  business_app: "WhatsApp app",
  history: "History",
};

export default function TickLoopWhatsAppPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadContacts() {
    try {
      const response = await fetch("/api/tickloop/whatsapp/contacts");
      if (!response.ok) return;
      const data = await response.json();
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
    } finally {
      setContactsLoading(false);
    }
  }

  useEffect(() => {
    void loadContacts();
    const t = setInterval(loadContacts, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!activePhone) { setMessages([]); return; }
    let cancelled = false;
    const load = async () => {
      setMessagesLoading(true);
      try {
        const response = await fetch(`/api/tickloop/whatsapp/messages?phone=${encodeURIComponent(activePhone)}`);
        if (!response.ok || cancelled) return;
        const data = await response.json();
        setMessages(Array.isArray(data.messages) ? data.messages : []);
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    };
    void load();
    const t = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, [activePhone]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const activeContact = useMemo(() => contacts.find((c) => c.phone_e164 === activePhone) || null, [contacts, activePhone]);

  async function send() {
    if (!draft.trim() || !activePhone) return;
    setSending(true);
    setSendError(null);
    try {
      const response = await fetch("/api/tickloop/whatsapp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: activePhone, body: draft.trim() }),
      });
      const data = await response.json();
      if (!response.ok) { setSendError(data.error || "Send failed."); return; }
      setDraft("");
      const messagesResponse = await fetch(`/api/tickloop/whatsapp/messages?phone=${encodeURIComponent(activePhone)}`);
      if (messagesResponse.ok) {
        const data2 = await messagesResponse.json();
        setMessages(Array.isArray(data2.messages) ? data2.messages : []);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8f8] text-[#17201d]">
      <header className="border-b border-[#17201d]/[0.08] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link href="/shop-automation" className="flex items-center gap-2.5 font-black tracking-[-0.045em]">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#17201d] text-xs text-white">TL</span>
            <span className="hidden sm:inline">TickLoop</span>
            <span className="rounded-full bg-[#eff7ef] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.09em] text-[#2b7843]">WhatsApp</span>
          </Link>
          <button onClick={() => void loadContacts()} className="inline-flex items-center gap-2 rounded-xl border border-[#dce4de] bg-white px-3 py-2.5 text-sm font-bold transition hover:border-[#2b7843]">
            <RefreshCw className={`h-4 w-4 ${contactsLoading ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      <div className="mx-auto flex h-[calc(100vh-73px)] max-w-7xl px-0 py-0 sm:px-8 sm:py-6">
        <div className="grid w-full gap-0 overflow-hidden rounded-none border-0 bg-white sm:grid-cols-[300px_1fr] sm:rounded-3xl sm:border sm:border-[#dce4de] sm:shadow-[0_12px_45px_rgba(18,42,28,0.05)]">
          <aside className={`flex flex-col overflow-hidden border-r border-[#eef1ef] ${activePhone ? "hidden sm:flex" : "flex"}`}>
            <div className="border-b border-[#eef1ef] px-4 py-3 text-[11px] font-black uppercase tracking-[0.09em] text-[#78827d]">Contacts</div>
            <div className="flex-1 overflow-y-auto">
              {contactsLoading && contacts.length === 0 ? (
                <div className="flex justify-center py-10"><Loader2 className="h-4 w-4 animate-spin text-[#78827d]" /></div>
              ) : contacts.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs leading-5 text-[#78827d]">
                  No conversations synced yet. Once WhatsApp is connected, inbound messages and, for coexistence numbers, app-side replies and history will land here.
                </p>
              ) : (
                contacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => setActivePhone(contact.phone_e164)}
                    className={`flex w-full flex-col items-start gap-0.5 border-b border-[#f4f6f5] px-4 py-3 text-left transition ${activePhone === contact.phone_e164 ? "bg-[#f1faf3]" : "hover:bg-[#fafbfa]"}`}
                  >
                    <span className="text-sm font-bold">{contact.name || `+${contact.phone_e164}`}</span>
                    <span className="w-full truncate text-xs text-[#78827d]">{contact.last_message || "No messages yet"}</span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className={`flex flex-col overflow-hidden ${activePhone ? "flex" : "hidden sm:flex"}`}>
            {!activePhone ? (
              <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-[#78827d]">Pick a contact to see the conversation.</div>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-[#eef1ef] px-4 py-3">
                  <button onClick={() => setActivePhone(null)} className="text-[#78827d] sm:hidden"><ArrowLeft className="h-4 w-4" /></button>
                  <div>
                    <p className="text-sm font-bold">{activeContact?.name || `+${activePhone}`}</p>
                    <p className="text-xs text-[#78827d]">+{activePhone}</p>
                  </div>
                </div>
                <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-[#fbfcfb] px-4 py-4">
                  {messagesLoading && messages.length === 0 ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-4 w-4 animate-spin text-[#78827d]" /></div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-xs text-[#78827d]">No messages yet.</p>
                  ) : (
                    messages.map((message) => {
                      const mine = message.direction === "outbound";
                      return (
                        <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${mine ? "bg-[#dff3e4] text-[#17201d]" : "bg-white text-[#17201d]"}`}>
                            <p className="whitespace-pre-wrap">{message.body || `[${message.message_type || "unsupported"}]`}</p>
                            <p className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-[#8a938e]">
                              <span className="rounded-full bg-black/5 px-1.5 py-0.5 font-bold uppercase tracking-wide">{SOURCE_LABEL[message.source]}</span>
                              {new Date(message.sent_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="border-t border-[#eef1ef] px-3 py-2.5">
                  {sendError && <p className="mb-2 text-xs font-semibold text-[#a34a35]">{sendError}</p>}
                  <div className="flex items-end gap-2 rounded-xl border border-[#dce4de] bg-white px-3 py-1.5">
                    <textarea
                      value={draft}
                      placeholder="Type a reply — only delivers inside Meta's 24h customer-service window"
                      rows={1}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }}
                      className="flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-[#a8b1ac]"
                      style={{ maxHeight: 120 }}
                    />
                    <button onClick={() => void send()} disabled={!draft.trim() || sending} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2b7843] text-white disabled:opacity-40">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
