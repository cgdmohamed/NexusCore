import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Check, ExternalLink, Loader2, Send, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import { usePermissions } from "@/hooks/usePermissions";
import { describeAction, suggestionKeys, type PendingAction } from "@/lib/assistant-logic";
import type { AssistantChat } from "./useAssistantChat";

const inputCls = "w-full rounded-lg border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function ConfirmCard({ actions, busy, onAnswer }: { actions: PendingAction[]; busy: boolean; onAnswer: (approve: boolean) => void }) {
  const { t } = useTranslation();
  const label = (prefix: string, key: string, fallback: string) => { const v = t(`${prefix}${key}`); return v.startsWith(prefix) ? fallback : v; };
  return (
    <div className="space-y-3 rounded-2xl border border-primary/30 bg-card p-3.5 shadow-sm" data-testid="assistant-confirm">
      <p className="text-sm font-semibold">{t("ai.chat.confirm_title")}</p>
      {actions.map((a) => {
        const s = describeAction(a);
        return (
          <div key={a.id} className="space-y-1.5 rounded-xl bg-muted/40 p-2.5 text-sm">
            <p className="font-medium">{label("ai.chat.tool.", a.name, a.title)}</p>
            {s.fields.map((f) => (
              <p key={f.key} className="flex gap-2 text-[13px]"><span className="shrink-0 text-muted-foreground">{label("ai.chat.f.", f.key, f.key)}</span><span dir="auto" className="min-w-0 break-words">{f.value}</span></p>
            ))}
            {s.lines.length > 0 && (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {s.lines.map((l, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-2 px-2.5 py-1.5 text-[13px]">
                    <span dir="auto" className="min-w-0 break-words">{l.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground" dir="ltr">{l.qty} × {l.price}{l.discount ? ` −${l.discount}%` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
            {s.total !== null && <p className="flex justify-between text-sm font-semibold"><span>{t("ai.chat.est_total")}</span><span className="tabular-nums">{formatCurrency(s.total)}</span></p>}
          </div>
        );
      })}
      <div className="flex gap-2">
        <button disabled={busy} onClick={() => onAnswer(true)} className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary font-medium text-primary-foreground disabled:opacity-50" data-testid="assistant-approve">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{t("ai.chat.approve")}
        </button>
        <button disabled={busy} onClick={() => onAnswer(false)} className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border font-medium disabled:opacity-50" data-testid="assistant-decline">
          <X className="h-4 w-4" />{t("ai.chat.decline")}
        </button>
      </div>
    </div>
  );
}

// Messages and the composer; the caller supplies the frame (a phone screen or a desktop panel)
export function AssistantChatBody({ chat, desktop = false, onNavigate }: { chat: AssistantChat; desktop?: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { canView, canAdd } = usePermissions();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { items, pending, working, sentText } = chat;

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [items.length, pending, working]);
  useEffect(() => { if (desktop) inputRef.current?.focus(); }, [desktop]);
  useEffect(() => { if (desktop && !pending && !working) inputRef.current?.focus(); }, [desktop, pending, working]);

  const submit = (value: string) => { if (chat.submit(value)) setText(""); };
  const trimmed = text.trim();
  const suggestions = suggestionKeys({ view: canView, add: canAdd });
  const eventName = (name: string) => { const k = t(`ai.chat.tool.${name}`); return k.startsWith("ai.chat.tool.") ? name : k; };

  return (
    <>
      <div className={cn("flex-1 space-y-2.5 overflow-y-auto overscroll-contain", desktop ? "p-5" : "p-4")} data-testid="assistant-messages">
        {items.length === 0 && !sentText && !chat.loading && (
          <div className="space-y-4 py-10 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">{t("ai.chat.empty")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => submit(t(`ai.chat.s.${s}`))} className="min-h-11 rounded-full border border-border bg-card px-4 text-sm hover:bg-accent" data-testid={`assistant-suggest-${s}`}>
                  {t(`ai.chat.s.${s}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {items.map((m, i) =>
          m.role === "event" ? (
            <p key={i} className={cn("flex items-center gap-1.5 text-xs", m.ok ? "text-muted-foreground" : "text-danger")}>
              {m.ok ? <Check className="h-3.5 w-3.5 text-success" /> : <X className="h-3.5 w-3.5" />}
              {eventName(m.name)}
              {m.link && (
                <Link href={m.link} onClick={onNavigate} className="ms-1 inline-flex items-center gap-1 font-medium text-primary hover:underline" data-testid="assistant-open-record">
                  {t("ai.chat.open_record")}<ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </p>
          ) : (
            <div key={i} className={cn("max-w-[86%] rounded-2xl px-3.5 py-2", m.role === "user" ? "ms-auto bg-primary text-primary-foreground" : "border border-border bg-card")}>
              <p dir="auto" className="whitespace-pre-wrap break-words text-[15px]">{m.text}</p>
            </div>
          ),
        )}

        {sentText && <div className="ms-auto max-w-[86%] rounded-2xl bg-primary px-3.5 py-2 text-primary-foreground"><p dir="auto" className="whitespace-pre-wrap break-words text-[15px]">{sentText}</p></div>}
        {working && !chat.answering && <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="assistant-typing"><Loader2 className="h-4 w-4 animate-spin" />{t("ai.chat.thinking")}</p>}
        {pending && pending.length > 0 && <ConfirmCard actions={pending} busy={chat.answering} onAnswer={chat.answer} />}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(text); }} className={cn("flex items-end gap-2 border-t border-border bg-card p-3", !desktop && "pb-[calc(0.75rem+env(safe-area-inset-bottom))]")}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // On a computer Enter sends and Shift+Enter starts a new line; on a phone Enter stays a new line
            if (desktop && e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(text); }
          }}
          placeholder={pending ? t("ai.chat.answer_first") : t("ai.chat.placeholder")}
          disabled={!!pending}
          rows={1}
          dir="auto"
          maxLength={2000}
          className={cn(inputCls, "h-auto max-h-32 min-h-12 resize-none py-3")}
          data-testid="assistant-input"
        />
        <button type="submit" disabled={!trimmed || working || !!pending} aria-label={t("m.send")} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50" data-testid="assistant-send">
          <Send className="h-5 w-5 rtl:-scale-x-100" />
        </button>
      </form>
    </>
  );
}
