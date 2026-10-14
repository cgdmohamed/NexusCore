import { useState } from "react";
import { Loader2, MessageSquarePlus, ShieldQuestion, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "@/lib/dateUtils";
import { useTranslation } from "@/lib/i18n";
import type { AssistantChat } from "./useAssistantChat";

// The person's conversations: open one, start another, or remove one. Shared by the desktop popover and the phone sheet.
export function AssistantChatList({ chat, onPick }: { chat: AssistantChat; onPick: () => void }) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <div className="space-y-1" data-testid="assistant-chat-list">
      <button
        onClick={() => { chat.startNew(); onPick(); }}
        disabled={!chat.canStartNew}
        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-primary transition-colors hover:bg-accent disabled:opacity-40"
        data-testid="assistant-new-chat"
      >
        <MessageSquarePlus className="h-4 w-4" />{t("ai.chat.new")}
      </button>

      {chat.chats.length === 0 && <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t("ai.chat.no_chats")}</p>}

      <ul className="max-h-[60dvh] space-y-0.5 overflow-y-auto overscroll-contain">
        {chat.chats.map((c, i) => {
          const active = c.id === chat.activeId;
          const busy = chat.running.has(c.id);
          return (
            <li key={c.id} className="animate-in fade-in slide-in-from-bottom-1 duration-200 fill-mode-backwards motion-reduce:animate-none" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
              <div className={cn("flex items-center gap-1 rounded-lg", active ? "bg-primary/10" : "hover:bg-accent")}>
                <button onClick={() => { chat.select(c.id); onPick(); }} className="flex min-h-12 min-w-0 flex-1 flex-col items-start justify-center px-3 py-1.5 text-start" data-testid="assistant-chat-item" aria-current={active}>
                  <span dir="auto" className="w-full truncate text-sm font-medium">{c.title || t("ai.chat.untitled")}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {busy
                      ? <span className="flex items-center gap-1 text-primary"><Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />{t("ai.chat.running")}</span>
                      : c.awaiting
                        ? <span className="flex items-center gap-1 text-warning"><ShieldQuestion className="h-3 w-3" />{t("ai.chat.awaiting")}</span>
                        : formatDistanceToNow(c.updatedAt, { addSuffix: true })}
                  </span>
                </button>
                {confirming === c.id ? (
                  <button
                    onClick={() => { chat.remove(c.id); setConfirming(null); }}
                    disabled={busy || chat.deleting}
                    className="me-1 flex h-9 items-center rounded-md bg-danger px-2.5 text-xs font-medium text-white disabled:opacity-50"
                    data-testid="assistant-chat-delete-confirm"
                  >
                    {t("ai.chat.delete_confirm")}
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirming(c.id)}
                    disabled={busy}
                    aria-label={t("ai.chat.delete")}
                    className="me-1 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-danger disabled:opacity-40"
                    data-testid="assistant-chat-delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
