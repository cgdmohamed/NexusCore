import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isWriteTool, type PendingAction } from "@/lib/assistant-logic";

export type ChatItem = { role: "user" | "assistant"; text: string } | { role: "event"; name: string; ok: boolean; link?: string };
interface ChatView { chatId: string | null; items: ChatItem[]; pending: PendingAction[] | null }

const KEY = ["/api/ai-chat/current"];
const RECORDS = /^\/api\/(tasks|projects|clients|invoices|quotations)/;

async function post(url: string, body?: unknown): Promise<ChatView> {
  return (await apiRequest("POST", url, body ?? {})).json();
}

// The assistant conversation, shared by the phone screen and the desktop panel. It lives on the server, so both show the same one.
export function useAssistantChat(online = true) {
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const [sentText, setSentText] = useState<string | null>(null);
  const chat = useQuery<ChatView>({ queryKey: KEY, staleTime: 0 });

  const done = (view: ChatView) => {
    queryClient.setQueryData(KEY, view);
    // Whatever the assistant created or changed should show on the page that is open
    queryClient.invalidateQueries({ predicate: (q) => RECORDS.test(String(q.queryKey[0])) });
  };
  const fail = (e: Error) => toast({ title: t("ai.chat.failed"), description: e.message, variant: "destructive" });

  const send = useMutation({
    mutationFn: (text: string) => post("/api/ai-chat/messages", { text, language }),
    onSuccess: (view) => { setSentText(null); done(view); },
    onError: (e: Error) => { setSentText(null); fail(e); },
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

  // Reading steps are noise; show what changed data, and anything that failed
  const items = (chat.data?.items ?? []).filter((i) => i.role !== "event" || isWriteTool(i.name) || !i.ok);
  const pending = chat.data?.pending ?? null;
  const working = send.isPending || answer.isPending;

  return {
    items, pending, working, loading: chat.isLoading, sentText,
    answering: answer.isPending,
    canStartNew: items.length > 0 && !working && !fresh.isPending,
    submit(text: string) {
      const v = text.trim();
      if (!v || !online || working || pending) return false;
      setSentText(v);
      send.mutate(v);
      return true;
    },
    answer: (approve: boolean) => answer.mutate(approve),
    startNew: () => fresh.mutate(),
  };
}

export type AssistantChat = ReturnType<typeof useAssistantChat>;
