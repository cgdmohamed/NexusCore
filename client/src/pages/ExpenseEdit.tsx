import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Simple inline header for now
import { ExpenseForm } from "@/components/forms/ExpenseForm";

export default function ExpenseEdit() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: expense, isLoading } = useQuery({
    queryKey: ["/api/expenses", id],
    enabled: !!id,
  });

  const handleClose = () => {
    setLocation(`/expenses/${id}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-gray-200 pb-4 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Loading...</h1>
          <p className="text-gray-600 mt-1">Please wait while we load the expense details</p>
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded animate-pulse" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-10 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 bg-gray-200 rounded animate-pulse" />
            <div className="h-24 bg-gray-200 rounded animate-pulse" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="space-y-6">
        <div className="border-b border-gray-200 pb-4 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Expense Not Found</h1>
          <p className="text-gray-600 mt-1">The requested expense could not be found</p>
        </div>
        <Card>
          <CardContent className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Expense Not Found</h3>
            <p className="text-gray-500 mb-4">
              The expense you're trying to edit doesn't exist or has been deleted.
            </p>
            <Button onClick={() => setLocation("/expenses")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Expenses
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="border-b border-gray-200 pb-4 mb-6">
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
          <Link href="/expenses" className="hover:text-gray-700">Expenses</Link>
          <span className="mx-2">→</span>
          <Link href={`/expenses/${id}`} className="hover:text-gray-700">{expense.title}</Link>
          <span className="mx-2">→</span>
          <span className="text-gray-900 font-medium">Edit</span>
        </nav>
        <h1 className="text-3xl font-bold text-gray-900">Edit Expense</h1>
        <p className="text-gray-600 mt-1">Editing: {expense.title}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseForm expense={expense} onClose={handleClose} />
        </CardContent>
      </Card>
    </div>
  );
}