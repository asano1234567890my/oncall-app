"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { getAuthHeaders } from "../hooks/useAuth";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const GREETING =
  "こんにちは！\n当直表の作り方や設定について、何でもお聞きください！";

export default function AiGuideChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const maxHeight = 4 * 24; // ~4 lines
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    if (!hasOpened) setHasOpened(true);
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch(`${API_URL}/api/guide/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          message: trimmed,
          history: messages,
        }),
      });

      if (!res.ok) throw new Error("API error");

      const data = (await res.json()) as { reply: string };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "エラーが発生しました。もう一度お試しください。",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  // ── Floating button ──
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className={`fixed z-[100] bottom-20 right-4 sm:bottom-6 sm:right-6 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition hover:bg-indigo-700 hover:shadow-xl active:scale-95 ${
          !hasOpened ? "animate-pulse" : ""
        }`}
        aria-label="AIガイドを開く"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  // ── Chat panel ──
  return (
    <div className="fixed inset-0 z-[100] flex justify-end sm:flex sm:justify-end">
      {/* Backdrop (PC only) */}
      <div
        className="hidden sm:block absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={() => setIsOpen(false)}
      />

      {/* Panel */}
      <div className="relative z-10 flex h-full w-full sm:w-[400px] flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-gray-800">AIガイド</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {/* Greeting */}
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2.5 text-sm text-gray-800 whitespace-pre-wrap">
              {GREETING}
            </div>
          </div>

          {/* Conversation */}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                  <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                  <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                adjustTextarea();
              }}
              onKeyDown={handleKeyDown}
              placeholder="設定の相談、使い方の質問など..."
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={isLoading || !input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600"
              aria-label="送信"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
