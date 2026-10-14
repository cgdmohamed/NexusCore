import { useLocation } from "wouter";
import { useState } from "react";
import { ChevronDown, ChevronLeft, Plus, Sparkles } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { AssistantChatList } from "@/components/assistant/AssistantChatList";
import { AssistantChatBody } from "@/components/assistant/AssistantChatBody";
import { useAssistantChat } from "@/components/assistant/useAssistantChat";
import { useOnline } from "./hooks";
import { BottomSheet } from "./ui";

// The phone's full-screen frame around the shared assistant chat
export default function AssistantScreen() {
  const { t } = useTranslation();
  const online = useOnline();
  const [, navigate] = useLocation();
  const chat = useAssistantChat(online);
  const [listOpen, setListOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] flex-col bg-background" data-testid="assistant-screen">
      <header className="flex items-center gap-1 border-b border-border bg-card px-2 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button onClick={() => navigate("/m")} aria-label={t("m.back")} className="flex h-11 w-11 items-center justify-center rounded-full">
          <ChevronLeft className="h-5 w-5 rtl:-scale-x-100" />
        </button>
        <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.75} />
        <button onClick={() => setListOpen(true)} className="flex min-h-11 min-w-0 flex-1 items-center gap-1 text-start" aria-label={t("ai.chat.chats")} data-testid="assistant-switch">
          <h1 dir="auto" className="truncate text-lg font-semibold">{chat.title || t("ai.chat.title")}</h1>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          {chat.chats.length > 1 && <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-xs tabular-nums text-primary">{chat.chats.length}</span>}
        </button>
        <button onClick={chat.startNew} disabled={!chat.canStartNew} aria-label={t("ai.chat.new")} className="flex h-11 items-center gap-1 rounded-full px-3 text-sm text-primary disabled:opacity-40" data-testid="assistant-new">
          <Plus className="h-4 w-4" />{t("ai.chat.new")}
        </button>
      </header>
      <AssistantChatBody chat={chat} />
      <BottomSheet open={listOpen} onOpenChange={setListOpen} title={t("ai.chat.chats")}>
        <AssistantChatList chat={chat} onPick={() => setListOpen(false)} />
      </BottomSheet>
    </div>
  );
}
