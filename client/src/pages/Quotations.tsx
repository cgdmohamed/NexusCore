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

export default function Quotations() {
  const { t } = useTranslation();
  
  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ["/api/quotations"],
  });

  return (
    <div className="space-y-6">
      <Header 
        title={t('nav.quotations')}
        subtitle="Create and manage quotations for your clients"
      />
      
      <div className="p-6">
        <Card>
          <CardHeader className="border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text">All Quotations</h3>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Create Quotation
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-neutral">{t('common.loading')}</p>
              </div>
            ) : quotations.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral mb-4">No quotations found</p>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first quotation
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Quotation #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.map((quotation: any) => (
                    <TableRow key={quotation.id}>
                      <TableCell className="font-medium">{quotation.quotationNumber}</TableCell>
                      <TableCell>{quotation.title}</TableCell>
                      <TableCell>${parseFloat(quotation.amount).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={
                            quotation.status === 'accepted' 
                              ? 'bg-green-100 text-secondary border-green-200' :
                            quotation.status === 'sent'
                              ? 'bg-blue-100 text-blue-700 border-blue-200' :
                            quotation.status === 'rejected'
                              ? 'bg-red-100 text-accent border-red-200' :
                              'bg-yellow-100 text-yellow-700 border-yellow-200'
                          }
                        >
                          {quotation.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {quotation.validUntil ? formatDistanceToNow(new Date(quotation.validUntil), { addSuffix: true }) : 'No expiry'}
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(quotation.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">Edit</Button>
                          <Button variant="outline" size="sm">Export</Button>
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
