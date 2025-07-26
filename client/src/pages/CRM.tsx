import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientForm } from "@/components/forms/ClientForm";
import { StatusUpdateForm } from "@/components/forms/StatusUpdateForm";
import { DataExportButton } from "@/components/DataExportButton";
import { Link } from "wouter";
import type { Client } from "@shared/schema";

export default function CRM() {
  const { t } = useTranslation();
  
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["/api/clients"],
  });

  const clientList = clients as Client[];

  return (
    <div className="space-y-6">
      <Header 
        title={t('nav.crm')}
        subtitle="Manage your client relationships and opportunities"
      />
      
      <div className="p-6">
        <Card>
          <CardHeader className="border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text">All Clients</h3>
              <ClientForm />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-neutral">{t('common.loading')}</p>
              </div>
            ) : clientList.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral mb-4">No clients found</p>
                <ClientForm 
                  trigger={
                    <Button variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Add your first client
                    </Button>
                  }
                />
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total Value</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientList.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>
                        <div>
                          {client.email && <p className="text-sm">{client.email}</p>}
                          {client.phone && <p className="text-sm text-neutral">{client.phone}</p>}
                        </div>
                      </TableCell>
                      <TableCell>{client.city}, {client.country}</TableCell>
                      <TableCell>
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
                      <TableCell>${parseFloat(client.totalValue || "0").toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Link href={`/crm/${client.id}`}>
                            <Button variant="outline" size="sm">View Profile</Button>
                          </Link>
                          <StatusUpdateForm
                            entityType="client"
                            entityId={client.id}
                            currentStatus={client.status}
                            trigger={<Button variant="outline" size="sm">Status</Button>}
                          />
                          <DataExportButton 
                            data={[client]} 
                            filename={`client-${client.name.replace(/\s+/g, '-').toLowerCase()}`} 
                            type="csv" 
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
