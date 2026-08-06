"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw, Save, Settings2, TrendingUp } from "lucide-react";

type BundleLine = { skuKey: string; bundle: string; quantity: number; unitCost: number; bottles: number; totalCost: number; matched: boolean };
type LineGroup = "revenue" | "fee" | "tax" | "shipping" | "adjustment";
type SummaryLine = { key: string; label: string; group: LineGroup; amount: number };
type Summary = {
  currency: string;
  orderCount: number;
  totalSales: number;
  customerPayment: number;
  duitMasuk: number;
  revenueAmount: number;
  feeTaxAmount: number;
  shippingCostAmount: number;
  adjustmentAmount: number;
  reserveAmount: number;
  lines: SummaryLine[];
  settlementDrift: number;
  settledOrders: number;
  settledTransactions: number;
  kosProduk: number;
  adsCard: number;
  adsGmvPay: number;
  adsGmvPayIsOverride: boolean;
  adCredit: number;
  otherCost: number;
  whtRate: number;
  wht: number;
  nettProfit: number;
  profitPercentage: number;
  marginOnSettlement: number;
  totalQuantity: number;
  unitMe: number;
  bundles: BundleLine[];
  unmappedSkus: { skuKey: string; quantity: number }[];
  periods: string[];
  sync?: { orders?: number; settlements?: number; shopName?: string; errors?: string[] };
};
type ProductCost = { skuKey: string; bundle: string; unitCost: number; bottles: number; sortOrder: number };
type PeriodCost = { period: string; adsCard: number; adCredit: number; whtRate: number; otherCost: number; adsGmvPayOverride: number | null; notes: string | null };
type Sku = { skuKey: string; productName: string | null; skuName: string | null; quantity: number };

const monthStart = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

export default function FinanceDashboardPage() {
  const [from, setFrom] = useState(() => monthStart(new Date()));
  const [to, setTo] = useState(today);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCosts, setShowCosts] = useState(false);

  const load = useCallback(async (sync = false) => {
    if (sync) setSyncing(true); else setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ from, to, ...(sync ? { sync: "1" } : {}) });
      const response = await fetch(`/api/tickloop/finance/summary?${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.error || "Failed to load");
      setSummary(data as Summary);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [from, to]);

  useEffect(() => { void load(false); }, [load]);

  const money = useCallback((value: number) => `${summary?.currency === "MYR" || !summary ? "RM" : `${summary.currency} `}${value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, [summary]);

  const unsettled = summary ? summary.orderCount - summary.settledOrders : 0;

  return (
    <main className="min-h-screen bg-[#f7f8f8] text-[#17201d]">
      <header className="border-b border-[#17201d]/[0.08] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link href="/shop-automation" className="flex items-center gap-2.5 font-black tracking-[-0.045em]">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#17201d] text-xs text-white">TL</span>
            <span className="hidden sm:inline">TickLoop</span>
            <span className="rounded-full bg-[#eff7ef] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.09em] text-[#2b7843]">Finance</span>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCosts((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-[#dce4de] bg-white px-3 py-2.5 text-sm font-bold transition hover:border-[#2b7843]">
              <Settings2 className="h-4 w-4" /> <span className="hidden sm:inline">Cost setup</span>
            </button>
            <button onClick={() => void load(true)} disabled={syncing} className="inline-flex items-center gap-2 rounded-xl bg-[#17201d] px-3.5 py-2.5 text-sm font-bold text-white transition hover:bg-[#2b7843] disabled:opacity-50">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sync TikTok
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <section className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#2b7843]">Order created window</p>
            <h1 className="text-3xl font-black tracking-[-0.05em] sm:text-4xl">Financial dashboard</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#65706b]">Sales and settlement pull from TikTok Shop. Product cost and ad spend come from your cost setup.</p>
          </div>
          <div className="flex items-end gap-2">
            <label className="text-xs font-bold text-[#65706b]">From
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block rounded-xl border border-[#dce4de] bg-white px-3 py-2.5 text-sm font-semibold text-[#17201d] outline-none focus:border-[#2b7843]" />
            </label>
            <label className="text-xs font-bold text-[#65706b]">To
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block rounded-xl border border-[#dce4de] bg-white px-3 py-2.5 text-sm font-semibold text-[#17201d] outline-none focus:border-[#2b7843]" />
            </label>
          </div>
        </section>

        {error && <Notice tone="error">{error}</Notice>}
        {summary?.sync?.errors?.map((message) => <Notice key={message} tone="error">Sync: {message}</Notice>)}
        {summary && summary.unmappedSkus.length > 0 && (
          <Notice tone="warn">
            {summary.unmappedSkus.length} SKU{summary.unmappedSkus.length === 1 ? "" : "s"} have no product cost yet, so their cost counts as RM0.00 and Nett Profit is overstated.{" "}
            <button onClick={() => setShowCosts(true)} className="font-bold underline">Set their cost</button>
          </Notice>
        )}
        {summary && unsettled > 0 && (
          <Notice tone="warn">{unsettled} of {summary.orderCount} orders have no payout statement yet — TikTok settles after the return window, so Duit Masuk lags Total Sales.</Notice>
        )}

        {loading && !summary ? (
          <div className="grid h-64 place-items-center rounded-3xl border border-[#dce4de] bg-white"><Loader2 className="h-6 w-6 animate-spin text-[#2b7843]" /></div>
        ) : summary ? (
          <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
            <div className="space-y-6">
              <div className="overflow-hidden rounded-3xl border border-[#dce4de] bg-white shadow-[0_12px_45px_rgba(18,42,28,0.05)]">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#e8ece9] px-5 py-4 sm:px-7">
                  <h2 className="text-lg font-black tracking-[-0.03em]">Quantity &amp; product cost</h2>
                  <p className="text-xs font-semibold text-[#78827d]">{summary.orderCount} orders counted</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="bg-[#f1faf3] text-left text-xs font-black uppercase tracking-[0.09em] text-[#2b7843]">
                        <th className="px-5 py-3 sm:px-7">Bundle</th>
                        <th className="px-4 py-3 text-right">Quantity</th>
                        <th className="px-4 py-3 text-right">Kos Product</th>
                        <th className="px-4 py-3 text-right">Kos Produk Overall</th>
                        <th className="px-5 py-3 text-right sm:px-7">Unit ME</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.bundles.length === 0 && <tr><td colSpan={5} className="px-7 py-8 text-center text-sm text-[#78827d]">No orders in this window. Hit Sync TikTok.</td></tr>}
                      {summary.bundles.map((line) => (
                        <tr key={line.bundle} className="border-t border-[#eef1ef]">
                          <td className="px-5 py-3 font-bold sm:px-7">
                            {line.bundle}
                            {!line.matched && <span className="ml-2 rounded-full bg-[#fff4d6] px-2 py-0.5 text-[10px] font-black uppercase text-[#8a6516]">No cost set</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">{line.quantity.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-[#65706b]">{money(line.unitCost)}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(line.totalCost)}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-[#65706b] sm:px-7">{(line.quantity * line.bottles).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#17201d]/10 bg-[#fbfcfb] text-sm font-black">
                        <td className="px-5 py-3.5 sm:px-7">Total</td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{summary.totalQuantity.toLocaleString()}</td>
                        <td className="px-4 py-3.5" />
                        <td className="px-4 py-3.5 text-right tabular-nums">{money(summary.kosProduk)}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums sm:px-7">{summary.unitMe.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <SettlementBreakdown summary={summary} money={money} />

              {showCosts && <CostSetup onSaved={() => void load(false)} periods={summary.periods} money={money} syncedGmvPay={summary.adsGmvPay} />}
            </div>

            <aside className="space-y-4">
              <div className="overflow-hidden rounded-3xl border border-[#dce4de] bg-white shadow-[0_12px_45px_rgba(18,42,28,0.05)]">
                <div className="border-b border-[#e8ece9] bg-[#f1faf3] px-5 py-3.5">
                  <h2 className="text-sm font-black uppercase tracking-[0.1em] text-[#2b7843]">Profit &amp; loss</h2>
                </div>
                <dl className="divide-y divide-[#eef1ef]">
                  <PLRow label="Total Sales (Order Amount)" value={money(summary.totalSales)} source="tiktok" />
                  {summary.customerPayment > 0 && Math.abs(summary.customerPayment - summary.totalSales) > 0.01 && (
                    <PLRow label="Customer payment (settled)" value={money(summary.customerPayment)} source="tiktok" note="TikTok's finance view, net of refunds" />
                  )}
                  <PLRow label="Duit Masuk (Total settlement)" value={money(summary.duitMasuk)} source="tiktok" />
                  <PLRow label="Kos Produk" value={money(summary.kosProduk)} source="manual" negative />
                  <PLRow label="Kos Ads By Card" value={money(summary.adsCard)} source="manual" negative />
                  <PLRow
                    label="Kos Ads By GMV Pay"
                    value={money(summary.adsGmvPay)}
                    source={summary.adsGmvPayIsOverride ? "manual" : "tiktok"}
                    note={summary.adsGmvPayIsOverride ? "manual override — already inside settlement" : "GMV Max ad fee, already inside settlement"}
                  />
                  <PLRow label="Ad Credit" value={money(summary.adCredit)} source="manual" note="not netted off profit" />
                  {summary.otherCost !== 0 && <PLRow label="Other cost" value={money(summary.otherCost)} source="manual" negative />}
                  <PLRow label={`WHT ${(summary.whtRate * 100).toFixed(0)}% (To Pay)`} value={money(summary.wht)} source="calc" negative />
                </dl>
                <div className="border-t-2 border-[#17201d]/10 bg-[#17201d] px-5 py-5 text-white">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-black uppercase tracking-[0.12em] text-white/55">Nett Profit</span>
                    <span className={`text-2xl font-black tabular-nums tracking-[-0.04em] ${summary.nettProfit < 0 ? "text-[#ff9b8f]" : "text-[#7bdc9b]"}`}>{money(summary.nettProfit)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white/55"><TrendingUp className="h-3.5 w-3.5" /> Profit Percentage</span>
                    <span className="text-sm font-black tabular-nums">{(summary.profitPercentage * 100).toFixed(2)}%</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-white/40">Margin on money received</span>
                    <span className="text-xs font-bold tabular-nums text-white/70">{(summary.marginOnSettlement * 100).toFixed(2)}%</span>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-[#dce4de] bg-white p-5 text-xs leading-5 text-[#65706b]">
                <p className="mb-2 text-sm font-bold text-[#17201d]">How Nett Profit is calculated</p>
                <p>Duit Masuk − Kos Produk − Kos Ads By Card − WHT{summary.otherCost !== 0 ? " − Other cost" : ""}.</p>
                <p className="mt-2">GMV Pay ad spend is <strong>not</strong> subtracted again: TikTok charges it as a fee inside the settlement, so it is already absent from Duit Masuk. It still drives the WHT line, which you pay separately.</p>
                <p className="mt-2">Only <strong>Kos Produk</strong>, <strong>Kos Ads By Card</strong> and <strong>Ad Credit</strong> are typed in. Everything else comes from TikTok Shop.</p>
              </div>
            </aside>
          </div>
        ) : null}

        <Link href="/shop-automation" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#2b7843] hover:underline"><ArrowLeft className="h-4 w-4" /> Back to setup</Link>
      </div>
    </main>
  );
}

function PLRow({ label, value, source, negative, note }: { label: string; value: string; source: "tiktok" | "manual" | "calc"; negative?: boolean; note?: string }) {
  const badge = { tiktok: { text: "TikTok", className: "bg-[#eff7ef] text-[#2b7843]" }, manual: { text: "Manual", className: "bg-[#fff4d6] text-[#8a6516]" }, calc: { text: "Calc", className: "bg-[#eef1ef] text-[#65706b]" } }[source];
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <dt className="min-w-0 text-sm font-semibold">
        <span className="block truncate">{label}</span>
        {note && <span className="mt-0.5 block text-[11px] font-normal text-[#8a938e]">{note}</span>}
      </dt>
      <dd className="flex shrink-0 items-center gap-2.5">
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${badge.className}`}>{badge.text}</span>
        <span className="text-sm font-bold tabular-nums">{negative ? "−" : ""}{value}</span>
      </dd>
    </div>
  );
}

const GROUP_LABELS: Record<LineGroup, string> = { revenue: "Revenue", fee: "Fees & commissions", tax: "Tax", shipping: "Shipping", adjustment: "Adjustments" };

/**
 * TikTok's own settlement arithmetic, line by line. This is the part the spreadsheet
 * could only ever show as one lump: it makes visible whether margin is going to
 * commission, affiliate payouts, GMV Max ads, or shipping.
 */
function SettlementBreakdown({ summary, money }: { summary: Summary; money: (value: number) => string }) {
  const groups: LineGroup[] = ["revenue", "fee", "tax", "shipping", "adjustment"];
  const shareBase = Math.abs(summary.revenueAmount) || Math.abs(summary.totalSales) || 1;

  if (summary.lines.length === 0) {
    return (
      <div className="rounded-3xl border border-[#dce4de] bg-white p-6 text-sm text-[#78827d] shadow-[0_12px_45px_rgba(18,42,28,0.05)]">
        <h2 className="mb-1 text-lg font-black tracking-[-0.03em] text-[#17201d]">TikTok Shop settlement breakdown</h2>
        No settlement data for this window yet. Payouts appear after TikTok closes the statement, so hit Sync TikTok once orders have settled.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-[#dce4de] bg-white shadow-[0_12px_45px_rgba(18,42,28,0.05)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#e8ece9] px-5 py-4 sm:px-7">
        <div>
          <h2 className="text-lg font-black tracking-[-0.03em]">TikTok Shop settlement breakdown</h2>
          <p className="mt-1 text-xs text-[#78827d]">Every fee TikTok took, exactly as it reports them. Deductions shown negative.</p>
        </div>
        <p className="text-xs font-semibold text-[#78827d]">{summary.settledOrders} settled orders · {summary.settledTransactions} transactions</p>
      </div>

      {Math.abs(summary.settlementDrift) > 0.05 && (
        <div className="border-b border-[#f0dfb3] bg-[#fffbef] px-5 py-3 text-xs leading-5 text-[#75591b] sm:px-7">
          Revenue + fees + shipping + adjustments is off from the reported settlement by {money(summary.settlementDrift)}. TikTok may be sending a component this dashboard does not read yet — treat the breakdown as indicative and Duit Masuk as authoritative.
        </div>
      )}

      <div className="divide-y divide-[#eef1ef]">
        {groups.map((group) => {
          const lines = summary.lines.filter((line) => line.group === group);
          if (lines.length === 0) return null;
          const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
          return (
            <div key={group} className="px-5 py-4 sm:px-7">
              <div className="mb-2.5 flex items-baseline justify-between gap-3">
                <h3 className="text-[10px] font-black uppercase tracking-[0.11em] text-[#2b7843]">{GROUP_LABELS[group]}</h3>
                <span className="text-sm font-black tabular-nums">{money(subtotal)}</span>
              </div>
              <div className="space-y-1.5">
                {lines.map((line) => {
                  const share = Math.abs(line.amount) / shareBase;
                  return (
                    <div key={`${line.group}:${line.key}`} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm text-[#3f4a45]" title={line.key}>{line.label}</span>
                      <span className="hidden h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-[#eef1ef] sm:block">
                        <span className={`block h-full rounded-full ${line.amount < 0 ? "bg-[#d98a7a]" : "bg-[#8ec9a1]"}`} style={{ width: `${Math.min(100, share * 100).toFixed(1)}%` }} />
                      </span>
                      <span className="w-11 shrink-0 text-right text-[11px] tabular-nums text-[#9aa39e]">{(share * 100).toFixed(1)}%</span>
                      <span className={`w-24 shrink-0 text-right text-sm font-semibold tabular-nums ${line.amount < 0 ? "text-[#a34a35]" : ""}`}>{money(line.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-t-2 border-[#17201d]/10 bg-[#f1faf3] px-5 py-4 sm:px-7">
        <span className="text-sm font-black">Duit Masuk (Total settlement)</span>
        <span className="text-lg font-black tabular-nums">{money(summary.duitMasuk)}</span>
      </div>
      {summary.reserveAmount !== 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-[#eef1ef] px-5 py-3 text-xs sm:px-7">
          <span className="font-semibold text-[#65706b]">Held in reserve (not yet paid out)</span>
          <span className="font-bold tabular-nums">{money(summary.reserveAmount)}</span>
        </div>
      )}
    </div>
  );
}

function Notice({ tone, children }: { tone: "warn" | "error"; children: React.ReactNode }) {
  const className = tone === "error" ? "border-[#f3c9c2] bg-[#fdf3f1] text-[#8a3020]" : "border-[#f0dfb3] bg-[#fffbef] text-[#75591b]";
  return <div className={`mb-4 flex gap-3 rounded-2xl border p-4 text-xs leading-5 ${className}`}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div>{children}</div></div>;
}

/* ------------------------------------------------------------- cost setup */

function CostSetup({ periods, money, onSaved, syncedGmvPay }: { periods: string[]; money: (value: number) => string; onSaved: () => void; syncedGmvPay: number }) {
  const [products, setProducts] = useState<ProductCost[]>([]);
  const [periodCosts, setPeriodCosts] = useState<PeriodCost[]>([]);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [period, setPeriod] = useState(() => periods[periods.length - 1] || new Date().toISOString().slice(0, 7));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/tickloop/finance/costs");
      if (!response.ok) return;
      const data = await response.json();
      setSkus(data.skus as Sku[]);
      const existing = data.products as ProductCost[];
      const byKey = new Map(existing.map((product) => [product.skuKey, product]));
      // Every SKU seen in orders gets a row, pre-filled if we already priced it.
      setProducts((data.skus as Sku[]).map((sku, index) => byKey.get(sku.skuKey) || { skuKey: sku.skuKey, bundle: sku.skuName || sku.skuKey, unitCost: 0, bottles: 0, sortOrder: index }));
      setPeriodCosts(data.periods as PeriodCost[]);
    })();
  }, []);

  const active = useMemo<PeriodCost>(
    () => periodCosts.find((cost) => cost.period === period) || { period, adsCard: 0, adCredit: 0, whtRate: 0.1, otherCost: 0, adsGmvPayOverride: null, notes: null },
    [periodCosts, period],
  );

  const setActive = (patch: Partial<PeriodCost>) =>
    setPeriodCosts((current) => {
      const next = { ...active, ...patch, period };
      const others = current.filter((cost) => cost.period !== period);
      return [...others, next].sort((a, b) => b.period.localeCompare(a.period));
    });

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const response = await fetch("/api/tickloop/finance/costs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ products, period: active }),
      });
      if (response.ok) {
        setSaved(true);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  const periodOptions = [...new Set([...periods, ...periodCosts.map((cost) => cost.period), period])].sort().reverse();

  return (
    <div className="overflow-hidden rounded-3xl border border-[#dce4de] bg-white shadow-[0_12px_45px_rgba(18,42,28,0.05)]">
      <div className="border-b border-[#e8ece9] px-5 py-4 sm:px-7">
        <h2 className="text-lg font-black tracking-[-0.03em]">Cost setup</h2>
        <p className="mt-1 text-xs leading-5 text-[#78827d]">TikTok Shop does not expose what a bundle costs you, nor ad spend billed to your card. Enter both here once and the dashboard keeps using them.</p>
      </div>

      <div className="px-5 py-5 sm:px-7">
        <h3 className="mb-1 text-sm font-black">Product cost per SKU</h3>
        <p className="mb-4 text-xs leading-5 text-[#78827d]">SKUs are discovered from your synced orders. <strong>Bundle</strong> groups SKUs into one dashboard row. <strong>Bottles</strong> is how many bottles that SKU contains — set trial sachets to 0 so the Unit ME count stays true.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-[0.09em] text-[#78827d]">
                <th className="pb-2">SKU (from TikTok)</th>
                <th className="pb-2">Bundle name</th>
                <th className="pb-2 text-right">Cost each</th>
                <th className="pb-2 text-right">Bottles</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-xs text-[#78827d]">No SKUs yet — sync your orders first.</td></tr>}
              {products.map((product, index) => {
                const sku = skus.find((entry) => entry.skuKey === product.skuKey);
                return (
                  <tr key={product.skuKey} className="border-t border-[#eef1ef]">
                    <td className="max-w-[180px] py-2.5 pr-3">
                      <span className="block truncate font-semibold" title={product.skuKey}>{product.skuKey}</span>
                      <span className="block truncate text-[11px] text-[#8a938e]">{sku?.productName || ""} · {sku?.quantity ?? 0} sold</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <input value={product.bundle} onChange={(event) => setProducts((current) => current.map((entry, position) => (position === index ? { ...entry, bundle: event.target.value } : entry)))} className="w-full min-w-[110px] rounded-lg border border-[#dce4de] px-2.5 py-1.5 text-sm outline-none focus:border-[#2b7843]" />
                    </td>
                    <td className="py-2.5 pr-3">
                      <input type="number" step="0.01" min="0" value={product.unitCost} onChange={(event) => setProducts((current) => current.map((entry, position) => (position === index ? { ...entry, unitCost: Number(event.target.value) } : entry)))} className="w-24 rounded-lg border border-[#dce4de] px-2.5 py-1.5 text-right text-sm tabular-nums outline-none focus:border-[#2b7843]" />
                    </td>
                    <td className="py-2.5">
                      <input type="number" step="1" min="0" value={product.bottles} onChange={(event) => setProducts((current) => current.map((entry, position) => (position === index ? { ...entry, bottles: Number(event.target.value) } : entry)))} className="w-20 rounded-lg border border-[#dce4de] px-2.5 py-1.5 text-right text-sm tabular-nums outline-none focus:border-[#2b7843]" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-[#eef1ef] px-5 py-5 sm:px-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black">Ad spend &amp; tax</h3>
            <p className="mt-1 text-xs leading-5 text-[#78827d]">GMV Pay is synced from TikTok&apos;s GMV Max ad fee. Card-billed spend and ad credits live in TikTok Ads Manager, which a TikTok Shop authorization cannot reach — enter those per month.</p>
          </div>
          <select value={period} onChange={(event) => setPeriod(event.target.value)} className="rounded-xl border border-[#dce4de] bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#2b7843]">
            {periodOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CostField label="Kos Ads By Card" value={active.adsCard} onChange={(value) => setActive({ adsCard: value })} />
          <div className="rounded-2xl border border-[#e1e7e3] p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.09em] text-[#78827d]">Kos Ads By GMV Pay</span>
              <button
                onClick={() => setActive({ adsGmvPayOverride: active.adsGmvPayOverride === null ? Number(syncedGmvPay.toFixed(2)) : null })}
                className="text-[10px] font-bold text-[#2b7843] hover:underline"
              >
                {active.adsGmvPayOverride === null ? "Override" : "Use synced"}
              </button>
            </div>
            {active.adsGmvPayOverride === null ? (
              <>
                <p className="mt-1.5 text-lg font-black tabular-nums">{money(syncedGmvPay)}</p>
                <p className="text-[10px] font-semibold text-[#2b7843]">Synced from TikTok</p>
              </>
            ) : (
              <span className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-[#8a938e]">RM</span>
                <input type="number" step="0.01" value={active.adsGmvPayOverride} onChange={(event) => setActive({ adsGmvPayOverride: Number(event.target.value) })} className="w-full bg-transparent text-lg font-black tabular-nums outline-none" />
              </span>
            )}
          </div>
          <CostField label="Ad Credit" value={active.adCredit} onChange={(value) => setActive({ adCredit: value })} />
          <CostField label="Other cost" value={active.otherCost} onChange={(value) => setActive({ otherCost: value })} />
          <CostField label="WHT rate (%)" value={active.whtRate * 100} onChange={(value) => setActive({ whtRate: value / 100 })} suffix="%" />
          <div className="rounded-2xl border border-[#e1e7e3] bg-[#fbfcfb] p-3.5">
            <p className="text-[10px] font-black uppercase tracking-[0.09em] text-[#78827d]">WHT to pay</p>
            <p className="mt-1.5 text-lg font-black tabular-nums">{money(active.whtRate * (active.adsCard + (active.adsGmvPayOverride ?? syncedGmvPay)))}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-[#eef1ef] bg-[#fbfcfb] px-5 py-4 sm:px-7">
        <button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#2b7843] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#17201d] disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save cost setup
        </button>
        {saved && <span className="text-xs font-bold text-[#2b7843]">Saved — dashboard updated.</span>}
      </div>
    </div>
  );
}

function CostField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (value: number) => void; suffix?: string }) {
  return (
    <label className="block rounded-2xl border border-[#e1e7e3] p-3.5">
      <span className="text-[10px] font-black uppercase tracking-[0.09em] text-[#78827d]">{label}</span>
      <span className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-sm font-bold text-[#8a938e]">{suffix ? "" : "RM"}</span>
        <input type="number" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full bg-transparent text-lg font-black tabular-nums outline-none" />
        {suffix && <span className="text-sm font-bold text-[#8a938e]">{suffix}</span>}
      </span>
    </label>
  );
}
