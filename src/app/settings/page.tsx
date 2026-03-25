"use client";

import { useState, useEffect } from "react";
import { Save, Eye, EyeOff, Loader2, CheckCircle, ExternalLink, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const router = useRouter();
  const [falApiKey, setFalApiKey] = useState("");
  const [replicateApiKey, setReplicateApiKey] = useState("");
  const [showFalKey, setShowFalKey] = useState(false);
  const [showReplicateKey, setShowReplicateKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("ai-generation");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setFalApiKey(data.falApiKey || "");
        setReplicateApiKey(data.replicateApiKey || "");
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
        body: JSON.stringify({ falApiKey, replicateApiKey }),
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
                {/* fal.ai */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="fal-key" className="text-white/80">
                      fal.ai API Key
                    </Label>
                    <a
                      href="https://fal.ai/dashboard/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-[#f26522] hover:underline"
                    >
                      Get key <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="relative mt-1.5">
                    <Input
                      id="fal-key"
                      type={showFalKey ? "text" : "password"}
                      value={falApiKey}
                      onChange={(e) => setFalApiKey(e.target.value)}
                      placeholder="Enter your fal.ai API key"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                      onClick={() => setShowFalKey(!showFalKey)}
                    >
                      {showFalKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-white/30">
                    Access Veo 3.1, Sora 2, Kling 3.0, Wan, LTX, Nano Banana and more
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

            {activeSection === "general" && (
              <div className="text-center py-8">
                <p className="text-sm text-white/30">General settings coming soon</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
