import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";

// Consent screen for connecting an AI app (for example claude.ai). It opens after the usual sign-in, from the app's authorization link.
export default function OAuthAuthorize() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const search = typeof window !== "undefined" ? window.location.search : "";
  const [leaving, setLeaving] = useState(false);

  const info = useQuery<{ clientName: string; canApprove: boolean }>({
    queryKey: ["/api/oauth/authorize-info", search],
    queryFn: async () => {
      const res = await fetch(`/api/oauth/authorize-info${search}`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "invalid_request");
      return res.json();
    },
    retry: false,
  });

  const decide = useMutation({
    mutationFn: async (decision: "allow" | "deny") => {
      const body = Object.fromEntries(new URLSearchParams(search));
      const res = await apiRequest("POST", "/api/oauth/authorize", { ...body, decision });
      return (await res.json()) as { redirectUrl: string };
    },
    onSuccess: ({ redirectUrl }) => { setLeaving(true); window.location.assign(redirectUrl); },
  });

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "";
  const app = info.data?.clientName ?? "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4" data-testid="oauth-authorize">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            {info.isError || info.data?.canApprove === false ? <ShieldAlert className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
          </div>
          <CardTitle>{info.isError ? t("oauth.invalid_title") : t("oauth.title", { app })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {info.isLoading && <p className="text-center text-sm text-muted-foreground">…</p>}
          {info.isError && <p className="text-center text-sm text-muted-foreground" data-testid="oauth-invalid">{t("oauth.invalid_text")}</p>}
          {info.data && !info.data.canApprove && <p className="text-center text-sm text-muted-foreground" data-testid="oauth-admin-only">{t("oauth.admin_only")}</p>}
          {info.data?.canApprove && (
            <>
              <p className="text-sm text-muted-foreground">{t("oauth.intro", { app, name })}</p>
              <ul className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{t("oauth.can_tasks")}</li>
                <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{t("oauth.can_projects")}</li>
              </ul>
              <p className="text-xs text-muted-foreground">{t("oauth.revoke_hint")}</p>
              {decide.isError && <p className="text-sm text-danger">{t("oauth.failed")}</p>}
              <div className="flex gap-2">
                <Button className="flex-1" disabled={decide.isPending || leaving} onClick={() => decide.mutate("allow")} data-testid="oauth-allow">{t("oauth.allow")}</Button>
                <Button className="flex-1" variant="outline" disabled={decide.isPending || leaving} onClick={() => decide.mutate("deny")} data-testid="oauth-deny">{t("oauth.deny")}</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
