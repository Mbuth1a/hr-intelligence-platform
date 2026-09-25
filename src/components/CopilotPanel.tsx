import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Send,
  Loader2,
  X,
  Bot,
  User,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AnimatePresence, motion } from "framer-motion";

type Msg = { role: "user" | "assistant"; content: string };

const suggestions = [
  "Why did monthly payroll cost change this quarter?",
  "Who are our most experienced people and where are they?",
  "Which departments cost the most and why?",
  "Any salary outliers I should review?",
  "How many people joined or left recently?",
];

export function CopilotPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const askCopilot = useAction(api.copilot.askCopilot);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    const userMsg: Msg = { role: "user", content: q };
    setMessages((m) => [...m, userMsg]);
    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await askCopilot({ question: q, history });
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.answer },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            err instanceof Error
              ? `⚠ ${err.message}`
              : "⚠ Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-strong flex h-full flex-col overflow-hidden rounded-3xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/60 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[oklch(0.5_0.1_230_/_0.2)] to-[oklch(0.6_0.09_190_/_0.2)] text-primary">
            <Sparkles className="size-5" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight">Kifaru Copilot</p>
            <p className="text-xs text-muted-foreground">
              Grounded in your live HR &amp; payroll data
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="glass-subtle rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <Bot className="size-4" />
                </div>
                <div className="text-sm">
                  <p className="font-semibold">Hello{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋</p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    I&apos;m trained on your organization&apos;s employee, payroll and
                    change history. Ask me anything — from payroll movements to
                    workforce composition.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Try asking
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="glass-subtle rounded-full px-3 py-1.5 text-xs font-medium text-foreground/85 transition hover:bg-white/75"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <Bot className="size-3.5" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "glass-subtle"
              }`}
            >
              {m.content}
            </div>
            {m.role === "user" && (
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/70 text-[10px] font-bold text-muted-foreground">
                {(user?.name ?? "You")[0]?.toUpperCase()}
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="flex gap-2.5">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <Bot className="size-3.5" />
            </div>
            <div className="glass-subtle flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Analyzing workforce data…
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-white/60 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about payroll, headcount, history…"
            disabled={busy}
            className="glass-subtle flex-1 rounded-xl"
          />
          <Button type="submit" size="icon" className="size-10 rounded-xl" disabled={busy || !input.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
        <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
          <ShieldCheck className="size-3" />
          Answers come only from your platform data — the copilot advises, people decide.
        </p>
      </div>
    </div>
  );
}
