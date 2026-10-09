import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronLeft, Send, SquarePen } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "@/lib/dateUtils";
import { BottomSheet, ListState, SearchBox, inputCls } from "./ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useOnline } from "./hooks";

interface Conversation {
  id: string;
  otherUser: { id: string; name: string; username: string; avatarUrl: string | null } | null;
  lastMessage: { content: string; createdAt: string; senderId: string | null } | null;
  unreadCount: number;
}
interface Message { id: string; conversationId: string; senderId: string | null; content: string; createdAt: string; senderName: string }
interface Person { id: string; username: string; firstName: string | null; lastName: string | null; avatarUrl: string | null }

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
function Face({ name, src, size = "h-11 w-11" }: { name: string; src?: string | null; size?: string }) {
  return (
    <Avatar className={size}>
      <AvatarImage src={src ?? undefined} alt="" />
      <AvatarFallback className="bg-muted text-sm font-medium text-muted-foreground">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

const personName = (p: Person) => [p.firstName, p.lastName].filter(Boolean).join(" ") || p.username;

// Keeps the badge, the list and the notification count in step after reading or sending
const refreshMessaging = () =>
  Promise.all(["/api/conversations", "/api/messages/unread-count", "/api/notifications"].map((k) =>
    queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith(k) })));

export function MessagesScreen({ conversationId }: { conversationId?: string }) {
  return conversationId ? <Thread id={conversationId} /> : <ConversationList />;
}

function ConversationList() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const q = useQuery<Conversation[]>({ queryKey: ["/api/conversations"], refetchInterval: 10_000, staleTime: 5_000, refetchOnWindowFocus: true });
  const list = q.data ?? [];

  return (
    <div className="space-y-3 p-4 pb-10">
      <button onClick={() => setPickerOpen(true)} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-medium">
        <SquarePen className="h-4 w-4" />
        {t("m.new_message")}
      </button>
      <ListState loading={q.isLoading} error={q.isError} onRetry={() => q.refetch()} empty={list.length === 0} emptyTitle={t("m.no_conversations")} emptyHint={t("m.no_conversations_hint")}>
        <ul className="space-y-2">
          {list.map((c) => {
            const name = c.otherUser?.name ?? t("m.unknown_user");
            return (
              <li key={c.id}>
                <button onClick={() => navigate(`/m/messages/${c.id}`)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-start">
                  <Face name={name} src={c.otherUser?.avatarUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate", c.unreadCount > 0 ? "font-semibold" : "font-medium")}>{name}</span>
                      {c.lastMessage && <span className="shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(c.lastMessage.createdAt, { addSuffix: true })}</span>}
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span dir="auto" className={cn("truncate text-sm", c.unreadCount > 0 ? "text-foreground" : "text-muted-foreground")}>{c.lastMessage?.content ?? ""}</span>
                      {c.unreadCount > 0 && <span className="min-w-5 shrink-0 rounded-full bg-primary px-1.5 text-center text-xs leading-5 text-primary-foreground tabular-nums">{c.unreadCount}</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </ListState>
      <PersonPicker open={pickerOpen} onOpenChange={setPickerOpen} onOpened={(id) => navigate(`/m/messages/${id}`)} />
    </div>
  );
}

function PersonPicker({ open, onOpenChange, onOpened }: { open: boolean; onOpenChange: (o: boolean) => void; onOpened: (conversationId: string) => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const people = useQuery<Person[]>({ queryKey: ["/api/messaging/users"], enabled: open, staleTime: 60_000 });
  const start = useMutation({
    mutationFn: async (participantId: string) => (await apiRequest("POST", "/api/conversations", { participantId })).json() as Promise<{ id: string }>,
    onSuccess: async (data) => {
      await refreshMessaging();
      onOpenChange(false);
      onOpened(data.id);
    },
    onError: (e: Error) => toast({ title: t("m.save_failed"), description: e.message, variant: "destructive" }),
  });
  const term = search.trim().toLowerCase();
  const visible = (people.data ?? []).filter((p) => !term || personName(p).toLowerCase().includes(term) || p.username.toLowerCase().includes(term));

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t("m.pick_person")}>
      <div className="space-y-3">
        <SearchBox value={search} onChange={setSearch} placeholder={t("m.search_people")} />
        <ul className="max-h-[50dvh] space-y-1 overflow-y-auto">
          {visible.map((p) => (
            <li key={p.id}>
              <button disabled={start.isPending} onClick={() => start.mutate(p.id)} className="flex h-14 w-full items-center gap-3 rounded-lg px-2 text-start active:bg-accent">
                <Face name={personName(p)} src={p.avatarUrl} size="h-10 w-10" />
                <span className="font-medium">{personName(p)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </BottomSheet>
  );
}

function Thread({ id }: { id: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const online = useOnline();
  const [, navigate] = useLocation();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const convs = useQuery<Conversation[]>({ queryKey: ["/api/conversations"], staleTime: 5_000 });
  const other = convs.data?.find((c) => c.id === id)?.otherUser;
  const messages = useQuery<Message[]>({ queryKey: [`/api/conversations/${id}/messages`], refetchInterval: 5_000, staleTime: 2_000, refetchOnWindowFocus: true });
  const list = messages.data ?? [];

  // Opening the conversation, and anything that arrives while it is open, counts as read
  const lastId = list[list.length - 1]?.id;
  useEffect(() => {
    if (!lastId) return;
    apiRequest("PATCH", `/api/conversations/${id}/read`, {}).then(refreshMessaging).catch(() => {});
  }, [id, lastId]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [lastId]);

  const send = useMutation({
    mutationFn: async (content: string) => (await apiRequest("POST", `/api/conversations/${id}/messages`, { content })).json(),
    onSuccess: async () => {
      setText("");
      await Promise.all([queryClient.invalidateQueries({ queryKey: [`/api/conversations/${id}/messages`] }), refreshMessaging()]);
    },
    onError: (e: Error) => toast({ title: t("m.send_failed"), description: e.message, variant: "destructive" }),
  });
  const trimmed = text.trim();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-card px-2 py-1">
        <button onClick={() => navigate("/m/messages")} aria-label={t("m.back")} className="flex h-11 w-11 items-center justify-center rounded-full">
          <ChevronLeft className="h-5 w-5 rtl:-scale-x-100" />
        </button>
        <Face name={other?.name ?? "?"} src={other?.avatarUrl} size="h-8 w-8" />
        <span className="truncate font-semibold">{other?.name ?? t("m.messages")}</span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.isLoading ? null : list.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{t("m.no_messages_yet")}</p>
        ) : (
          list.map((m) => {
            const mine = m.senderId === user?.id;
            return (
              <div key={m.id} className={cn("max-w-[82%] rounded-2xl px-3.5 py-2", mine ? "ms-auto bg-primary text-primary-foreground" : "border border-border bg-card")}>
                <p dir="auto" className="whitespace-pre-wrap break-words text-[15px]">{m.content}</p>
                <p className={cn("mt-0.5 text-[11px] tabular-nums", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>{format(m.createdAt, "HH:mm")}</p>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (trimmed && online) send.mutate(trimmed); }}
        className="flex items-end gap-2 border-t border-border bg-card p-3"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("m.type_message")}
          rows={1}
          dir="auto"
          maxLength={5000}
          className={cn(inputCls, "h-auto max-h-32 min-h-12 resize-none py-3")}
        />
        <button type="submit" disabled={!trimmed || !online || send.isPending} aria-label={t("m.send")} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50">
          <Send className="h-5 w-5 rtl:-scale-x-100" />
        </button>
      </form>
    </div>
  );
}
