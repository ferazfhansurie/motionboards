"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, Eye, EyeOff, Loader2, CheckCircle, ExternalLink, ArrowLeft, Trash2, Copy, Plus, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { imgCacheClear } from "@/lib/image-cache";

interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [replicateApiKey, setReplicateApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [fishApiKey, setFishApiKey] = useState("");
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showReplicateKey, setShowReplicateKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showFishKey, setShowFishKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("ai-generation");
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  // API key management
  const [mbApiKeys, setMbApiKeys] = useState<ApiKeySummary[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [justCreatedFullKey, setJustCreatedFullKey] = useState<string | null>(null);
  const [copiedJustCreated, setCopiedJustCreated] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const refreshApiKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/api-keys");
      if (!res.ok) return;
      const data = await res.json();
      setMbApiKeys(Array.isArray(data?.keys) ? data.keys : []);
    } catch (err) {
      console.error("Failed to load API keys:", err);
    }
  }, []);

  useEffect(() => {
    if (activeSection === "api-keys") {
      void refreshApiKeys();
    }
  }, [activeSection, refreshApiKeys]);

  const handleCreateApiKey = async () => {
    setCreatingKey(true);
    setJustCreatedFullKey(null);
    setCopiedJustCreated(false);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Failed to create API key");
        return;
      }
      setJustCreatedFullKey(data.fullKey);
      setNewKeyName("");
      await refreshApiKeys();
    } finally {
      setCreatingKey(false);
    }
  };

  const handleCopyFullKey = async () => {
    if (!justCreatedFullKey) return;
    try {
      await navigator.clipboard.writeText(justCreatedFullKey);
      setCopiedJustCreated(true);
      setTimeout(() => setCopiedJustCreated(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    if (!confirm("Revoke this key? Anything using it will stop working immediately.")) return;
    setRevokingId(id);
    try {
      await fetch(`/api/api-keys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await refreshApiKeys();
    } finally {
      setRevokingId(null);
    }
  };

  const handleClearCache = async () => {
    setClearing(true);
    setCleared(false);
    try {
      // IndexedDB image cache (pasted / dropped image bytes)
      await imgCacheClear();
      // HTTP CacheStorage (service-worker / fetch cache, if any exists)
      if (typeof window !== "undefined" && "caches" in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        } catch {}
      }
      setCleared(true);
      setTimeout(() => setCleared(false), 3000);
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setOpenaiApiKey(data.openaiApiKey || "");
        setReplicateApiKey(data.replicateApiKey || "");
        setGeminiApiKey(data.geminiApiKey || "");
        setFishApiKey(data.fishApiKey || "");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openaiApiKey, replicateApiKey, geminiApiKey, fishApiKey }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#08131f]">
        <Loader2 className="h-8 w-8 animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0d1f30] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-base font-semibold text-white">Settings</h2>
          <button
            className="rounded-lg p-1 text-white/40 hover:bg-white/5 hover:text-white"
            onClick={() => router.push("/generate")}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="flex" style={{ minHeight: "350px" }}>
          {/* Sidebar */}
          <div className="w-44 shrink-0 border-r border-white/5 py-3 px-2">
            <button
              className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${
                activeSection === "ai-generation"
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:bg-white/5 hover:text-white/60"
              }`}
              onClick={() => setActiveSection("ai-generation")}
            >
              AI Generation
            </button>
            <button
              className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${
                activeSection === "api-keys"
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:bg-white/5 hover:text-white/60"
              }`}
              onClick={() => setActiveSection("api-keys")}
            >
              API Keys
            </button>
            <button
              className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${
                activeSection === "general"
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:bg-white/5 hover:text-white/60"
              }`}
              onClick={() => setActiveSection("general")}
            >
              General
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {activeSection === "ai-generation" && (
              <>
                {/* OpenAI */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="openai-key" className="text-white/80">
                      OpenAI API Key
                    </Label>
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-[#f26522] hover:underline"
                    >
                      Get key <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="relative mt-1.5">
                    <Input
                      id="openai-key"
                      type={showOpenaiKey ? "text" : "password"}
                      value={openaiApiKey}
                      onChange={(e) => setOpenaiApiKey(e.target.value)}
                      placeholder="Enter your OpenAI API key"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                      onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    >
                      {showOpenaiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-white/30">
                    Access Sora 2 Pro video generation
                  </p>
                </div>

                <Separator className="bg-white/5" />

                {/* Google Gemini */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gemini-key" className="text-white/80">
                      Google Gemini API Key
                    </Label>
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-[#f26522] hover:underline"
                    >
                      Get key <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="relative mt-1.5">
                    <Input
                      id="gemini-key"
                      type={showGeminiKey ? "text" : "password"}
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      placeholder="Enter your Google Gemini API key"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                    >
                      {showGeminiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-white/30">
                    Direct Google API for Nano Banana 2 (~$0.02/image)
                  </p>
                </div>

                <Separator className="bg-white/5" />

                {/* Replicate */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="replicate-key" className="text-white/80">
                      Replicate API Token
                    </Label>
                    <a
                      href="https://replicate.com/account/api-tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-[#f26522] hover:underline"
                    >
                      Get token <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="relative mt-1.5">
                    <Input
                      id="replicate-key"
                      type={showReplicateKey ? "text" : "password"}
                      value={replicateApiKey}
                      onChange={(e) => setReplicateApiKey(e.target.value)}
                      placeholder="Enter your Replicate API token"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                      onClick={() => setShowReplicateKey(!showReplicateKey)}
                    >
                      {showReplicateKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-white/30">
                    Access additional models via Replicate
                  </p>
                </div>

                <Separator className="bg-white/5" />

                {/* Fish Audio */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="fish-key" className="text-white/80">
                      Fish Audio API Key
                    </Label>
                    <a
                      href="https://fish.audio/account/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-[#f26522] hover:underline"
                    >
                      Get key <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="relative mt-1.5">
                    <Input
                      id="fish-key"
                      type={showFishKey ? "text" : "password"}
                      value={fishApiKey}
                      onChange={(e) => setFishApiKey(e.target.value)}
                      placeholder="Enter your Fish Audio API key"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                      onClick={() => setShowFishKey(!showFishKey)}
                    >
                      {showFishKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-white/30">
                    Fast voice cloning TTS via Fish Audio
                  </p>
                </div>

                <Button
                  className="w-full bg-[#f26522] text-white hover:bg-[#d9541a]"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : saved ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save API Keys
                    </>
                  )}
                </Button>
              </>
            )}

            {activeSection === "api-keys" && (
              <div className="space-y-5">
                <div>
                  <Label className="text-white">Personal API keys</Label>
                  <p className="text-xs text-white/40 mt-1">
                    Use these to call the MotionBoards API from MCP servers, scripts, or automations. Pass as <code className="rounded bg-white/5 px-1 py-0.5 text-[11px] text-white/60">Authorization: Bearer mb_…</code> on any request. Your account&apos;s credit balance funds every call. Revoke any key at any time.
                  </p>
                </div>

                {/* Just-created key reveal */}
                {justCreatedFullKey && (
                  <div className="rounded-lg border border-green-400/30 bg-green-400/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-green-300">Your new API key — copy it now</p>
                        <p className="mt-1 text-[11px] text-white/50">
                          You won&apos;t be able to see it again. If you lose it, revoke this key and create a new one.
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <code className="flex-1 truncate rounded bg-black/40 px-2 py-1.5 font-mono text-xs text-white">
                            {justCreatedFullKey}
                          </code>
                          <button
                            onClick={handleCopyFullKey}
                            className="flex items-center gap-1 rounded bg-white/10 px-2 py-1.5 text-xs text-white hover:bg-white/20"
                          >
                            {copiedJustCreated ? <CheckCircle className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                            <span>{copiedJustCreated ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Create new key */}
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                  <Label className="text-white text-xs">Create new key</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Name (e.g. claude-code laptop, n8n production)"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      maxLength={64}
                      className="flex-1 border-white/10 bg-black/30 text-white placeholder:text-white/30"
                    />
                    <Button
                      onClick={handleCreateApiKey}
                      disabled={creatingKey}
                      className="bg-[#f26522] text-white hover:bg-[#d9541a]"
                    >
                      {creatingKey ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="mr-1 h-4 w-4" />
                          Create
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* List existing keys */}
                <div className="space-y-2">
                  <Label className="text-white text-xs">Active keys</Label>
                  {mbApiKeys.length === 0 ? (
                    <p className="text-xs text-white/40">No keys yet. Create one above.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {mbApiKeys.map((k) => (
                        <div
                          key={k.id}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                            k.revokedAt
                              ? "border-white/5 bg-white/[0.02] opacity-50"
                              : "border-white/10 bg-white/5"
                          }`}
                        >
                          <KeyRound className="h-4 w-4 shrink-0 text-white/40" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-white truncate">{k.name}</span>
                              {k.revokedAt && (
                                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
                                  revoked
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-white/40 font-mono mt-0.5">
                              {k.prefix}
                              <span className="ml-2 text-white/30">
                                created {new Date(k.createdAt).toLocaleDateString()}
                                {k.lastUsedAt && (
                                  <> · last used {new Date(k.lastUsedAt).toLocaleDateString()}</>
                                )}
                              </span>
                            </div>
                          </div>
                          {!k.revokedAt && (
                            <button
                              onClick={() => handleRevokeApiKey(k.id)}
                              disabled={revokingId === k.id}
                              className="rounded p-1.5 text-white/40 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                              title="Revoke"
                            >
                              {revokingId === k.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === "general" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-white">Clear cache</Label>
                  <p className="text-xs text-white/40 mt-1">
                    Drops the local image cache (IndexedDB) and any HTTP cache entries. Use this if thumbnails or generated media are loading stale or stuck. Your boards and uploads are safe — they live in the database.
                  </p>
                </div>
                <Button
                  onClick={handleClearCache}
                  disabled={clearing}
                  className="bg-white/5 text-white hover:bg-white/10 border border-white/10"
                >
                  {clearing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Clearing…</>
                  ) : cleared ? (
                    <><CheckCircle className="mr-2 h-4 w-4 text-green-400" /> Cleared — refresh to see changes</>
                  ) : (
                    <><Trash2 className="mr-2 h-4 w-4" /> Clear cache</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
