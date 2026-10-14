import { useState } from "react";
import { ChevronDown, Plus, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { AssistantChatList } from "./AssistantChatList";
import { AssistantChatBody } from "./AssistantChatBody";
import { useAssistantChat } from "./useAssistantChat";

// The desktop assistant: a panel that slides in from the end of the screen, over the page being worked on
export default function AssistantPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const chat = useAssistantChat();
  const [listOpen, setListOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[26rem]" data-testid="assistant-panel">
        <SheetHeader className="flex-row items-center gap-2 space-y-0 border-b border-border px-4 py-3 pe-12">
          <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.75} />
          <SheetTitle className="sr-only">{t("ai.chat.title")}</SheetTitle>
          <div className="min-w-0 flex-1 text-base font-semibold">
            <Popover open={listOpen} onOpenChange={setListOpen}>
              <PopoverTrigger asChild>
                <button className="flex max-w-full items-center gap-1 rounded-md px-1.5 py-1 text-start hover:bg-accent" data-testid="assistant-switch" aria-label={t("ai.chat.chats")}>
                  <span dir="auto" className="truncate">{chat.title || t("ai.chat.title")}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {chat.chats.length > 1 && <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-xs tabular-nums text-primary">{chat.chats.length}</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 p-2">
                <AssistantChatList chat={chat} onPick={() => setListOpen(false)} />
              </PopoverContent>
            </Popover>
          </div>
          <SheetDescription className="sr-only">{t("ai.chat.empty")}</SheetDescription>
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary" onClick={chat.startNew} disabled={!chat.canStartNew} aria-label={t("ai.chat.new")} data-testid="assistant-new">
            <Plus className="h-4 w-4" />{t("ai.chat.new")}
          </Button>
        </SheetHeader>
        <AssistantChatBody chat={chat} desktop onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
