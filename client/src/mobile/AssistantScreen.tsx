import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, Loader2, Plus, Send, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/currency";
import { inputCls } from "./ui";
import { useOnline } from "./hooks";
import { refreshLists } from "./hooks";
import { describeAction, isWriteTool, suggestionKeys, type PendingAction } from "./assistant-logic";

type Item = { role: "user" | "assistant"; text: string } | { role: "event"; name: string; ok: boolean };
interface ChatView { chatId: string | null; items: Item[]; pending: PendingAction[] | null }

const KEY = ["/api/ai-chat/current"];

async function post(url: string, body?: unknown): Promise<ChatView> {
  const res = await apiRequest("POST", url, body ?? {});
  return res.json();
}

function ConfirmCard({ actions, busy, onAnswer }: { actions: PendingAction[]; busy: boolean; onAnswer: (approve: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 rounded-2xl border border-primary/30 bg-card p-3.5 shadow-sm" data-testid="assistant-confirm">
      <p className="text-sm font-semibold">{t("ai.chat.confirm_title")}</p>
      {actions.map((a) => {
        const s = describeAction(a);
        const known = t(`ai.chat.tool.${a.name}`);
        return (
          <div key={a.id} className="space-y-1.5 rounded-xl bg-muted/40 p-2.5 text-sm">
            <p className="font-medium">{known.startsWith("ai.chat.tool.") ? a.title : known}</p>
            {s.fields.map((f) => (
              <p key={f.key} className="flex gap-2 text-[13px]"><span className="shrink-0 text-muted-foreground">{t(`ai.chat.f.${f.key}`).startsWith("ai.chat.f.") ? f.key : t(`ai.chat.f.${f.key}`)}</span><span dir="auto" className="min-w-0 break-words">{f.value}</span></p>
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

export default function AssistantScreen() {
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const { canView, canAdd } = usePermissions();
  const online = useOnline();
  const [, navigate] = useLocation();
  const [text, setText] = useState("");
  const [sentText, setSentText] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const chat = useQuery<ChatView>({ queryKey: KEY, staleTime: 0 });
  const done = (view: ChatView) => {
    queryClient.setQueryData(KEY, view);
    refreshLists();
    queryClient.invalidateQueries({ predicate: (q) => /^\/api\/(clients|invoices|quotations)/.test(String(q.queryKey[0])) });
  };
  const fail = (e: Error) => toast({ title: t("ai.chat.failed"), description: e.message, variant: "destructive" });

  const send = useMutation({
    mutationFn: (value: string) => post("/api/ai-chat/messages", { text: value, language }),
    onSuccess: (view) => { setSentText(null); done(view); },
    onError: (e: Error) => { setText(sentText ?? ""); setSentText(null); fail(e); },
  });
  const answer = useMutation({
    mutationFn: (approve: boolean) => post("/api/ai-chat/confirm", { approve, language }),
    onSuccess: done,
    onError: (e: Error) => { fail(e); queryClient.invalidateQueries({ queryKey: KEY }); },
  });
  const fresh = useMutation({
    mutationFn: () => post("/api/ai-chat/new"),
    onSuccess: (view) => queryClient.setQueryData(KEY, view),
  });

  const items = (chat.data?.items ?? []).filter((i) => i.role !== "event" || isWriteTool(i.name) || !i.ok);
  const pending = chat.data?.pending ?? null;
  const working = send.isPending || answer.isPending;
  const trimmed = text.trim();

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [items.length, pending, working]);

  const submit = (value: string) => {
    const v = value.trim();
    if (!v || !online || working || pending) return;
    setSentText(v);
    setText("");
    send.mutate(v);
  };

  const suggestions = suggestionKeys({ view: canView, add: canAdd });

  return (
    <div className="flex h-[100dvh] flex-col bg-background" data-testid="assistant-screen">
      <header className="flex items-center gap-1 border-b border-border bg-card px-2 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button onClick={() => navigate("/m")} aria-label={t("m.back")} className="flex h-11 w-11 items-center justify-center rounded-full">
          <ChevronLeft className="h-5 w-5 rtl:-scale-x-100" />
        </button>
        <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.75} />
        <h1 className="flex-1 truncate text-lg font-semibold">{t("ai.chat.title")}</h1>
        <button onClick={() => fresh.mutate()} disabled={fresh.isPending || working || items.length === 0} aria-label={t("ai.chat.new")} className="flex h-11 items-center gap-1 rounded-full px-3 text-sm text-primary disabled:opacity-40" data-testid="assistant-new">
          <Plus className="h-4 w-4" />{t("ai.chat.new")}
        </button>
      </header>

      <div className="flex-1 space-y-2.5 overflow-y-auto overscroll-contain p-4">
        {items.length === 0 && !sentText && !chat.isLoading && (
          <div className="space-y-4 py-10 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">{t("ai.chat.empty")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => submit(t(`ai.chat.s.${s}`))} className="min-h-11 rounded-full border border-border bg-card px-4 text-sm" data-testid={`assistant-suggest-${s}`}>
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
              {(() => { const k = t(`ai.chat.tool.${m.name}`); return k.startsWith("ai.chat.tool.") ? m.name : k; })()}
            </p>
          ) : (
            <div key={i} className={cn("max-w-[86%] rounded-2xl px-3.5 py-2", m.role === "user" ? "ms-auto bg-primary text-primary-foreground" : "border border-border bg-card")}>
              <p dir="auto" className="whitespace-pre-wrap break-words text-[15px]">{m.text}</p>
            </div>
          ),
        )}

        {sentText && <div className="ms-auto max-w-[86%] rounded-2xl bg-primary px-3.5 py-2 text-primary-foreground"><p dir="auto" className="whitespace-pre-wrap break-words text-[15px]">{sentText}</p></div>}
        {working && !answer.isPending && <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="assistant-typing"><Loader2 className="h-4 w-4 animate-spin" />{t("ai.chat.thinking")}</p>}
        {pending && pending.length > 0 && <ConfirmCard actions={pending} busy={answer.isPending} onAnswer={(a) => answer.mutate(a)} />}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(text); }} className="flex items-end gap-2 border-t border-border bg-card p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={pending ? t("ai.chat.answer_first") : t("ai.chat.placeholder")}
          disabled={!!pending}
          rows={1}
          dir="auto"
          maxLength={2000}
          className={cn(inputCls, "h-auto max-h-32 min-h-12 resize-none py-3")}
          data-testid="assistant-input"
        />
        <button type="submit" disabled={!trimmed || !online || working || !!pending} aria-label={t("m.send")} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50" data-testid="assistant-send">
          <Send className="h-5 w-5 rtl:-scale-x-100" />
        </button>
      </form>
    </div>
  );
}
