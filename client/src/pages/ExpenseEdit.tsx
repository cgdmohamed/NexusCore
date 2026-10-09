import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/dashboard/Header";
import { useTranslation } from "@/lib/i18n";
import { ExpenseForm } from "@/components/forms/ExpenseForm";
import type { Expense } from "@shared/schema";

export default function ExpenseEdit() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const { data: expense, isLoading } = useQuery<Expense>({
    queryKey: ["/api/expenses", id],
    enabled: !!id,
  });

  const handleClose = () => {
    setLocation(`/expenses/${id}`);
  };

  if (isLoading) {
    return (
      <div>
        <Header 
          title="Loading..."
          subtitle="Please wait while we load the expense details"
        />
        <Card>
          <CardHeader>
            <div className="h-6 bg-muted rounded animate-pulse" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-10 bg-muted rounded animate-pulse" />
            <div className="h-10 bg-muted rounded animate-pulse" />
            <div className="h-24 bg-muted rounded animate-pulse" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!expense) {
    return (
      <div>
        <Header 
          title="Expense Not Found"
          subtitle="The requested expense could not be found"
        />
        <Card>
          <CardContent className="text-center py-12">
            <h3 className="text-lg font-medium text-foreground mb-2">Expense Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The expense you're trying to edit doesn't exist or has been deleted.
            </p>
            <Button onClick={() => setLocation("/expenses")}>
              <ArrowLeft className="h-4 w-4 me-2 rtl:-scale-x-100" />
              Back to Expenses
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Header 
        title="Edit Expense"
        subtitle={`Editing: ${expense.title}`}
      />

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
