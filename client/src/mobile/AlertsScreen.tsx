import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "@/lib/dateUtils";
import { ListState } from "./ui";

export default function AlertsScreen() {
  const { t } = useTranslation();
  const n = useNotifications(1, 50);
  const unread = n.notifications.filter((x) => !x.isRead);

  return (
    <div className="space-y-3 p-4 pb-10">
      {unread.length > 0 && (
        <button onClick={() => n.markMultipleAsRead(unread.map((x) => x.id))} className="h-10 text-sm font-medium text-primary">
          {t("m.mark_all_read")} ({unread.length})
        </button>
      )}
      <ListState loading={!!(n as any).isLoading} error={false} onRetry={() => {}} empty={n.notifications.length === 0} emptyTitle={t("m.empty_alerts")}>
        <ul className="space-y-2">
          {n.notifications.map((x) => (
            <li key={x.id}>
              <button onClick={() => !x.isRead && n.markAsRead(x.id)} className={cn("flex w-full items-start gap-3 rounded-xl border p-3 text-start", x.isRead ? "border-border bg-card" : "border-primary/30 bg-accent/50")}>
                <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", x.isRead ? "bg-transparent" : "bg-primary")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cn("block", !x.isRead && "font-semibold")}>{x.title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{x.message}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{formatDistanceToNow(x.createdAt, { addSuffix: true })}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </ListState>
    </div>
  );
}
