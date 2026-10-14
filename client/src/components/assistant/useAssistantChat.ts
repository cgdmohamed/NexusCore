import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isWriteTool, type PendingAction } from "@/lib/assistant-logic";
import { assistantStore, useAssistantStore } from "./assistant-store";

export type ChatItem = { role: "user" | "assistant"; text: string } | { role: "event"; name: string; ok: boolean; link?: string };
interface ChatView { chatId: string | null; items: ChatItem[]; pending: PendingAction[] | null }
export interface ChatSummary { id: string; title: string; updatedAt: string; awaiting: boolean }

const LIST = ["/api/ai-chat/chats"];
const chatKey = (id: string) => ["/api/ai-chat/chats", id];
const RECORDS = /^\/api\/(tasks|projects|clients|invoices|quotations)/;

async function call<T = ChatView>(method: string, url: string, body?: unknown): Promise<T> {
  // A GET or DELETE carries no body
  return (await apiRequest(method, url, method === "POST" ? body ?? {} : undefined)).json();
}

// The assistant conversations, shared by the phone screen and the desktop panel. They live on the server, so both show the same ones,
// and each one answers on its own: starting or switching to another never interrupts a conversation that is still working.
export function useAssistantChat(online = true) {
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const { activeId, running } = useAssistantStore();

  const list = useQuery<ChatSummary[]>({ queryKey: LIST, staleTime: 0 });
  // Nothing remembered (or what was remembered is gone): open the latest conversation, if there is one
  useEffect(() => {
    if (list.data && !activeId && list.data[0]) assistantStore.setActive(list.data[0].id);
  }, [list.data, activeId]);

  const chat = useQuery<ChatView>({ queryKey: chatKey(activeId ?? ""), queryFn: () => call("GET", `/api/ai-chat/chats/${activeId}`).catch(() => ({ chatId: null, items: [], pending: null })), enabled: !!activeId, staleTime: 0 });

  // A remembered conversation that no longer exists (deleted elsewhere) is forgotten
  useEffect(() => { if (activeId && chat.data && chat.data.chatId === null) assistantStore.setActive(null); }, [activeId, chat.data]);

  const done = (id: string, view: ChatView) => {
    queryClient.setQueryData(chatKey(id), view);
    queryClient.invalidateQueries({ queryKey: LIST });
    // Whatever the assistant created or changed should show on the page that is open
    queryClient.invalidateQueries({ predicate: (q) => RECORDS.test(String(q.queryKey[0])) });
  };
  const fail = (e: Error) => toast({ title: t("ai.chat.failed"), description: e.message, variant: "destructive" });

  const send = useMutation({
    mutationFn: async ({ id, text }: { id: string | null; text: string }) => {
      const target = id ?? (await call("POST", "/api/ai-chat/chats")).chatId!;
      if (!id) assistantStore.setActive(target);
      assistantStore.start(target, { text });
      try { return { id: target, view: await call("POST", `/api/ai-chat/chats/${target}/messages`, { text, language }) }; }
      finally { assistantStore.finish(target); }
    },
    onSuccess: ({ id, view }) => done(id, view),
    onError: (e: Error) => fail(e),
  });
  const answer = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      assistantStore.start(id, { answering: true });
      try { return { id, view: await call("POST", `/api/ai-chat/chats/${id}/confirm`, { approve, language }) }; }
      finally { assistantStore.finish(id); }
    },
    onSuccess: ({ id, view }) => done(id, view),
    onError: (e: Error, vars) => { fail(e); queryClient.invalidateQueries({ queryKey: chatKey(vars.id) }); },
  });
  const fresh = useMutation({
    mutationFn: () => call("POST", "/api/ai-chat/chats"),
    onSuccess: (view) => { queryClient.setQueryData(chatKey(view.chatId!), view); assistantStore.setActive(view.chatId); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => call("DELETE", `/api/ai-chat/chats/${id}`),
    onSuccess: (_r, id) => {
      queryClient.removeQueries({ queryKey: chatKey(id) });
      const rest = (queryClient.getQueryData<ChatSummary[]>(LIST) ?? []).filter((c) => c.id !== id);
      if (assistantStore.getSnapshot().activeId === id) assistantStore.setActive(rest[0]?.id ?? null);
      queryClient.invalidateQueries({ queryKey: LIST });
    },
    onError: (e: Error) => fail(e),
  });

  // Reading steps are noise; show what changed data, and anything that failed
  const items = (chat.data?.items ?? []).filter((i) => i.role !== "event" || isWriteTool(i.name) || !i.ok);
  const pending = chat.data?.pending ?? null;
  const run = activeId ? running.get(activeId) : undefined;
  const working = !!run;
  // A conversation still answering its first message is not on the server's list yet; show it anyway
  const chats = [
    ...Array.from(running.entries())
      .filter(([id, r]) => r.text && !(list.data ?? []).some((c) => c.id === id))
      .map(([id, r]): ChatSummary => ({ id, title: r.text!.replace(/\s+/g, " ").slice(0, 40), updatedAt: new Date().toISOString(), awaiting: false })),
    ...(list.data ?? []),
  ];

  return {
    items, pending, working, loading: list.isLoading || (!!activeId && chat.isLoading), sentText: run?.text ?? null,
    answering: !!run?.answering,
    canStartNew: (items.length > 0 || !!pending || working) && !fresh.isPending,
    activeId, chats, running,
    title: chats.find((c) => c.id === activeId)?.title || "",
    submit(text: string) {
      const v = text.trim();
      if (!v || !online || working || pending) return false;
      send.mutate({ id: activeId, text: v });
      return true;
    },
    answer: (approve: boolean) => { if (activeId) answer.mutate({ id: activeId, approve }); },
    startNew: () => fresh.mutate(),
    select: (id: string) => assistantStore.setActive(id),
    remove: (id: string) => remove.mutate(id),
    deleting: remove.isPending,
  };
}

export type AssistantChat = ReturnType<typeof useAssistantChat>;
