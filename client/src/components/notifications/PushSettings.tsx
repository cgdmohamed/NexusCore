import { BellRing, BellOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { usePush } from "@/lib/push";

interface Props {
  platform: "desktop" | "mobile";
  // "banner" is a one-line prompt that disappears once push is on or cannot be used
  variant?: "card" | "banner";
}

export function PushSettings({ platform, variant = "card" }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const push = usePush(platform);
  const { status } = push;

  const explanation: Partial<Record<typeof status, string>> = {
    unsupported: t("push.unsupported"),
    needs_install: t("push.needs_install"),
    not_configured: t("push.not_configured"),
    denied: t("push.denied"),
  };

  if (variant === "banner") {
    if (status !== "off" && status !== "needs_install") return null;
    return (
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-accent/50 p-3">
        <BellRing className="h-5 w-5 shrink-0 text-primary" />
        <p className="flex-1 text-sm">{status === "off" ? t("push.banner") : t("push.needs_install")}</p>
        {status === "off" && (
          <Button size="sm" className="h-10 shrink-0" disabled={push.busy} onClick={push.enable}>
            {t("push.enable")}
          </Button>
        )}
      </div>
    );
  }

  const on = status === "on";
  const canToggle = status === "on" || status === "off";
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-muted-foreground">{on ? <BellRing className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}</span>
          <div className="flex-1">
            <p className="font-medium text-foreground">{t("push.title")}</p>
            <p className="text-sm text-muted-foreground">{on ? t("push.on") : t("push.desc")}</p>
          </div>
          <Switch
            checked={on}
            disabled={!canToggle || push.busy}
            aria-label={t("push.title")}
            onCheckedChange={(next) => (next ? push.enable() : push.disable())}
          />
        </div>
        {explanation[status] && <p className="text-sm text-muted-foreground">{explanation[status]}</p>}
        {push.error && <p className="text-sm text-danger">{t("push.failed")}</p>}
        {on && (
          <Button
            variant="outline"
            size="sm"
            disabled={push.busy}
            onClick={async () => { await push.sendTest(); toast({ title: t("push.test_sent") }); }}
          >
            {t("push.test")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
