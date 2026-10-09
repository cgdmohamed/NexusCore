import { useState } from "react";
import { Phone, Mail, MessageCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { BottomSheet, ListState, SearchBox } from "./ui";
import { useList } from "./hooks";
import { whatsappLink } from "./logic";
import type { AddRequest } from "./QuickAdd";

interface ClientRow { id: string; name: string; phone: string | null; email: string | null; city: string | null; country: string | null; status: string }

export default function ClientsScreen({ onAdd }: { onAdd: (r: AddRequest) => void }) {
  const { t } = useTranslation();
  const { canAdd } = usePermissions();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const q = useList<ClientRow[]>("/api/clients?excludeArchived=true");

  const term = search.trim().toLowerCase();
  const visible = (q.data ?? [])
    .filter((c) => !term || [c.name, c.phone, c.email, c.city].some((v) => (v ?? "").toLowerCase().includes(term)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const selected = (q.data ?? []).find((c) => c.id === selectedId) ?? null;
  const wa = selected?.phone ? whatsappLink(selected.phone) : null;
  const action = "flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium";

  return (
    <div className="space-y-3 p-4 pb-10">
      <SearchBox value={search} onChange={setSearch} placeholder={t("m.search")} />
      <ListState loading={q.isLoading} error={q.isError} onRetry={() => q.refetch()} empty={visible.length === 0} emptyTitle={term ? t("m.no_results") : t("m.empty_clients")}>
        <ul className="space-y-2">
          {visible.map((c) => (
            <li key={c.id}>
              <button onClick={() => setSelectedId(c.id)} className="w-full rounded-xl border border-border bg-card p-3 text-start">
                <span className="block font-medium">{c.name}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {c.phone && <bdi dir="ltr">{c.phone}</bdi>}
                  {c.phone && c.city && " · "}
                  {c.city}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </ListState>

      <BottomSheet open={!!selected} onOpenChange={(o) => { if (!o) setSelectedId(null); }} title={selected?.name ?? ""}>
        {selected && (
          <div className="space-y-3">
            <div className="flex gap-2">
              {selected.phone && <a href={`tel:${selected.phone}`} className={action}><Phone className="h-4 w-4" />{t("m.call")}</a>}
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={action}><MessageCircle className="h-4 w-4" />{t("m.whatsapp")}</a>}
              {selected.email && <a href={`mailto:${selected.email}`} className={action}><Mail className="h-4 w-4" />{t("m.email_action")}</a>}
            </div>
            <dl className="space-y-1 text-sm">
              {selected.phone && <div className="flex justify-between"><dt className="text-muted-foreground">{t("m.phone")}</dt><dd><bdi dir="ltr">{selected.phone}</bdi></dd></div>}
              {selected.email && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("m.email")}</dt><dd className="truncate"><bdi dir="ltr">{selected.email}</bdi></dd></div>}
            </dl>
            {canAdd("projects") && (
              <Button className="h-12 w-full text-base" onClick={() => { const id = selected.id; setSelectedId(null); onAdd({ kind: "project", clientId: id }); }}>
                {t("m.add_project_here")}
              </Button>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
