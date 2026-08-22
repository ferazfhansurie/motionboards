"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  LockKeyhole,
  MessageCircle,
  PackageCheck,
  Play,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { launchWhatsAppEmbeddedSignup } from "@/lib/whatsapp-embedded-signup";

type Step = "shop" | "whatsapp" | "consent" | "message";

const setupSteps: { id: Step; title: string; detail: string; icon: typeof ShoppingBag }[] = [
  { id: "shop", title: "TikTok Shop", detail: "Authorize your seller account", icon: ShoppingBag },
  { id: "whatsapp", title: "WhatsApp Business", detail: "Connect your verified number", icon: MessageCircle },
  { id: "consent", title: "Customer consent", detail: "Choose how buyers opt in", icon: ShieldCheck },
  { id: "message", title: "Order message", detail: "Create your first template", icon: Sparkles },
];

const consentOptions = [
  { title: "Buyer starts the chat", detail: "Add a WhatsApp link or QR code to your order card and package.", best: "Lowest-risk option" },
  { title: "Post-purchase opt-in", detail: "Ask buyers to agree before receiving WhatsApp updates and save the record.", best: "Recommended for automated updates" },
];

export default function ShopAutomationPage() {
  const [step, setStep] = useState<Step>("shop");
  const [connected, setConnected] = useState<Partial<Record<Step, boolean>>>({});
  const [consent, setConsent] = useState(1);
  const [template, setTemplate] = useState("Hi {{first_name}}, thanks for your TikTok Shop order {{order_id}}. We’ll keep you updated here. Reply STOP to opt out.");
  const [running, setRunning] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [waConnecting, setWaConnecting] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);
  const [waStatus, setWaStatus] = useState<{ isCoexistence?: boolean; displayPhoneNumber?: string; verifiedName?: string } | null>(null);

  const activeIndex = setupSteps.findIndex((item) => item.id === step);
  const readyCount = Object.values(connected).filter(Boolean).length;
  const progress = useMemo(() => Math.round((readyCount / setupSteps.length) * 100), [readyCount]);

  const finishStep = () => {
    setConnected((current) => ({ ...current, [step]: true }));
    const next = setupSteps[activeIndex + 1];
    if (next) setStep(next.id);
  };

  // Pick up an existing WhatsApp connection so reloading this page (or
  // coming back after connecting elsewhere) doesn't ask to reconnect.
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/tickloop/workspace");
        if (!response.ok) return;
        const data = await response.json();
        type Connection = { provider: string; metadata?: { isCoexistence?: boolean; displayPhoneNumber?: string; verifiedName?: string } };
        const wa = (data.connections as Connection[] | undefined)?.find((c) => c.provider === "whatsapp");
        if (wa) {
          setConnected((current) => ({ ...current, whatsapp: true }));
          setWaStatus({ isCoexistence: wa.metadata?.isCoexistence, displayPhoneNumber: wa.metadata?.displayPhoneNumber, verifiedName: wa.metadata?.verifiedName });
        }
      } catch {
        /* not signed in yet — leave the step unconnected */
      }
    })();
  }, []);

  async function connectWhatsApp() {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    const configId = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID;
    if (!appId || !configId) { setWaError("WhatsApp isn't configured yet — set NEXT_PUBLIC_META_APP_ID and NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID."); return; }
    setWaConnecting(true); setWaError(null);
    try {
      const signup = await launchWhatsAppEmbeddedSignup({ appId, configId });
      const response = await fetch("/api/tickloop/whatsapp/connect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(signup) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Connection failed.");
      setWaStatus(data);
      finishStep();
    } catch (error) {
      setWaError((error as Error).message);
    } finally {
      setWaConnecting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8f8] text-[#17201d]">
      <header className="border-b border-[#17201d]/[0.08] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-black tracking-[-0.045em]">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#17201d] text-xs text-white">TL</span>
            <span>TickLoop</span>
            <span className="hidden rounded-full bg-[#eff7ef] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.09em] text-[#2b7843] sm:inline">Beta</span>
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowNotice(true)} className="hidden items-center gap-2 text-sm font-semibold text-[#56605c] hover:text-[#17201d] sm:flex"><CircleHelp className="h-4 w-4" /> Help</button>
            <Link href="/tickloop/finance" className="rounded-xl border border-[#dce4de] bg-white px-3.5 py-2.5 text-sm font-bold transition hover:border-[#2b7843]">Finance</Link>
            <button className="rounded-xl bg-[#17201d] px-3.5 py-2.5 text-sm font-bold text-white transition hover:bg-[#2b7843]">My automations</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <section className="mb-9 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#2b7843]">TikTok Shop × WhatsApp</p>
            <h1 className="max-w-2xl text-3xl font-black tracking-[-0.055em] sm:text-5xl">Turn every new order into a helpful conversation.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#65706b] sm:text-base">Connect your shop, choose a consent-first workflow, and send buyers the updates they expect—without manual copying.</p>
          </div>
          <div className="rounded-2xl border border-[#dce4de] bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="relative grid h-11 w-11 place-items-center rounded-full bg-[#eff7ef] text-sm font-black text-[#2b7843]" style={{ background: `conic-gradient(#2b7843 ${progress}%, #edf1ee 0)` }}>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-[10px]">{progress}%</span>
              </div>
              <div><p className="text-sm font-bold">Setup progress</p><p className="text-xs text-[#6e7773]">{readyCount} of 4 essentials ready</p></div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="rounded-3xl border border-[#dce4de] bg-white p-4 shadow-[0_12px_45px_rgba(18,42,28,0.05)] sm:p-7">
            <div className="mb-8 grid gap-2 sm:grid-cols-4">
              {setupSteps.map((item, index) => {
                const Icon = item.icon;
                const isActive = item.id === step;
                const isDone = connected[item.id];
                return <button key={item.id} onClick={() => setStep(item.id)} className={`flex min-w-0 items-center gap-3 rounded-2xl p-3 text-left transition ${isActive ? "bg-[#17201d] text-white" : "hover:bg-[#f4f7f5]"}`}>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${isActive ? "bg-white/15" : isDone ? "bg-[#dff3e4] text-[#2b7843]" : "bg-[#f0f3f1] text-[#78827d]"}`}>{isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span>
                  <span className="min-w-0"><span className="block truncate text-xs font-bold">{index + 1}. {item.title}</span><span className={`hidden text-[11px] sm:block ${isActive ? "text-white/60" : "text-[#7b8580]"}`}>{item.detail}</span></span>
                </button>;
              })}
            </div>

            {step === "shop" && <SetupPanel eyebrow="Step 1 of 4" title="Connect your TikTok Shop" description="Securely authorize your seller account. We use official TikTok Shop permissions to receive order events—never your Seller Center password.">
              <div className="rounded-2xl border border-[#e1e7e3] bg-[#fbfcfb] p-5">
                <div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black text-lg font-black text-white">♪</span><div><p className="font-bold">TikTok Shop Seller Center</p><p className="mt-1 text-sm leading-5 text-[#6c7671]">You’ll sign in with TikTok and approve access to orders, webhooks, and delivery status.</p></div></div>
                <button onClick={() => { window.location.assign("/api/tickloop/tiktok/connect"); }} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#17201d] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#2b7843]">Connect TikTok Shop <ExternalLink className="h-4 w-4" /></button>
              </div>
              <PrivacyNote>Buyer contact data can be masked by TikTok based on your market and shipping method. We only process fields returned by its official API.</PrivacyNote>
            </SetupPanel>}

            {step === "whatsapp" && <SetupPanel eyebrow="Step 2 of 4" title="Connect WhatsApp Business" description="Use your verified WhatsApp Business account to send official customer updates. Your personal WhatsApp stays separate.">
              <div className="grid gap-3 sm:grid-cols-2"><Feature title="Already use WhatsApp Business?" copy="Link your existing account through Meta’s secure Embedded Signup — you keep using the WhatsApp app on your phone, nothing there changes."/><Feature title="Need a business account?" copy="We’ll guide you through creating a business profile and verifying your number."/></div>
              {connected.whatsapp ? (
                <div className="mt-6 rounded-2xl border border-[#cfe8d6] bg-[#f1faf3] p-5">
                  <p className="text-sm font-bold text-[#2b7843]">Connected{waStatus?.displayPhoneNumber ? ` — ${waStatus.displayPhoneNumber}` : ""}</p>
                  <p className="mt-1 text-xs leading-5 text-[#41644b]">
                    {waStatus?.verifiedName ? `${waStatus.verifiedName} · ` : ""}
                    {waStatus?.isCoexistence ? "Coexistence — the WhatsApp app keeps working on this number, mirrored here." : "Connected as a Cloud API–only number."}
                  </p>
                  <Link href="/tickloop/whatsapp" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#2b7843] hover:underline">Open the inbox <ChevronRight className="h-3.5 w-3.5" /></Link>
                </div>
              ) : (
                <button onClick={connectWhatsApp} disabled={waConnecting} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#2b7843] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#17201d] disabled:cursor-not-allowed disabled:opacity-60">
                  {waConnecting && <Loader2 className="h-4 w-4 animate-spin" />} Connect WhatsApp Business <ArrowRight className="h-4 w-4" />
                </button>
              )}
              {waError && <p className="mt-3 text-xs font-semibold text-[#a34a35]">{waError}</p>}
            </SetupPanel>}

            {step === "consent" && <SetupPanel eyebrow="Step 3 of 4" title="Choose how buyers opt in" description="An order’s delivery phone number is not automatically permission for marketing. Choose a clear way customers can agree to WhatsApp updates.">
              <div className="grid gap-3">{consentOptions.map((option, index) => <button onClick={() => setConsent(index)} key={option.title} className={`rounded-2xl border p-5 text-left transition ${consent === index ? "border-[#2b7843] bg-[#f1faf3] ring-1 ring-[#2b7843]" : "border-[#e1e7e3] hover:border-[#b5c8ba]"}`}><div className="flex items-start gap-3"><span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${consent === index ? "border-[#2b7843] bg-[#2b7843] text-white" : "border-[#c8d0cb]"}`}>{consent === index && <Check className="h-3.5 w-3.5" />}</span><span><span className="font-bold">{option.title}</span><span className="mt-1 block text-sm leading-5 text-[#6c7671]">{option.detail}</span><span className="mt-3 inline-block rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#2b7843]">{option.best}</span></span></div></button>)}</div>
              <button onClick={finishStep} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#17201d] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#2b7843]">Save consent method <ArrowRight className="h-4 w-4" /></button>
            </SetupPanel>}

            {step === "message" && <SetupPanel eyebrow="Step 4 of 4" title="Create your first order update" description="Utility templates are for helpful, expected order updates. Customers can reply and choose to stop messages at any time.">
              <label className="block text-sm font-bold">New order confirmation</label>
              <textarea value={template} onChange={(event) => setTemplate(event.target.value)} rows={5} className="mt-2 w-full resize-none rounded-2xl border border-[#dbe3de] bg-[#fcfdfc] p-4 text-sm leading-6 outline-none transition focus:border-[#2b7843] focus:ring-2 focus:ring-[#2b7843]/15" />
              <p className="mt-2 text-xs text-[#78817d]">Variables: <code className="rounded bg-[#eff3f0] px-1.5 py-0.5">{"{{first_name}}"}</code> <code className="rounded bg-[#eff3f0] px-1.5 py-0.5">{"{{order_id}}"}</code></p>
              <button onClick={() => { setConnected((current) => ({ ...current, message: true })); setRunning(true); }} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#2b7843] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#17201d]"><Zap className="h-4 w-4" /> Activate automation</button>
            </SetupPanel>}
          </div>

          <aside className="space-y-4">
            <div className="overflow-hidden rounded-3xl bg-[#17201d] p-6 text-white shadow-[0_12px_40px_rgba(20,40,28,0.15)]">
              <div className="mb-8 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">Live automation</span><span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${running ? "bg-[#3ca35a] text-white" : "bg-white/10 text-white/60"}`}><span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-white" : "bg-white/40"}`}/>{running ? "Active" : "Not active"}</span></div>
              <div className="space-y-3">
                <FlowRow icon={ShoppingBag} title="New TikTok Shop order" sub="Order paid" complete={Boolean(connected.shop)} />
                <div className="ml-5 h-4 border-l border-dashed border-white/20" />
                <FlowRow icon={ShieldCheck} title="Consent check" sub={connected.consent ? "Opt-in saved" : "Required before sending"} complete={Boolean(connected.consent)} />
                <div className="ml-5 h-4 border-l border-dashed border-white/20" />
                <FlowRow icon={MessageCircle} title="WhatsApp template" sub={running ? "Send confirmation" : "Waiting for setup"} complete={running} />
              </div>
              <button disabled={!running} onClick={() => setShowNotice(true)} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#17201d] transition enabled:hover:bg-[#dff3e4] disabled:cursor-not-allowed disabled:opacity-40"><Play className="h-4 w-4 fill-current" /> Send test event</button>
            </div>
            <div className="rounded-3xl border border-[#dce4de] bg-white p-5"><div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#2b7843]"/><div><p className="text-sm font-bold">Built around permission</p><p className="mt-1 text-xs leading-5 text-[#6c7671]">Consent records, template approvals, message delivery, and STOP requests belong in every automation.</p></div></div><button onClick={() => setShowNotice(true)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#2b7843] hover:underline">Learn the basics <ChevronRight className="h-3.5 w-3.5" /></button></div>
          </aside>
        </section>
      </div>

      {showNotice && <div className="fixed inset-0 z-50 grid place-items-center bg-[#17201d]/40 p-5" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eff7ef] text-[#2b7843]"><ClipboardCheck className="h-5 w-5" /></div><button onClick={() => setShowNotice(false)} className="rounded-lg p-1 text-[#738079] hover:bg-black/5"><X className="h-5 w-5" /></button></div><h2 className="mt-5 text-xl font-black tracking-[-0.04em]">Ready for the real connection layer</h2><p className="mt-2 text-sm leading-6 text-[#68736d]">This dashboard is the guided product experience. The next build phase connects its buttons to TikTok OAuth, Meta Embedded Signup, persistent consent records, and verified webhooks.</p><button onClick={() => setShowNotice(false)} className="mt-6 w-full rounded-xl bg-[#17201d] py-3 text-sm font-bold text-white">Got it</button></div></div>}
    </main>
  );
}

function SetupPanel({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#2b7843]">{eyebrow}</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">{title}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#68736d]">{description}</p><div className="mt-7">{children}</div></div>;
}

function Feature({ title, copy }: { title: string; copy: string }) {
  return <div className="rounded-2xl border border-[#e1e7e3] p-5"><PackageCheck className="mb-5 h-5 w-5 text-[#2b7843]"/><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-5 text-[#6c7671]">{copy}</p></div>;
}

function PrivacyNote({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 flex gap-3 rounded-2xl border border-[#d9eadc] bg-[#f1faf3] p-4 text-xs leading-5 text-[#41644b]"><Bell className="mt-0.5 h-4 w-4 shrink-0" />{children}</div>;
}

function FlowRow({ icon: Icon, title, sub, complete }: { icon: typeof ShoppingBag; title: string; sub: string; complete: boolean }) {
  return <div className="flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${complete ? "bg-[#2b7843]" : "bg-white/10"}`}><Icon className="h-4 w-4" /></span><span><span className="block text-sm font-bold">{title}</span><span className="block text-xs text-white/50">{sub}</span></span></div>;
}
