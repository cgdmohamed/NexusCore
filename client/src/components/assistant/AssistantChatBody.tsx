import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "wouter";
import { Check, CheckCircle2, ExternalLink, Loader2, Send, ShieldQuestion, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { format } from "@/lib/dateUtils";
import { useTranslation } from "@/lib/i18n";
import { usePermissions } from "@/hooks/usePermissions";
import { changeFields, collapseEvents, describeAction, groupActions, subjectOf, suggestionKeys, type PendingAction } from "@/lib/assistant-logic";
import { AssistantMarkdown } from "./AssistantMarkdown";
import type { AssistantChat } from "./useAssistantChat";

const inputCls = "w-full rounded-lg border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

// Entrance motion: gentle, short, and off for people who ask their device for less movement
const enter = "animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards motion-reduce:animate-none";
const stagger = (i: number): CSSProperties => ({ animationDelay: `${Math.min(i, 8) * 55}ms` });

function useLabels() {
  const { t } = useTranslation();
  const known = (prefix: string, key: string, fallback: string) => { const v = t(`${prefix}${key}`); return v.startsWith(prefix) ? fallback : v; };
  const field = (key: string) => known("ai.chat.f.", key, key);
  // Dates read in the person's language; priorities and statuses are named, not shown as codes
  const value = (key: string, raw: string) => {
    if (key === "dueDate" || key === "validUntil") { try { return format(new Date(`${raw}T00:00:00`), "dd MMM yyyy"); } catch { return raw; } }
    if (key === "priority" || key === "status") return known("ai.chat.v.", raw, raw);
    return raw;
  };
  return { t, known, field, value };
}

function Chip({ label, children }: { label: string; children: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span><span dir="auto" className="min-w-0 truncate font-medium">{children}</span>
    </span>
  );
}

function ActionRow({ action, index }: { action: PendingAction; index: number }) {
  const { field, value } = useLabels();
  const { t } = useTranslation();
  const subject = subjectOf(action);
  const isChange = action.name === "update_task" || action.name === "assign_task";

  if (isChange) {
    return (
      <div className={cn("space-y-2 rounded-xl bg-muted/40 p-3", enter)} style={stagger(index)}>
        <p dir="auto" className="break-words text-sm font-semibold">{subject ?? t("ai.chat.f.taskId")}</p>
        <div className="flex flex-wrap gap-1.5">
          {changeFields(action).map((f) => <Chip key={f.key} label={field(f.key)}>{value(f.key, f.value)}</Chip>)}
        </div>
      </div>
    );
  }

  const s = describeAction(action);
  return (
    <div className={cn("space-y-2 rounded-xl bg-muted/40 p-3", enter)} style={stagger(index)}>
      <div className="flex flex-wrap gap-1.5">
        {s.fields.map((f) => <Chip key={f.key} label={field(f.key)}>{value(f.key, action.names?.[f.key] ?? f.value)}</Chip>)}
      </div>
      {s.lines.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {s.lines.map((l, i) => (
            <li key={i} className="flex items-baseline justify-between gap-2 px-2.5 py-1.5 text-[13px]">
              <span dir="auto" className="min-w-0 break-words">{l.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground" dir="ltr">{l.qty} × {l.price}{l.discount ? ` −${l.discount}%` : ""}</span>
            </li>
          ))}
        </ul>
      )}
      {s.total !== null && <p className="flex justify-between border-t border-border pt-2 text-sm font-semibold"><span>{t("ai.chat.est_total")}</span><span className="tabular-nums">{formatCurrency(s.total)}</span></p>}
    </div>
  );
}

function ConfirmCard({ actions, busy, onAnswer }: { actions: PendingAction[]; busy: boolean; onAnswer: (approve: boolean) => void }) {
  const { t, known } = useLabels();
  const groups = groupActions(actions);
  const rows = groups.reduce((n, g) => n + g.rows.length, 0);
  let index = 0;

  return (
    <div className="space-y-3 rounded-2xl border border-primary/30 bg-card p-3.5 shadow-sm animate-in fade-in zoom-in-95 slide-in-from-bottom-3 duration-300 motion-reduce:animate-none" data-testid="assistant-confirm">
      <div className="flex items-center gap-2">
        <ShieldQuestion className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} />
        <p className="flex-1 text-sm font-semibold">{t("ai.chat.confirm_title")}</p>
        {rows > 1 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary tabular-nums">{t("ai.chat.n_actions", { n: String(rows) })}</span>}
      </div>

      {groups.map((g) => {
        const single = known("ai.chat.tool.", g.name, g.title);
        const many = g.rows.length > 1
          ? g.name === "update_task" ? t("ai.chat.update_n", { n: String(g.rows.length) }) : g.name === "assign_task" ? t("ai.chat.assign_n", { n: String(g.rows.length) }) : `${single} ×${g.rows.length}`
          : single;
        return (
          <section key={g.name} className="space-y-2">
            <p className="text-[13px] font-medium text-muted-foreground">{many}</p>
            {g.rows.map((a) => <ActionRow key={a.id} action={a} index={index++} />)}
          </section>
        );
      })}

      <div className="flex gap-2 pt-1">
        <button disabled={busy} onClick={() => onAnswer(true)} className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary font-medium text-primary-foreground transition-transform active:scale-[0.97] disabled:opacity-50" data-testid="assistant-approve">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{t("ai.chat.approve")}
        </button>
        <button disabled={busy} onClick={() => onAnswer(false)} className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border font-medium transition-transform active:scale-[0.97] disabled:opacity-50" data-testid="assistant-decline">
          <X className="h-4 w-4" />{t("ai.chat.decline")}
        </button>
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className={cn("flex items-end gap-2", enter)} data-testid="assistant-typing">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="h-4 w-4 animate-pulse motion-reduce:animate-none" strokeWidth={1.75} /></span>
      <span className="flex items-center gap-1 rounded-2xl border border-border bg-card px-3.5 py-3" aria-label="…">
        {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 motion-reduce:animate-none" style={{ animationDelay: `${i * 150}ms` }} />)}
      </span>
    </div>
  );
}

// Messages and the composer; the caller supplies the frame (a phone screen or a desktop panel)
export function AssistantChatBody({ chat, desktop = false, onNavigate }: { chat: AssistantChat; desktop?: boolean; onNavigate?: () => void }) {
  const { t, known } = useLabels();
  const { canView, canAdd } = usePermissions();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { items, pending, working, sentText } = chat;
  const shown = collapseEvents(items as any[]) as any[];

  // What was already there when the screen opened does not animate again; only what arrives afterwards does
  const baseline = useRef<number | null>(null);
  if (baseline.current === null && !chat.loading) baseline.current = shown.length;
  const fresh = (i: number) => baseline.current !== null && i >= baseline.current;

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [shown.length, pending, working]);
  useEffect(() => { if (desktop && !pending && !working) inputRef.current?.focus(); }, [desktop, pending, working]);

  const submit = (value: string) => { if (chat.submit(value)) setText(""); };
  const trimmed = text.trim();
  const suggestions = suggestionKeys({ view: canView, add: canAdd });

  return (
    <>
      <div className={cn("flex-1 space-y-3 overflow-y-auto overscroll-contain", desktop ? "p-5" : "p-4")} data-testid="assistant-messages">
        {items.length === 0 && !sentText && !chat.loading && (
          <div className={cn("space-y-4 py-10 text-center", enter)}>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="h-7 w-7" strokeWidth={1.5} /></span>
            <p className="mx-auto max-w-xs text-sm text-muted-foreground">{t("ai.chat.empty")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s, i) => (
                <button key={s} onClick={() => submit(t(`ai.chat.s.${s}`))} style={stagger(i + 2)} className={cn("min-h-11 rounded-full border border-border bg-card px-4 text-sm transition-transform hover:bg-accent active:scale-95", enter)} data-testid={`assistant-suggest-${s}`}>
                  {t(`ai.chat.s.${s}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {shown.map((m, i) => {
          const animate = fresh(i) ? enter : "";
          if (m.role === "event") {
            return (
              <p key={i} className={cn("flex flex-wrap items-center gap-1.5", animate)}>
                <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", m.ok ? "border-success/30 bg-success/10 text-foreground" : "border-danger/30 bg-danger/10 text-danger")}>
                  {m.ok ? <CheckCircle2 className={cn("h-3.5 w-3.5 text-success", fresh(i) && "animate-in zoom-in-50 duration-300 motion-reduce:animate-none")} /> : <X className="h-3.5 w-3.5" />}
                  {m.count > 1 && (m.name === "update_task" || m.name === "assign_task")
                    ? t(m.name === "update_task" ? "ai.chat.update_n" : "ai.chat.assign_n", { n: String(m.count) })
                    : <>{known("ai.chat.tool.", m.name, m.name)}{m.count > 1 && <span className="tabular-nums text-muted-foreground">×{m.count}</span>}</>}
                </span>
                {m.link && (
                  <Link href={m.link} onClick={onNavigate} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" data-testid="assistant-open-record">
                    {t("ai.chat.open_record")}<ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </p>
            );
          }
          if (m.role === "user") {
            return (
              <div key={i} className={cn("ms-auto w-fit max-w-[86%] rounded-2xl rounded-ee-md bg-primary px-3.5 py-2 text-primary-foreground", animate)}>
                <p dir="auto" className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.text}</p>
              </div>
            );
          }
          return (
            <div key={i} className={cn("flex items-start gap-2", animate)}>
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="h-4 w-4" strokeWidth={1.75} /></span>
              <div className="min-w-0 max-w-[86%] rounded-2xl rounded-ss-md border border-border bg-card px-3.5 py-2">
                <AssistantMarkdown text={m.text} />
              </div>
            </div>
          );
        })}

        {sentText && <div className={cn("ms-auto w-fit max-w-[86%] rounded-2xl rounded-ee-md bg-primary px-3.5 py-2 text-primary-foreground", enter)}><p dir="auto" className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{sentText}</p></div>}
        {working && !chat.answering && <Typing />}
        {chat.answering && <Typing />}
        {pending && pending.length > 0 && !chat.answering && <ConfirmCard actions={pending} busy={chat.answering} onAnswer={chat.answer} />}
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
          className={cn(inputCls, "h-auto max-h-32 min-h-12 resize-none py-3 transition-colors disabled:opacity-60")}
          data-testid="assistant-input"
        />
        <button type="submit" disabled={!trimmed || working || !!pending} aria-label={t("m.send")} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all active:scale-90 disabled:scale-95 disabled:opacity-50" data-testid="assistant-send">
          {working ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 rtl:-scale-x-100" />}
        </button>
      </form>
    </>
  );
}
