"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  UserPlus,
  Trash2,
  Loader2,
  ExternalLink,
  ScanFace,
  Pencil,
  Clock,
  CheckCircle2,
  XCircle,
  Inbox,
  ImagePlus,
  FolderPlus,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { askConfirm, askPrompt, showToast, updateToast } from "@/lib/ui-store";

// Toasts once, on board load, when any of the user's requested characters have
// newly turned Ready since they last had the app open. No UI of its own — mount
// once near the canvas. Uses localStorage to remember which ready ids were
// already announced (keyed by absence, so a brand-new user isn't spammed).
export function AssetReadyNotifier() {
  useEffect(() => {
    let cancelled = false;
    fetch("/api/assets")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.assets) return;
        const ready = (d.assets as Asset[]).filter((a) => a.status === "completed" && a.assetId);
        const KEY = "mb_seen_ready_assets";
        const raw = localStorage.getItem(KEY);
        const firstRun = raw === null;
        let seen: string[] = [];
        try { seen = raw ? JSON.parse(raw) : []; } catch { seen = []; }
        const seenSet = new Set(seen);
        if (!firstRun) {
          for (const a of ready) {
            if (!seenSet.has(a.id)) {
              showToast(`"${a.name}" is ready — pick it from Cast on Seedance models.`, { kind: "success", durationMs: 6000 });
            }
          }
        }
        localStorage.setItem(KEY, JSON.stringify(ready.map((a) => a.id)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return null;
}

// Upload image files to /api/upload and return their file ids.
async function uploadImages(files: FileList | File[], max = 12): Promise<string[]> {
  const list = Array.from(files).slice(0, max);
  const ids: string[] = [];
  for (const file of list) {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "content-type": file.type || "application/octet-stream", "x-filename": file.name },
      body: file,
    }).then((r) => r.json()).catch(() => null);
    if (res?.url) {
      const id = (res.url as string).split("/").pop();
      if (id) ids.push(id);
    }
  }
  return ids;
}

type AssetStatus = "pending" | "completed" | "failed";

interface Asset {
  id: string;
  name: string;
  status: AssetStatus;
  assetId: string | null;
  assetType: string;
  thumbFileId: string | null;
  refPhotoIds: string[];
  note: string;
  adminNote: string;
  createdAt: string;
  requesterEmail?: string;
  requesterName?: string;
}

// Operators who see the fulfillment queue. Mirrors ADMIN_EMAILS in db.ts —
// server enforces the real check; this only decides whether to show the tab.
const ADMIN_EMAILS = ["hello@adleticagency.com", "faeez@fathopesenergy.com", "admin@adleticagency.com"];
const MODELARK_CONSOLE_URL = "https://console.byteplus.com/ark";
const MODELARK_GUIDE_URL = "https://docs.byteplus.com/en/docs/ModelArk/2315856";

function StatusBadge({ status, isDark }: { status: AssetStatus; isDark: boolean }) {
  const map = {
    pending: { label: "Pending", cls: "bg-amber-500/15 text-amber-500", Icon: Clock },
    completed: { label: "Ready", cls: "bg-emerald-500/15 text-emerald-500", Icon: CheckCircle2 },
    failed: { label: "Rejected", cls: "bg-red-500/15 text-red-500", Icon: XCircle },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${map.cls}`}>
      <map.Icon className="h-2.5 w-2.5" /> {map.label}
    </span>
  );
}

export function AssetsPanel() {
  const { isAssetsOpen, setAssetsOpen, theme } = useAppStore();
  const isDark = theme === "dark";

  const [mine, setMine] = useState<Asset[]>([]);
  const [queue, setQueue] = useState<Asset[]>([]);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [view, setView] = useState<"mine" | "queue">("mine");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const photoTargetRef = useRef<{ id: string; from: "mine" | "queue" } | null>(null);
  const addPhotosInputRef = useRef<HTMLInputElement>(null);

  // Append photos to an existing group asset (own asset, or any as operator).
  function triggerAddPhotos(id: string, from: "mine" | "queue") {
    photoTargetRef.current = { id, from };
    addPhotosInputRef.current?.click();
  }
  async function onAddPhotosPicked(files: FileList) {
    const target = photoTargetRef.current;
    if (!target || files.length === 0) return;
    setBusy(true);
    const toastId = showToast("Uploading photos…", { kind: "loading" });
    try {
      const ids = await uploadImages(files);
      if (ids.length === 0) { updateToast(toastId, { kind: "error", message: "Upload failed." }); return; }
      const res = await fetch(`/api/assets/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addPhotoIds: ids }),
      }).then((r) => r.json());
      if (res?.asset) {
        const apply = (prev: Asset[]) => prev.map((a) => (a.id === target.id ? { ...a, refPhotoIds: res.asset.refPhotoIds, thumbFileId: res.asset.thumbFileId } : a));
        setMine(apply);
        setQueue(apply);
        updateToast(toastId, { kind: "success", message: `Added ${ids.length} photo${ids.length === 1 ? "" : "s"}.` });
      } else {
        updateToast(toastId, { kind: "error", message: res?.error || "Failed." });
      }
    } finally {
      setBusy(false);
    }
  }

  async function loadMine() {
    setLoading(true);
    try {
      const res = await fetch("/api/assets").then((r) => r.json()).catch(() => ({ assets: [] }));
      setMine(res?.assets || []);
    } finally {
      setLoading(false);
    }
  }

  async function loadQueue() {
    setLoading(true);
    try {
      const res = await fetch("/api/assets/queue").then((r) => r.json()).catch(() => ({ assets: [] }));
      setQueue(res?.assets || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAssetsOpen) return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        const u = d?.user;
        setIsAdminUser(!!u && (u.role === "admin" || ADMIN_EMAILS.includes((u.email || "").toLowerCase())));
      })
      .catch(() => {});
    loadMine();
  }, [isAssetsOpen]);

  useEffect(() => {
    if (isAssetsOpen && view === "queue" && isAdminUser) loadQueue();
  }, [isAssetsOpen, view, isAdminUser]);

  if (!isAssetsOpen) return null;

  async function renameAsset(a: Asset) {
    const name = await askPrompt({ title: "Rename character", placeholder: "Name", defaultValue: a.name, confirmLabel: "Save" });
    if (!name || !name.trim() || name.trim() === a.name) return;
    await fetch(`/api/assets/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setMine((prev) => prev.map((x) => (x.id === a.id ? { ...x, name: name.trim() } : x)));
  }

  async function removeAsset(id: string, fromQueue = false) {
    const ok = await askConfirm({ title: "Delete request?", message: "This removes it permanently.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMine((prev) => prev.filter((a) => a.id !== id));
        if (fromQueue) setQueue((prev) => prev.filter((a) => a.id !== id));
      }
    } finally {
      setBusy(false);
    }
  }

  // Operator actions -------------------------------------------------------
  async function markReady(a: Asset, assetId: string) {
    if (!assetId.trim()) { showToast("Paste the asset_id first.", { kind: "error" }); return; }
    setBusy(true);
    const toastId = showToast("Marking ready…", { kind: "loading" });
    try {
      const res = await fetch(`/api/assets/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", assetId: assetId.trim() }),
      });
      if (res.ok) {
        setQueue((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: "completed", assetId: assetId.trim() } : x)));
        updateToast(toastId, { kind: "success", message: `${a.name} is ready.` });
      } else {
        const d = await res.json().catch(() => ({}));
        updateToast(toastId, { kind: "error", message: d?.error || "Failed." });
      }
    } finally {
      setBusy(false);
    }
  }

  async function markFailed(a: Asset) {
    const reason = await askPrompt({ title: "Reject request", description: "Reason shown to the requester (optional).", placeholder: "e.g. photos too blurry — resubmit clear front-facing shots", defaultValue: "", confirmLabel: "Reject" });
    if (reason === null) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/assets/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "failed", adminNote: reason || "" }),
      });
      if (res.ok) setQueue((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: "failed", adminNote: reason || "" } : x)));
    } finally {
      setBusy(false);
    }
  }

  const panel = isDark ? "bg-[#0d1117] border-gray-800" : "bg-white border-gray-200";
  const headerBorder = isDark ? "border-gray-800" : "border-gray-100";
  const text = isDark ? "text-white" : "text-[#0d1117]";
  const sub = isDark ? "text-gray-500" : "text-gray-400";
  const hover = isDark ? "hover:bg-white/5" : "hover:bg-gray-50";
  const pendingCount = queue.filter((q) => q.status === "pending").length;

  return (
    <div className="fixed right-0 top-0 z-[48] flex h-[100dvh] w-full sm:w-[380px] pointer-events-auto">
      <div
        className={`flex h-full w-full flex-col border-l ${panel}`}
        style={{ boxShadow: isDark ? "-20px 0 40px rgba(0,0,0,0.4)" : "-20px 0 40px rgba(0,0,0,0.06)" }}
      >
        <div className={`flex items-center justify-between px-4 py-3 border-b ${headerBorder}`}>
          <h3 className={`flex items-center gap-2 text-sm font-bold ${text}`}>
            <ScanFace className="h-4 w-4 text-[#f26522]" /> My Assets
          </h3>
          <button className={`rounded-lg p-1.5 ${sub} ${hover}`} onClick={() => setAssetsOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {isAdminUser && (
          <div className={`flex gap-1 border-b px-2 py-1.5 ${headerBorder}`}>
            {(["mine", "queue"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  view === v ? "bg-[#f26522] text-white" : isDark ? "text-gray-400 hover:bg-white/5" : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {v === "mine" ? "My requests" : (<><Inbox className="h-3.5 w-3.5" /> Queue{pendingCount > 0 ? ` (${pendingCount})` : ""}</>)}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {view === "mine" ? (
            <>
              <button
                onClick={() => setWizardOpen(true)}
                disabled={busy}
                className={`flex w-full items-center gap-2 rounded-xl border border-dashed px-3 py-3 text-[12px] font-semibold transition-colors ${isDark ? "border-gray-800 text-gray-300 hover:border-[#f26522] hover:text-[#f26522]" : "border-gray-200 text-gray-600 hover:border-[#f26522] hover:text-[#f26522]"}`}
              >
                <UserPlus className="h-4 w-4" /> Request a character
              </button>
              <div className="mt-2 space-y-1.5">
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className={`h-4 w-4 animate-spin ${sub}`} /></div>
                ) : mine.length === 0 ? (
                  <p className={`px-2 py-6 text-center text-[11px] leading-relaxed ${sub}`}>
                    No characters yet. Request one — send face photos and we&apos;ll verify the person with ByteDance,
                    then it turns <span className="font-semibold text-emerald-500">Ready</span> for use in any Seedance video.
                  </p>
                ) : (
                  mine.map((a) => (
                    <div key={a.id} className={`group flex items-start gap-2.5 rounded-xl px-2.5 py-2 ${hover}`}>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f26522]/10 text-[#f26522]">
                        {a.thumbFileId ? <img src={`/api/files/${a.thumbFileId}`} alt="" className="h-full w-full object-cover" /> : <ScanFace className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`truncate text-[12px] font-semibold ${text}`}>{a.name}</p>
                          <StatusBadge status={a.status} isDark={isDark} />
                        </div>
                        {a.status === "completed" && (
                          <p className="mt-0.5 text-[10px] text-emerald-500">Available in the Cast picker on Seedance models.</p>
                        )}
                        {a.status === "pending" && <p className={`mt-0.5 text-[10px] ${sub}`}>Awaiting verification by our team.</p>}
                        {a.status === "failed" && (
                          <p className="mt-0.5 text-[10px] text-red-400">{a.adminNote || "Rejected. Please resubmit clearer photos."}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                        <button onClick={() => triggerAddPhotos(a.id, "mine")} disabled={busy} title="Add photos" className={`rounded p-1 ${sub} hover:text-[#f26522]`}><ImagePlus className="h-3.5 w-3.5" /></button>
                        <button onClick={() => renameAsset(a)} title="Rename" className={`rounded p-1 ${sub} hover:text-[#f26522]`}><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => removeAsset(a.id)} title="Delete" className={`rounded p-1 ${sub} hover:text-red-500`}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setAddGroupOpen(true)}
                disabled={busy}
                className={`mb-2 flex w-full items-center gap-2 rounded-xl border border-dashed px-3 py-3 text-[12px] font-semibold transition-colors ${isDark ? "border-gray-800 text-gray-300 hover:border-[#f26522] hover:text-[#f26522]" : "border-gray-200 text-gray-600 hover:border-[#f26522] hover:text-[#f26522]"}`}
              >
                <FolderPlus className="h-4 w-4" /> Add existing group
              </button>
              <QueueView
                queue={queue}
                loading={loading}
                busy={busy}
                isDark={isDark}
                onMarkReady={markReady}
                onMarkFailed={markFailed}
                onDelete={(id) => removeAsset(id, true)}
                onAddPhotos={(id) => triggerAddPhotos(id, "queue")}
              />
            </>
          )}
        </div>

        <div className={`border-t px-3 py-2 text-[9px] text-center ${headerBorder} ${sub}`}>
          Faces are verified once on ByteDance and reused via asset:// in Seedance.
        </div>
      </div>

      {/* Shared hidden input for "add photos" on any asset row. */}
      <input
        ref={addPhotosInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files) onAddPhotosPicked(e.target.files); e.target.value = ""; }}
      />

      {wizardOpen && (
        <RequestWizard
          isDark={isDark}
          onClose={() => setWizardOpen(false)}
          onCreated={(asset) => { setMine((prev) => [asset, ...prev]); setWizardOpen(false); }}
        />
      )}

      {addGroupOpen && (
        <AddGroupModal
          isDark={isDark}
          onClose={() => setAddGroupOpen(false)}
          onCreated={(asset) => {
            setQueue((prev) => [asset, ...prev]);
            setAddGroupOpen(false);
          }}
        />
      )}
    </div>
  );
}

function QueueView({
  queue, loading, busy, isDark, onMarkReady, onMarkFailed, onDelete, onAddPhotos,
}: {
  queue: Asset[];
  loading: boolean;
  busy: boolean;
  isDark: boolean;
  onMarkReady: (a: Asset, assetId: string) => void;
  onMarkFailed: (a: Asset) => void;
  onDelete: (id: string) => void;
  onAddPhotos: (id: string) => void;
}) {
  const text = isDark ? "text-white" : "text-[#0d1117]";
  const sub = isDark ? "text-gray-500" : "text-gray-400";
  const card = isDark ? "border-gray-800 bg-[#161b22]" : "border-gray-200 bg-gray-50";
  const inputCls = `w-full rounded-lg border px-2.5 py-1.5 text-[11px] font-mono outline-none ${isDark ? "bg-[#0d1117] border-gray-800 text-white placeholder:text-gray-600 focus:border-[#f26522]" : "bg-white border-gray-200 text-[#0d1117] placeholder:text-gray-400 focus:border-[#f26522]"}`;

  if (loading) return <div className="flex justify-center py-8"><Loader2 className={`h-4 w-4 animate-spin ${sub}`} /></div>;
  if (queue.length === 0) return <p className={`px-2 py-8 text-center text-[11px] ${sub}`}>No requests yet.</p>;

  return (
    <div className="space-y-2">
      {queue.map((a) => (
        <QueueItem
          key={a.id}
          a={a}
          busy={busy}
          text={text}
          sub={sub}
          card={card}
          inputCls={inputCls}
          onMarkReady={onMarkReady}
          onMarkFailed={onMarkFailed}
          onDelete={onDelete}
          onAddPhotos={onAddPhotos}
          isDark={isDark}
        />
      ))}
    </div>
  );
}

function QueueItem({
  a, busy, text, sub, card, inputCls, onMarkReady, onMarkFailed, onDelete, onAddPhotos, isDark,
}: {
  a: Asset;
  busy: boolean;
  text: string;
  sub: string;
  card: string;
  inputCls: string;
  onMarkReady: (a: Asset, assetId: string) => void;
  onMarkFailed: (a: Asset) => void;
  onDelete: (id: string) => void;
  onAddPhotos: (id: string) => void;
  isDark: boolean;
}) {
  const [assetId, setAssetId] = useState(a.assetId || "");
  return (
    <div className={`rounded-xl border p-2.5 ${card}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className={`truncate text-[12px] font-bold ${text}`}>{a.name}</p>
        <StatusBadge status={a.status} isDark={isDark} />
      </div>
      <p className={`mb-2 truncate text-[10px] ${sub}`}>{a.requesterEmail || a.requesterName || "Unknown requester"}</p>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {a.refPhotoIds.map((fid) => (
          <a key={fid} href={`/api/files/${fid}`} target="_blank" rel="noopener noreferrer" title="Open full size">
            <img src={`/api/files/${fid}`} alt="" className="h-14 w-14 rounded-lg object-cover" />
          </a>
        ))}
        <button
          onClick={() => onAddPhotos(a.id)}
          disabled={busy}
          title="Add photos to this group"
          className={`flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed text-[8px] font-semibold ${isDark ? "border-gray-700 text-gray-500 hover:border-[#f26522] hover:text-[#f26522]" : "border-gray-300 text-gray-400 hover:border-[#f26522] hover:text-[#f26522]"}`}
        >
          <ImagePlus className="h-4 w-4" /> Add
        </button>
      </div>
      {a.note && <p className={`mb-2 text-[10px] italic ${sub}`}>&ldquo;{a.note}&rdquo;</p>}

      {a.status === "completed" ? (
        <p className="text-[10px] text-emerald-500 break-all">asset://{a.assetId}</p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <a
              href={MODELARK_CONSOLE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold ${isDark ? "border-gray-800 text-gray-300 hover:bg-white/5" : "border-gray-200 text-gray-600 hover:bg-white"}`}
            >
              <ExternalLink className="h-3 w-3" /> Verify on ModelArk
            </a>
            <a href={MODELARK_GUIDE_URL} target="_blank" rel="noopener noreferrer" className={`text-[10px] font-semibold ${sub} hover:text-[#f26522]`}>Guide</a>
          </div>
          <input className={inputCls} value={assetId} onChange={(e) => setAssetId(e.target.value)} placeholder="paste asset_id after verifying" />
          <div className="flex gap-1.5">
            <button
              onClick={() => onMarkReady(a, assetId)}
              disabled={busy || !assetId.trim()}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-semibold text-white hover:opacity-90 disabled:opacity-40"
            >
              <CheckCircle2 className="h-3 w-3" /> Mark ready
            </button>
            <button
              onClick={() => onMarkFailed(a)}
              disabled={busy}
              className="flex items-center justify-center gap-1 rounded-lg border border-red-500/40 px-2 py-1.5 text-[10px] font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-40"
            >
              Reject
            </button>
            <button onClick={() => onDelete(a.id)} disabled={busy} className={`rounded-lg p-1.5 ${sub} hover:text-red-500`}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// Operator: import an already-verified ByteDance group into a target account.
function AddGroupModal({
  isDark, onClose, onCreated,
}: {
  isDark: boolean;
  onClose: () => void;
  onCreated: (asset: Asset) => void;
}) {
  const [email, setEmail] = useState("admin@adleticagency.com");
  const [name, setName] = useState("");
  const [assetId, setAssetId] = useState("");
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const card = isDark ? "bg-[#0d1117] border-gray-800" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-[#0d1117]";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const inputCls = `w-full rounded-lg border px-3 py-2 text-[12px] outline-none ${isDark ? "bg-[#161b22] border-gray-800 text-white placeholder:text-gray-600 focus:border-[#f26522]" : "bg-white border-gray-200 text-[#0d1117] placeholder:text-gray-400 focus:border-[#f26522]"}`;

  async function pickPhotos(files: FileList) {
    setUploading(true);
    try {
      const ids = await uploadImages(files, 12 - photoIds.length);
      setPhotoIds((prev) => [...prev, ...ids].slice(0, 12));
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!email.trim()) { showToast("Enter the account email to link to.", { kind: "error" }); return; }
    if (!assetId.trim()) { showToast("Paste the asset_id.", { kind: "error" }); return; }
    setSaving(true);
    const toastId = showToast("Adding group…", { kind: "loading" });
    try {
      const res = await fetch("/api/assets/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || "Untitled", assetId: assetId.trim(), refPhotoIds: photoIds }),
      }).then((r) => r.json());
      if (res?.asset) {
        updateToast(toastId, { kind: "success", message: `Group linked to ${email.trim()}.` });
        onCreated(res.asset);
      } else {
        updateToast(toastId, { kind: "error", message: res?.error || "Could not add." });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className={`w-full max-w-[420px] rounded-2xl border p-5 ${card}`} onClick={(e) => e.stopPropagation()} style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className={`flex items-center gap-2 text-[15px] font-bold ${text}`}><FolderPlus className="h-4 w-4 text-[#f26522]" /> Add existing group</h3>
          <button className={`rounded-lg p-1 ${sub} hover:opacity-70`} onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <p className={`mb-4 text-[12px] leading-relaxed ${sub}`}>
          Import a group you already verified on the ByteDance console. It&apos;s added as <span className="font-semibold text-emerald-500">Ready</span> and
          linked to the account below, so it shows in that account&apos;s Cast picker.
        </p>
        <div className="space-y-3">
          <div>
            <label className={`mb-1 block text-[11px] font-semibold ${sub}`}>Link to account (email)</label>
            <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@adleticagency.com" />
          </div>
          <div>
            <label className={`mb-1 block text-[11px] font-semibold ${sub}`}>Character name</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aisyatun" />
          </div>
          <div>
            <label className={`mb-1 block text-[11px] font-semibold ${sub}`}>ByteDance asset_id</label>
            <input className={`${inputCls} font-mono`} value={assetId} onChange={(e) => setAssetId(e.target.value)} placeholder="asset-2026..." />
          </div>
          <div>
            <label className={`mb-1 block text-[11px] font-semibold ${sub}`}>Reference photos (optional)</label>
            {photoIds.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {photoIds.map((id) => (
                  <div key={id} className="relative">
                    <img src={`/api/files/${id}`} alt="" className="h-14 w-14 rounded-lg object-cover" />
                    <button onClick={() => setPhotoIds((prev) => prev.filter((x) => x !== id))} className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white"><X className="h-2.5 w-2.5" /></button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || photoIds.length >= 12}
              className={`flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-[11px] font-semibold ${isDark ? "border-gray-800 text-gray-400 hover:border-[#f26522]" : "border-gray-200 text-gray-500 hover:border-[#f26522]"} disabled:opacity-50`}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              {photoIds.length > 0 ? "Add more photos" : "Upload photos"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) pickPhotos(e.target.files); e.target.value = ""; }} />
          </div>
          <button
            onClick={submit}
            disabled={saving || !email.trim() || !assetId.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#f26522] px-4 py-2.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add group"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RequestWizard({
  isDark, onClose, onCreated,
}: {
  isDark: boolean;
  onClose: () => void;
  onCreated: (asset: Asset) => void;
}) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const card = isDark ? "bg-[#0d1117] border-gray-800" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-[#0d1117]";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const inputCls = `w-full rounded-lg border px-3 py-2 text-[12px] outline-none ${isDark ? "bg-[#161b22] border-gray-800 text-white placeholder:text-gray-600 focus:border-[#f26522]" : "bg-white border-gray-200 text-[#0d1117] placeholder:text-gray-400 focus:border-[#f26522]"}`;

  async function uploadPhotos(files: FileList | File[]) {
    const list = Array.from(files).slice(0, 12 - photoIds.length);
    if (list.length === 0) return;
    setUploading(true);
    try {
      for (const file of list) {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "content-type": file.type || "application/octet-stream", "x-filename": file.name },
          body: file,
        }).then((r) => r.json()).catch(() => null);
        if (res?.url) {
          const id = (res.url as string).split("/").pop();
          if (id) setPhotoIds((prev) => [...prev, id]);
        }
      }
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (photoIds.length === 0) { showToast("Add at least one face photo.", { kind: "error" }); return; }
    setSaving(true);
    const toastId = showToast("Submitting request…", { kind: "loading" });
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Untitled", refPhotoIds: photoIds, note: note.trim(), thumbFileId: photoIds[0] }),
      }).then((r) => r.json());
      if (res?.asset) {
        updateToast(toastId, { kind: "success", message: "Request submitted." });
        onCreated(res.asset);
      } else {
        updateToast(toastId, { kind: "error", message: res?.error || "Could not submit." });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className={`w-full max-w-[420px] rounded-2xl border p-5 ${card}`} onClick={(e) => e.stopPropagation()} style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className={`flex items-center gap-2 text-[15px] font-bold ${text}`}><UserPlus className="h-4 w-4 text-[#f26522]" /> Request a character</h3>
          <button className={`rounded-lg p-1 ${sub} hover:opacity-70`} onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        <p className={`mb-4 text-[12px] leading-relaxed ${sub}`}>
          Send us clear, front-facing photos of the person. Our team runs the <span className="font-semibold text-[#f26522]">one-time
          ByteDance face verification</span> (it protects their portrait rights), then enables the character on your
          account — it&apos;ll turn <span className="font-semibold text-emerald-500">Ready</span> here and appear in the Cast picker.
        </p>

        <div className="space-y-3">
          <div>
            <label className={`mb-1 block text-[11px] font-semibold ${sub}`}>Character name</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mijan" />
          </div>

          <div>
            <label className={`mb-1 block text-[11px] font-semibold ${sub}`}>Face photos (up to 12)</label>
            {photoIds.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {photoIds.map((id) => (
                  <div key={id} className="relative">
                    <img src={`/api/files/${id}`} alt="" className="h-14 w-14 rounded-lg object-cover" />
                    <button
                      onClick={() => setPhotoIds((prev) => prev.filter((x) => x !== id))}
                      className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || photoIds.length >= 12}
              className={`flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-[11px] font-semibold ${isDark ? "border-gray-800 text-gray-400 hover:border-[#f26522]" : "border-gray-200 text-gray-500 hover:border-[#f26522]"} disabled:opacity-50`}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              {photoIds.length > 0 ? "Add more photos" : "Upload face photos"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) uploadPhotos(e.target.files); e.target.value = ""; }} />
          </div>

          <div>
            <label className={`mb-1 block text-[11px] font-semibold ${sub}`}>Note to our team (optional)</label>
            <textarea className={`${inputCls} resize-none`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything we should know" />
          </div>

          <button
            onClick={submit}
            disabled={saving || photoIds.length === 0}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#f26522] px-4 py-2.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Submit request"}
          </button>
        </div>
      </div>
    </div>
  );
}
