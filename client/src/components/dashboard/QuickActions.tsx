import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { PlusCircle, UserPlus, Receipt, CheckSquare } from "lucide-react";
import { Link } from "wouter";

export function QuickActions() {
  const { t } = useTranslation();

  const actions = [
    {
      icon: PlusCircle,
      label: "Create Quotation",
      href: "/quotations",
      color: "text-primary",
    },
    {
      icon: UserPlus,
      label: "Add New Client",
      href: "/crm",
      color: "text-secondary",
    },
    {
      icon: Receipt,
      label: "Log Expense",
      href: "/expenses",
      color: "text-purple-600",
    },
    {
      icon: CheckSquare,
      label: "Assign Task",
      href: "/tasks",
      color: "text-yellow-600",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold text-text">Quick Actions</h3>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          
          return (
            <Link key={index} href={action.href}>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto p-3"
              >
                <Icon className={`${action.color} w-5 h-5`} />
                <span className="text-text">{action.label}</span>
              </Button>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
