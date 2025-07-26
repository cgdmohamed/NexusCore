import { Header } from "@/components/dashboard/Header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";

export default function Analytics() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <Header 
        title={t('nav.analytics')}
        subtitle="View performance metrics and business analytics"
      />
      
      <div className="p-6">
        <Card>
          <CardHeader className="border-b border-gray-200">
            <h3 className="text-lg font-semibold text-text">Analytics Dashboard</h3>
          </CardHeader>
          <CardContent className="p-8">
            <div className="text-center">
              <p className="text-neutral mb-4">Advanced analytics coming soon</p>
              <p className="text-sm text-neutral">
                This module will include detailed reports, charts, and business intelligence features.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
