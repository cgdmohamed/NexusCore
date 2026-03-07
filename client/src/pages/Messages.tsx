import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/lib/i18n";
import { formatDistanceToNow } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Plus, Send } from "lucide-react";
import type { User } from "@shared/schema";

interface ConversationSummary {
  id: string;
  otherUser: { id: string; name: string; username: string } | null;
  lastMessage: { content: string; createdAt: string; senderId: string } | null;
  unreadCount: number;
}

interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string | null;
  content: string;
  createdAt: string;
  senderName: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

export default function Messages() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const currentUser = user as User | undefined;

  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [newConvUserId, setNewConvUserId] = useState("");
  const [isNewConvOpen, setIsNewConvOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useQuery<ConversationSummary[]>({
    queryKey: ["/api/conversations"],
    refetchInterval: 10000,
  });

  const { data: currentMessages = [] } = useQuery<MessageItem[]>({
    queryKey: ["/api/conversations", selectedConvId, "messages"],
    enabled: !!selectedConvId,
    refetchInterval: 5000,
  });

  const { data: usersData = [] } = useQuery<Pick<User, 'id' | 'username' | 'firstName' | 'lastName'>[]>({
    queryKey: ["/api/users/directory"],
  });

  // Scroll to bottom when messages load or update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  // Mark as read when conversation is selected
  useEffect(() => {
    if (!selectedConvId) return;
    apiRequest("PATCH", `/api/conversations/${selectedConvId}/read`, {}).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
    });
  }, [selectedConvId]);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/conversations/${selectedConvId}/messages`, { content });
      return res.json();
    },
    onSuccess: () => {
      setMessageInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedConvId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const res = await apiRequest("POST", "/api/conversations", { participantId });
      return res.json();
    },
    onSuccess: (data: { id: string }) => {
      setIsNewConvOpen(false);
      setNewConvUserId("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setSelectedConvId(data.id);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to start conversation", variant: "destructive" });
    },
  });

  const handleSend = () => {
    const trimmed = messageInput.trim();
    if (!trimmed || !selectedConvId || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectedConversation = conversations.find((c) => c.id === selectedConvId);

  // Filter out yourself from the user list
  const otherUsers = usersData.filter((u) => u.id !== currentUser?.id);

  return (
    <div className="flex flex-col h-screen">
      <Header
        title={t("nav.messages")}
        subtitle={t("messages.start_conversation")}
      />

      <div className="flex flex-1 overflow-hidden px-6 pb-6 gap-4">
        {/* Left panel — conversation list */}
        <div className="w-80 flex-shrink-0 flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-800">{t("nav.messages")}</span>
            <Dialog open={isNewConvOpen} onOpenChange={setIsNewConvOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-1" />
                  {t("messages.new_conversation")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("messages.new_conversation")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <Select value={newConvUserId} onValueChange={setNewConvUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("messages.select_user")} />
                    </SelectTrigger>
                    <SelectContent>
                      {otherUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {`${u.firstName || ""} ${u.lastName || ""}`.trim() || u.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full"
                    disabled={!newConvUserId || createConversationMutation.isPending}
                    onClick={() => newConvUserId && createConversationMutation.mutate(newConvUserId)}
                  >
                    {createConversationMutation.isPending ? "Starting…" : t("messages.new_conversation")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12 px-4 text-center">
                <MessageSquare className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">{t("messages.no_conversations")}</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === selectedConvId;
                const name = conv.otherUser?.name || conv.otherUser?.username || "Unknown";
                return (
                  <button
                    key={conv.id}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                      isActive ? "bg-primary/5 border-l-2 border-l-primary" : ""
                    }`}
                    onClick={() => setSelectedConvId(conv.id)}
                  >
                    <Avatar className="w-9 h-9 flex-shrink-0">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-800 truncate">{name}</span>
                        {conv.lastMessage?.createdAt && (
                          <span className="text-xs text-gray-400 flex-shrink-0 ms-2">
                            {formatDistanceToNow(conv.lastMessage.createdAt, { addSuffix: false })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-gray-500 truncate max-w-[160px]">
                          {conv.lastMessage
                            ? conv.lastMessage.senderId === currentUser?.id
                              ? `${t("messages.you")}: ${conv.lastMessage.content}`
                              : conv.lastMessage.content
                            : t("messages.no_conversations")}
                        </p>
                        {conv.unreadCount > 0 && (
                          <Badge className="ms-2 h-5 min-w-5 px-1.5 flex-shrink-0 bg-primary text-white text-xs">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right panel — message thread */}
        <div className="flex-1 flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden">
          {!selectedConvId ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageSquare className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm">{t("messages.start_conversation")}</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getInitials(selectedConversation?.otherUser?.name || "?")}
                  </AvatarFallback>
                </Avatar>
                <span className="font-semibold text-gray-800">
                  {selectedConversation?.otherUser?.name || selectedConversation?.otherUser?.username || "Unknown"}
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {currentMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    {t("messages.type_message")}
                  </div>
                ) : (
                  currentMessages.map((msg) => {
                    const isOwn = msg.senderId === currentUser?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                          <div
                            className={`px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                              isOwn
                                ? "bg-primary text-white rounded-br-sm"
                                : "bg-gray-100 text-gray-800 rounded-bl-sm"
                            }`}
                          >
                            {msg.content}
                          </div>
                          <span className="text-xs text-gray-400 mt-1 px-1">
                            {isOwn ? t("messages.you") : msg.senderName}
                            {" · "}
                            {formatDistanceToNow(msg.createdAt, { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder={t("messages.type_message")}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sendMessageMutation.isPending}
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
