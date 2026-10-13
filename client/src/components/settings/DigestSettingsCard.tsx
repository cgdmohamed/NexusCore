import { useMutation, useQuery } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Prefs { morningEnabled: boolean; morningHour: number; eveningEnabled: boolean; eveningHour: number }
type Overrides = { [K in keyof Prefs]: Prefs[K] | null };
interface DigestData { company: Prefs; mine: Overrides; effective: Prefs; canEditCompany: boolean }

const KEY = ["/api/settings/digest"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const label = (h: number) => `${String(h).padStart(2, "0")}:00`;
const FOLLOW = "company";

// The two daily task summaries: the company sets the defaults, each person may switch them off or move them
export function DigestSettingsCard({ scope }: { scope: "me" | "company" }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data } = useQuery<DigestData>({ queryKey: KEY });

  const save = useMutation({
    mutationFn: async (body: Prefs | Overrides) => apiRequest("PUT", `/api/settings/digest/${scope}`, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: KEY }); toast({ title: t("digest.saved") }); },
    onError: () => toast({ title: t("digest.failed"), variant: "destructive" }),
  });

  if (!data || (scope === "company" && !data.canEditCompany)) return null;

  const company = scope === "company";
  const values: Overrides = company ? data.company : data.mine;
  const patch = (change: Partial<Overrides>) => save.mutate({ ...values, ...change } as any);

  const rows = [
    { key: "morning" as const, title: t("digest.morning"), hint: t("digest.morning_hint") },
    { key: "evening" as const, title: t("digest.evening"), hint: t("digest.evening_hint") },
  ];

  return (
    <Card data-testid={`digest-card-${scope}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5" strokeWidth={1.75} />{company ? t("digest.company_title") : t("digest.my_title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{company ? t("digest.company_intro") : t("digest.my_intro")}</p>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {rows.map((r) => {
          const enabledKey = `${r.key}Enabled` as const;
          const hourKey = `${r.key}Hour` as const;
          const enabled = values[enabledKey] ?? data.company[enabledKey];
          const hour = values[hourKey];
          return (
            <div key={r.key} className="flex flex-wrap items-center justify-between gap-3 py-3" data-testid={`digest-${scope}-${r.key}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.hint}</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={hour === null ? FOLLOW : String(hour)}
                  disabled={save.isPending || !enabled}
                  onChange={(e) => patch({ [hourKey]: e.target.value === FOLLOW ? null : Number(e.target.value) })}
                  aria-label={t("digest.time")}
                  data-testid={`digest-${scope}-${r.key}-hour`}
                >
                  {!company && <option value={FOLLOW}>{t("digest.follow", { time: label(data.company[hourKey]) })}</option>}
                  {HOURS.map((h) => <option key={h} value={h}>{label(h)}</option>)}
                </select>
                <Switch
                  checked={!!enabled}
                  disabled={save.isPending}
                  onCheckedChange={(v) => patch({ [enabledKey]: company || v !== data.company[enabledKey] ? v : null })}
                  aria-label={r.title}
                  data-testid={`digest-${scope}-${r.key}-switch`}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
