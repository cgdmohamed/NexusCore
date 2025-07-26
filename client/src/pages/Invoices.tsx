import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceForm } from "@/components/forms/InvoiceForm";
import { StatusUpdateForm } from "@/components/forms/StatusUpdateForm";
import { DataExportButton } from "@/components/DataExportButton";
import type { Invoice } from "@shared/schema";

export default function Invoices() {
  const { t } = useTranslation();
  
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["/api/invoices"],
  });

  const invoiceList = invoices as Invoice[];

  return (
    <div className="space-y-6">
      <Header 
        title={t('nav.invoices')}
        subtitle="Track payments and manage invoice status"
      />
      
      <div className="p-6">
        <Card>
          <CardHeader className="border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text">All Invoices</h3>
              <InvoiceForm />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-neutral">{t('common.loading')}</p>
              </div>
            ) : invoiceList.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral mb-4">No invoices found</p>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first invoice
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoiceList.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>${parseFloat(invoice.amount).toLocaleString()}</TableCell>
                      <TableCell>${parseFloat(invoice.paidAmount || "0").toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={
                            invoice.status === 'paid' 
                              ? 'bg-green-100 text-secondary border-green-200' :
                            invoice.status === 'overdue'
                              ? 'bg-red-100 text-accent border-red-200' :
                            invoice.status === 'cancelled'
                              ? 'bg-gray-100 text-gray-700 border-gray-200' :
                              'bg-yellow-100 text-yellow-700 border-yellow-200'
                          }
                        >
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {invoice.dueDate ? formatDistanceToNow(new Date(invoice.dueDate), { addSuffix: true }) : 'No due date'}
                      </TableCell>
                      <TableCell>
                        {invoice.createdAt ? formatDistanceToNow(new Date(invoice.createdAt), { addSuffix: true }) : 'No date'}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <StatusUpdateForm
                            entityType="invoice"
                            entityId={invoice.id}
                            currentStatus={invoice.status}
                            trigger={<Button variant="outline" size="sm">Status</Button>}
                          />
                          <DataExportButton 
                            data={[invoice]} 
                            filename={`invoice-${invoice.invoiceNumber}`} 
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
