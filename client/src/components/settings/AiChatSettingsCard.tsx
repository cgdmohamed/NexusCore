import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageSquareText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Data { provider: "anthropic" | "openai"; model: string; enabled: boolean; hasKey: boolean; keyLast4: string | null; source: "database" | "environment" | "none"; defaults: Record<string, string> }
const KEY = ["/api/settings/ai-chat"];

// Administrators choose the model provider and paste the key for the phone app's assistant
export function AiChatSettingsCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data } = useQuery<Data>({ queryKey: KEY });
  const [provider, setProvider] = useState<"anthropic" | "openai">("anthropic");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!data) return;
    setProvider(data.provider);
    setModel(data.model && data.model !== data.defaults[data.provider] ? data.model : "");
    setEnabled(data.enabled);
  }, [data?.provider, data?.model, data?.enabled]);

  const save = useMutation({
    mutationFn: async () => apiRequest("PUT", "/api/settings/ai-chat", { provider, model: model.trim() || undefined, apiKey: apiKey.trim() || undefined, enabled }),
    onSuccess: () => { setApiKey(""); queryClient.invalidateQueries({ queryKey: KEY }); queryClient.invalidateQueries({ queryKey: ["/api/ai-chat/status"] }); toast({ title: t("ai.chatset.saved") }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });
  const test = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/settings/ai-chat/test")).json() as Promise<{ ok: boolean; message?: string }>,
    onSuccess: (r) => toast(r.ok ? { title: t("ai.chatset.test_ok") } : { title: t("ai.chatset.test_fail"), description: r.message, variant: "destructive" }),
  });

  if (!data) return null;
  const keyHint = data.source === "database" && data.hasKey ? t("ai.chatset.key_set", { last4: data.keyLast4 ?? "" }) : data.source === "environment" ? t("ai.chatset.key_env") : t("ai.chatset.key_none");
  const select = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <Card data-testid="ai-chat-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MessageSquareText className="h-5 w-5" strokeWidth={1.75} />{t("ai.chatset.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("ai.chatset.intro")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="ai-chat-enabled" className="text-sm font-medium">{t("ai.chatset.enabled")}</label>
          <Switch id="ai-chat-enabled" checked={enabled} onCheckedChange={setEnabled} data-testid="ai-chat-enabled" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="ai-chat-provider" className="text-sm font-medium">{t("ai.chatset.provider")}</label>
            <select id="ai-chat-provider" className={select} value={provider} onChange={(e) => setProvider(e.target.value as any)} data-testid="ai-chat-provider">
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="ai-chat-model" className="text-sm font-medium">{t("ai.chatset.model")}</label>
            <Input id="ai-chat-model" dir="ltr" value={model} onChange={(e) => setModel(e.target.value)} placeholder={t("ai.chatset.model_ph", { model: data.defaults[provider] })} data-testid="ai-chat-model" />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="ai-chat-key" className="text-sm font-medium">{t("ai.chatset.key")}</label>
          <Input id="ai-chat-key" type="password" dir="ltr" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} data-testid="ai-chat-key" />
          <p className="text-xs text-muted-foreground">{keyHint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="ai-chat-save">{t("ai.chatset.save")}</Button>
          <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending || (!data.hasKey && !apiKey)} data-testid="ai-chat-test">{t("ai.chatset.test")}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
