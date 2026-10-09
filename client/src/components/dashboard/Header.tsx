import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useState } from "react";
import { Download } from "lucide-react";
import { ExportModal } from "@/components/modals/ExportModal";

interface HeaderProps {
  title: string;
  subtitle?: string;
  hideExport?: boolean;
  actions?: ReactNode;
}

export function Header({ title, subtitle, hideExport, actions }: HeaderProps) {
  const { t } = useTranslation();
  const [showExportModal, setShowExportModal] = useState(false);

  return (
    <>
      <div className="border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {!hideExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportModal(true)}
                className="h-9 gap-2"
                title={t('common.export')}
              >
                <Download className="h-4 w-4" />
                <span className="hidden md:inline">{t('common.export')}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {!hideExport && (
        <ExportModal 
          open={showExportModal} 
          onOpenChange={setShowExportModal} 
        />
      )}
    </>
  );
}
