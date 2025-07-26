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
import { ExpenseForm } from "@/components/forms/ExpenseForm";
import { StatusUpdateForm } from "@/components/forms/StatusUpdateForm";
import type { Expense } from "@shared/schema";

export default function Expenses() {
  const { t } = useTranslation();
  
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["/api/expenses"],
  });

  const expenseList = expenses as Expense[];

  return (
    <div className="space-y-6">
      <Header 
        title={t('nav.expenses')}
        subtitle="Log and track company expenses"
      />
      
      <div className="p-6">
        <Card>
          <CardHeader className="border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text">All Expenses</h3>
              <ExpenseForm />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-neutral">{t('common.loading')}</p>
              </div>
            ) : expenseList.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral mb-4">No expenses found</p>
                <ExpenseForm 
                  trigger={
                    <Button variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Log your first expense
                    </Button>
                  }
                />
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expense Date</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseList.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.title}</TableCell>
                      <TableCell className="capitalize">{expense.category}</TableCell>
                      <TableCell>${parseFloat(expense.amount).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={
                            expense.status === 'approved' 
                              ? 'bg-green-100 text-secondary border-green-200' :
                            expense.status === 'rejected'
                              ? 'bg-red-100 text-accent border-red-200' :
                              'bg-yellow-100 text-yellow-700 border-yellow-200'
                          }
                        >
                          {expense.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {expense.createdAt ? formatDistanceToNow(new Date(expense.createdAt), { addSuffix: true }) : 'No date'}
                      </TableCell>
                      <TableCell>
                        {expense.createdAt ? formatDistanceToNow(new Date(expense.createdAt), { addSuffix: true }) : 'No date'}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <StatusUpdateForm
                            entityType="expense"
                            entityId={expense.id}
                            currentStatus={expense.status}
                            trigger={<Button variant="outline" size="sm">Status</Button>}
                          />
                          <Button variant="outline" size="sm">View</Button>
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
