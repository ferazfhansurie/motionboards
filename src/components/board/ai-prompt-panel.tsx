"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, Sparkles, Copy, Check } from "lucide-react";
import { useAppStore } from "@/lib/store";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AIPromptPanel() {
  const { isAIPromptOpen, setAIPromptOpen, setPendingPrompt, setTemplatesOpen } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isAIPromptOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAIPromptOpen]);

  if (!isAIPromptOpen) return null;

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages([...newMessages, { role: "assistant", content: data.reply }]);
      } else {
        setMessages([...newMessages, { role: "assistant", content: data.error || "Something went wrong" }]);
      }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Failed to connect. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleUsePrompt = (text: string) => {
    setPendingPrompt(text);
    setAIPromptOpen(false);
  };

  return (
    <div className="absolute left-2 bottom-10 z-50 w-[360px]">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: "480px" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <img src="/aios-icon.png" alt="AI" className="h-5 w-5 rounded-md" />
            <h3 className="text-xs font-bold text-[#0d1117]">AI Prompt Generator</h3>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#0d1117] transition-colors"
            onClick={() => setAIPromptOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-[200px]">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Sparkles className="h-8 w-8 text-gray-200 mx-auto mb-3" />
              <p className="text-xs font-medium text-gray-400 mb-1">AI Cinematography Expert</p>
              <p className="text-[10px] text-gray-300 mb-4">Describe what you want and I'll craft the perfect prompt</p>
              <div className="space-y-1.5">
                {[
                  "Cinematic drone shot of a city at sunset",
                  "Slow motion close-up of coffee being poured",
                  "Anime style fight scene with speed lines",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="block w-full text-left text-[10px] text-gray-500 bg-gray-50 hover:bg-[#f26522]/5 hover:text-[#f26522] rounded-lg px-3 py-2 transition-colors"
                    onClick={() => { setInput(suggestion); }}
                  >
                    &ldquo;{suggestion}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#f26522] text-white rounded-br-sm"
                    : "bg-gray-100 text-[#0d1117] rounded-bl-sm"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-gray-200/50">
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[9px] text-gray-400 hover:text-[#f26522] transition-colors"
                      onClick={() => handleCopy(msg.content, i)}
                    >
                      {copiedIdx === i ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                      {copiedIdx === i ? "Copied" : "Copy"}
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[9px] text-[#f26522] font-medium hover:text-[#d9541a] transition-colors"
                      onClick={() => handleUsePrompt(msg.content)}
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                      Use as prompt
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-xl px-3 py-2 rounded-bl-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#f26522]" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 px-3 py-2.5 shrink-0">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe your scene..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl text-xs text-[#0d1117] placeholder-gray-400 px-3 py-2 pr-10 resize-none focus:outline-none focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all"
              rows={2}
            />
            <button
              type="button"
              disabled={loading || !input.trim()}
              onClick={handleSend}
              className={`absolute right-2 bottom-2 h-6 w-6 rounded-full flex items-center justify-center transition-colors ${
                loading || !input.trim()
                  ? "bg-gray-200 text-gray-400"
                  : "bg-[#f26522] text-white hover:bg-[#d9541a]"
              }`}
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </button>
          </div>
          <p className="text-[8px] text-gray-300 text-center mt-1.5">Powered by GPT-4o · Cinematography Expert</p>
        </div>
      </div>
    </div>
  );
}
