import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
        <CardHeader className="border-b border-gray-200">
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
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text">Recent Clients</h3>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              Filter
            </Button>
            <Button size="sm">
              {t('common.export')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {recentClients.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-neutral">No clients found</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="px-6 py-3 text-xs font-medium text-neutral uppercase tracking-wider">
                  Client
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-medium text-neutral uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-medium text-neutral uppercase tracking-wider">
                  Value
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-text">{client.name}</p>
                      <p className="text-sm text-neutral">{client.city}, {client.country}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge 
                      variant={client.status === 'active' ? 'default' : 'secondary'}
                      className={
                        client.status === 'active' 
                          ? 'bg-green-100 text-secondary hover:bg-green-100' 
                          : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'
                      }
                    >
                      {client.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm text-text">
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
