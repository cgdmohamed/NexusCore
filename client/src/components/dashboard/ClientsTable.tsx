import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { Client } from "@shared/schema";
import { formatCurrency } from "@/lib/currency";

export function ClientsTable() {
  const { t } = useTranslation();
  
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["/api/clients"],
  });

  const clientList = clients as Client[];

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="border-b border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <div className="flex space-x-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-3 p-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const recentClients = clientList.slice(0, 3);

  return (
    <Card>
      <CardHeader className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{t("dash.recent_clients")}</h3>
          <Link href="/clients" className="text-sm text-primary hover:underline">{t("common.viewAll")}</Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {recentClients.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("dash.no_clients")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5 text-xs font-medium text-muted-foreground">{t("dash.client")}</TableHead>
                <TableHead className="px-5 text-xs font-medium text-muted-foreground">{t("common.status")}</TableHead>
                <TableHead className="px-5 text-end text-xs font-medium text-muted-foreground">{t("dash.value")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="px-5 py-3">
                    <p className="text-sm font-medium text-foreground">{client.name}</p>
                    <p className="text-xs text-muted-foreground">{[client.city, client.country].filter(Boolean).join(", ")}</p>
                  </TableCell>
                  <TableCell className="px-5 py-3">
                    <Badge
                      variant="secondary"
                      className={client.status === 'active' ? 'bg-success-soft text-success hover:bg-success-soft' : 'bg-muted text-muted-foreground hover:bg-muted'}
                    >
                      {t(`status.${client.status}`) === `status.${client.status}` ? client.status : t(`status.${client.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-5 py-3 text-end text-sm font-medium tabular-nums text-foreground">
                    {formatCurrency(client.totalValue || "0")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
