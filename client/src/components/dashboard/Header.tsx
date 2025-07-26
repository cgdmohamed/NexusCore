import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/lib/i18n";
import { useState } from "react";
import { Search, Bell, Download, ChevronDown } from "lucide-react";
import { ExportModal } from "@/components/modals/ExportModal";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [showExportModal, setShowExportModal] = useState(false);

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

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
            {/* Search */}
            <div className="relative">
              <Input
                type="text"
                placeholder={t('common.search')}
                className="pl-10 pr-4 py-2 w-64"
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-neutral" />
            </div>
            
            {/* Notifications */}
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 bg-accent text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                5
              </span>
            </Button>

            {/* Export Menu */}
            <Button 
              onClick={() => setShowExportModal(true)}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>{t('common.export')}</span>
              <ChevronDown className="h-3 w-3" />
            </Button>

            {/* User Menu */}
            <Button variant="outline" onClick={handleLogout} size="sm">
              {t('auth.logout')}
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
