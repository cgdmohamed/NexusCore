import { Header } from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { Plus } from "lucide-react";

export default function Employees() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <Header 
        title={t('nav.employees')}
        subtitle="Manage employee records and performance"
      />
      
      <div className="p-6">
        <Card>
          <CardHeader className="border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text">All Employees</h3>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Employee
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="text-center">
              <p className="text-neutral mb-4">Employee management coming soon</p>
              <p className="text-sm text-neutral">
                This module will include employee records, performance tracking, and HR management features.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
