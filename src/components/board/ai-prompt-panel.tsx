"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, Sparkles, Copy, Check } from "lucide-react";
import { useAppStore } from "@/lib/store";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const GREETING = "Hey! I'm your AI cinematography expert. Tell me what you want to create — a cinematic drone shot, anime fight scene, product ad — and I'll craft the perfect prompt for you. What are we making today?";

export function AIPromptPanel() {
  const { isAIPromptOpen, setAIPromptOpen, setPendingPrompt, theme } = useAppStore();
  const isDark = theme === "dark";
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [typingText, setTypingText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasGreeted = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingText]);

  useEffect(() => {
    if (isAIPromptOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAIPromptOpen]);

  // Auto-type greeting on first open
  useEffect(() => {
    if (isAIPromptOpen && !hasGreeted.current && messages.length === 0) {
      hasGreeted.current = true;
      setIsTyping(true);
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setTypingText(GREETING.slice(0, i));
        if (i >= GREETING.length) {
          clearInterval(interval);
          setIsTyping(false);
          setMessages([{ role: "assistant", content: GREETING }]);
          setTypingText("");
        }
      }, 18);
      return () => clearInterval(interval);
    }
  }, [isAIPromptOpen, messages.length]);

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
    <div className="fixed left-3 bottom-14 z-[55] w-[380px]">
      <div className={`rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${isDark ? "border-gray-700 bg-[#161b22]" : "border-gray-200 bg-white"}`} style={{ maxHeight: "min(560px, calc(100vh - 80px))" }}>
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${isDark ? "border-gray-700 bg-gradient-to-r from-[#161b22] to-[#1c2128]" : "border-gray-100 bg-gradient-to-r from-white to-gray-50"}`}>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <img src="/aios-icon.png" alt="AI" className="h-7 w-7 rounded-lg" />
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-white" />
            </div>
            <div>
              <h3 className={`text-xs font-bold ${isDark ? "text-white" : "text-[#0d1117]"}`}>AI Prompt Generator</h3>
              <p className="text-[9px] text-green-500 font-medium">Online</p>
            </div>
          </div>
          <button
            type="button"
            className={`rounded-lg p-1.5 transition-colors ${isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-400 hover:bg-gray-100 hover:text-[#0d1117]"}`}
            onClick={() => setAIPromptOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[240px]">
          {messages.length === 0 && !isTyping && (
            <div className="text-center py-8">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#f26522] to-[#ec4899] flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <p className={`text-sm font-bold mb-1 ${isDark ? "text-white" : "text-[#0d1117]"}`}>AI Cinematography Expert</p>
              <p className={`text-[11px] mb-5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Describe what you want and I'll craft the perfect prompt</p>
              <div className="space-y-2">
                {[
                  "Cinematic drone shot of a city at sunset",
                  "Slow motion close-up of coffee being poured",
                  "Anime style fight scene with speed lines",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className={`block w-full text-left text-[11px] rounded-xl px-4 py-2.5 transition-colors border ${isDark ? "text-gray-300 bg-[#0d1117] border-gray-700 hover:border-[#f26522] hover:text-[#f26522]" : "text-gray-600 bg-gray-50 border-gray-100 hover:border-[#f26522] hover:text-[#f26522] hover:bg-[#f26522]/5"}`}
                    onClick={() => { setInput(suggestion); }}
                  >
                    &ldquo;{suggestion}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Auto-typing greeting */}
          {isTyping && typingText && (
            <div className="flex justify-start">
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[12px] leading-relaxed rounded-bl-sm ${isDark ? "bg-[#0d1117] text-gray-200" : "bg-gray-100 text-[#0d1117]"}`}>
                <p className="whitespace-pre-wrap">{typingText}<span className="animate-pulse">|</span></p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-[12px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#f26522] text-white rounded-br-sm"
                    : isDark ? "bg-[#0d1117] text-gray-200 rounded-bl-sm" : "bg-gray-100 text-[#0d1117] rounded-bl-sm"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.role === "assistant" && i > 0 && (
                  <div className={`flex items-center gap-2 mt-2.5 pt-2 border-t ${isDark ? "border-gray-700" : "border-gray-200/50"}`}>
                    <button
                      type="button"
                      className={`flex items-center gap-1 text-[10px] transition-colors ${isDark ? "text-gray-500 hover:text-[#f26522]" : "text-gray-400 hover:text-[#f26522]"}`}
                      onClick={() => handleCopy(msg.content, i)}
                    >
                      {copiedIdx === i ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedIdx === i ? "Copied" : "Copy"}
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[10px] text-[#f26522] font-semibold hover:text-[#d9541a] transition-colors"
                      onClick={() => handleUsePrompt(msg.content)}
                    >
                      <Sparkles className="h-3 w-3" />
                      Use as prompt
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className={`rounded-2xl px-4 py-3 rounded-bl-sm ${isDark ? "bg-[#0d1117]" : "bg-gray-100"}`}>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 bg-[#f26522] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 bg-[#f26522] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 bg-[#f26522] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={`border-t px-4 py-3 shrink-0 ${isDark ? "border-gray-700" : "border-gray-100"}`}>
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
              className={`w-full border rounded-xl text-xs placeholder-gray-400 px-4 py-3 pr-12 resize-none focus:outline-none focus:border-[#f26522] focus:ring-2 focus:ring-[#f26522]/10 transition-all ${isDark ? "bg-[#0d1117] border-gray-700 text-white" : "bg-gray-50 border-gray-200 text-[#0d1117]"}`}
              rows={2}
            />
            <button
              type="button"
              disabled={loading || !input.trim()}
              onClick={handleSend}
              className={`absolute right-3 bottom-3 h-7 w-7 rounded-full flex items-center justify-center transition-all ${
                loading || !input.trim()
                  ? isDark ? "bg-gray-700 text-gray-500" : "bg-gray-200 text-gray-400"
                  : "bg-[#f26522] text-white hover:bg-[#d9541a] hover:scale-105"
              }`}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className={`text-[8px] ${isDark ? "text-gray-600" : "text-gray-300"}`}>Powered by GPT-4o</p>
            <a
              href="https://wa.me/60112167672?text=Hi%2C%20I%20want%20to%20upgrade%20my%20AI%20on%20MotionBoards%20%F0%9F%9A%80"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[8px] font-semibold text-[#f26522] hover:text-[#d9541a] transition-colors flex items-center gap-0.5"
            >
              ⚡ Upgrade AI
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
