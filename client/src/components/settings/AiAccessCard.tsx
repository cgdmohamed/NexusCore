import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { format } from "@/lib/dateUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { snippet, type SnippetKind } from "@/lib/ai-access-snippets";

interface TokenRow { id: string; name: string; prefix: string; createdAt: string | null; lastUsedAt: string | null; revokedAt: string | null }
interface ConnectionRow { id: string; clientName: string | null; approvedBy: string; approverFirstName: string | null; approverLastName: string | null; createdAt: string | null; lastUsedAt: string | null }
interface AccessData { mcpUrl: string; assistant: { id: string; roleId: string | null } | null; tokens: TokenRow[]; connections?: ConnectionRow[] }

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button" variant="outline" size="sm" className="gap-1.5"
      onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => {}); }}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}

const KINDS: { kind: SnippetKind; label: string }[] = [
  { kind: "claudeCode", label: "Claude Code" },
  { kind: "claudeDesktop", label: "Claude Desktop" },
  { kind: "anthropicApi", label: "Anthropic API" },
  { kind: "openai", label: "OpenAI API" },
];

// Where an administrator lets Claude or OpenAI create tasks and projects through MCP
export function AiAccessCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data } = useQuery<AccessData>({ queryKey: ["/api/settings/ai-access"] });
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<{ token: string; name: string } | null>(null);
  const [kind, setKind] = useState<SnippetKind>("claudeCode");

  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/settings/ai-access/tokens", { name })).json(),
    onSuccess: (r: { token: string; name: string }) => {
      setFresh({ token: r.token, name: r.name });
      setName("");
      queryClient.invalidateQueries({ queryKey: ["/api/settings/ai-access"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to create the token", variant: "destructive" }),
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/settings/ai-access/tokens/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/settings/ai-access"] }); toast({ title: t("ai.revoked") }); },
  });

  const disconnect = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/settings/ai-access/connections/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/settings/ai-access"] }); toast({ title: t("ai.disconnected") }); },
  });

  const url = data?.mcpUrl ?? "";
  const shownToken = fresh?.token ?? "YOUR_TOKEN";
  const code = url ? snippet(kind, url, shownToken) : "";
  const active = (data?.tokens ?? []).filter((x) => !x.revokedAt);
  const date = (d: string | null) => (d ? format(d, "dd/MM/yyyy HH:mm") : "—");

  return (
    <Card data-testid="ai-access-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" strokeWidth={1.75} />{t("ai.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("ai.intro")}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("ai.url")}</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-sm" dir="ltr">{url || "…"}</code>
            {url && <CopyButton text={url} label={t("ai.copy")} />}
          </div>
        </div>

        <div className="space-y-2" data-testid="ai-claude-connect">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("ai.claude_title")}</p>
          <p className="text-sm text-muted-foreground">{t("ai.claude_steps")}</p>
          <p className="text-xs text-muted-foreground">{t("ai.claude_note")}</p>
          <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("ai.apps")}</p>
          {(data?.connections ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("ai.no_apps")}</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {(data?.connections ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.clientName || "—"}</p>
                    <p className="text-xs text-muted-foreground">{t("ai.approved_by", { name: [c.approverFirstName, c.approverLastName].filter(Boolean).join(" ") || c.approvedBy })} · {t("ai.created", { date: date(c.createdAt) })} · {t("ai.last_used", { date: date(c.lastUsedAt) })}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-danger" disabled={disconnect.isPending} onClick={() => disconnect.mutate(c.id)} data-testid={`ai-disconnect-${c.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />{t("ai.disconnect")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("ai.tokens")}</p>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("ai.token_name_ph")} maxLength={80} data-testid="ai-token-name" />
            <Button type="submit" disabled={!name.trim() || create.isPending} className="gap-1.5 sm:shrink-0" data-testid="ai-create-token">
              <KeyRound className="h-4 w-4" />{t("ai.create")}
            </Button>
          </form>

          {fresh && (
            <div className="space-y-2 rounded-lg border border-warning/30 bg-warning-soft p-3" data-testid="ai-fresh-token">
              <p className="text-sm font-medium text-foreground">{t("ai.fresh_title", { name: fresh.name })}</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-background px-3 py-2 text-xs" dir="ltr">{fresh.token}</code>
                <CopyButton text={fresh.token} label={t("ai.copy")} />
              </div>
              <p className="text-xs text-muted-foreground">{t("ai.fresh_hint")}</p>
            </div>
          )}

          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("ai.no_tokens")}</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {active.map((tk) => (
                <li key={tk.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{tk.name} <code className="ms-1 text-xs text-muted-foreground" dir="ltr">{tk.prefix}…</code></p>
                    <p className="text-xs text-muted-foreground">{t("ai.created", { date: date(tk.createdAt) })} · {t("ai.last_used", { date: date(tk.lastUsedAt) })}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-danger" disabled={revoke.isPending} onClick={() => revoke.mutate(tk.id)} data-testid={`ai-revoke-${tk.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />{t("ai.revoke")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("ai.connect")}</p>
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {KINDS.map((k) => (
              <Button key={k.kind} variant={kind === k.kind ? "default" : "outline"} size="sm" role="tab" aria-selected={kind === k.kind} onClick={() => setKind(k.kind)}>{k.label}</Button>
            ))}
          </div>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed" dir="ltr">{code}</pre>
          {code && <CopyButton text={code} label={t("ai.copy")} />}
          {!fresh && <p className="text-xs text-muted-foreground">{t("ai.placeholder_hint")}</p>}
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <p className="font-medium">{t("ai.perm_title")} <Badge variant="outline" className="ms-1">AI Assistant</Badge></p>
          <p className="mt-1 text-muted-foreground">{t("ai.perm_text")} <Link href="/team-roles" className="text-primary hover:underline">{t("ai.perm_link")}</Link></p>
        </div>
      </CardContent>
    </Card>
  );
}
