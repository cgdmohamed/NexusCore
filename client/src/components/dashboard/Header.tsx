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
      <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-semibold text-text truncate">{title}</h2>
            {subtitle && (
              <p className="text-neutral text-sm mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            {actions}
            {!hideExport && (
              <>
                {/* Icon-only on mobile */}
                <Button
                  onClick={() => setShowExportModal(true)}
                  size="sm"
                  className="md:hidden h-9 w-9 p-0"
                  title={t('common.export')}
                >
                  <Download className="h-4 w-4" />
                </Button>
                {/* Full button on desktop */}
                <Button
                  onClick={() => setShowExportModal(true)}
                  className="hidden md:flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>{t('common.export')}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {!hideExport && (
        <ExportModal 
          open={showExportModal} 
          onOpenChange={setShowExportModal} 
        />
      )}
    </>
  );
}
