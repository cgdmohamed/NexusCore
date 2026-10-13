import { Plus, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { AssistantChatBody } from "./AssistantChatBody";
import { useAssistantChat } from "./useAssistantChat";

// The desktop assistant: a panel that slides in from the end of the screen, over the page being worked on
export default function AssistantPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const chat = useAssistantChat();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[26rem]" data-testid="assistant-panel">
        <SheetHeader className="flex-row items-center gap-2 space-y-0 border-b border-border px-4 py-3 pe-12">
          <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.75} />
          <SheetTitle className="flex-1 text-base">{t("ai.chat.title")}</SheetTitle>
          <SheetDescription className="sr-only">{t("ai.chat.empty")}</SheetDescription>
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary" onClick={chat.startNew} disabled={!chat.canStartNew} data-testid="assistant-new">
            <Plus className="h-4 w-4" />{t("ai.chat.new")}
          </Button>
        </SheetHeader>
        <AssistantChatBody chat={chat} desktop onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
