import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Summary {
  collections: number;
  collected: number;
  refunds: number;
  refunded: number;
  net: number;
  defaultSource: { id: string; name: string } | null;
}

// Client payments recorded before accounts were linked: offers one confirmed move into the default account
export function UnassignedPaymentsBanner() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { data } = useQuery<Summary>({ queryKey: ["/api/payments/unassigned-summary"] });

  const move = useMutation({
    mutationFn: async (expectedCount: number) => {
      const res = await apiRequest("POST", "/api/payments/assign-default", { expectedCount });
      return res.json();
    },
    onSuccess: (r: { moved: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/unassigned-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-sources/stats"] });
      setOpen(false);
      toast({ title: t("paysrc.migrated", { n: String(r.moved) }) });
    },
    onError: (error: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/unassigned-summary"] });
      toast({ title: "Error", description: error?.message || "Failed to move the payments", variant: "destructive" });
    },
  });

  if (!data || data.collections + data.refunds === 0) return null;
  const count = data.collections + data.refunds;

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="unassigned-banner">
        <div className="flex items-start gap-3">
          <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="font-medium text-foreground">{t("paysrc.unassigned_title", { n: String(count) })}</p>
            <p className="text-sm text-muted-foreground">
              {data.defaultSource ? t("paysrc.unassigned_hint", { name: data.defaultSource.name }) : t("paysrc.unassigned_no_default")}
            </p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} disabled={!data.defaultSource} data-testid="open-migrate">{t("paysrc.migrate")}</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("paysrc.migrate")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>{t("paysrc.confirm_into", { name: data.defaultSource?.name ?? "" })}</p>
            <dl className="space-y-1.5 rounded-md border border-border p-3">
              <div className="flex justify-between"><dt className="text-muted-foreground">{t("paysrc.collections", { n: String(data.collections) })}</dt><dd className="tabular-nums text-success">+ {formatCurrency(data.collected)}</dd></div>
              {data.refunds > 0 && (
                <div className="flex justify-between"><dt className="text-muted-foreground">{t("paysrc.refunds", { n: String(data.refunds) })}</dt><dd className="tabular-nums text-danger">− {formatCurrency(data.refunded)}</dd></div>
              )}
              <div className="flex justify-between border-t border-border pt-1.5 font-semibold"><dt>{t("paysrc.net")}</dt><dd className="tabular-nums">{formatCurrency(data.net)}</dd></div>
            </dl>
            <p className="text-xs text-muted-foreground">{t("paysrc.migrate_warning")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => move.mutate(count)} disabled={move.isPending} data-testid="confirm-migrate">{t("paysrc.migrate_confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
