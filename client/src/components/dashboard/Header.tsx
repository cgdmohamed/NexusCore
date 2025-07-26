import { Button } from "@/components/ui/button";


import { useTranslation } from "@/lib/i18n";
import { useState } from "react";
import { Download, ChevronDown } from "lucide-react";
import { ExportModal } from "@/components/modals/ExportModal";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { t } = useTranslation();
  const [showExportModal, setShowExportModal] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-text">{title}</h2>
            {subtitle && (
              <p className="text-neutral text-sm mt-1">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {/* Export Menu */}
            <Button 
              onClick={() => setShowExportModal(true)}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>{t('common.export')}</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </header>

      <ExportModal 
        open={showExportModal} 
        onOpenChange={setShowExportModal} 
      />
    </>
  );
}
