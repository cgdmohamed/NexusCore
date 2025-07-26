import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import { Building, BarChart3, Users, FileText } from "lucide-react";

export default function Landing() {
  const { t } = useTranslation();

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="text-center space-y-6">
            {/* Logo */}
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
                <Building className="text-white text-2xl w-8 h-8" />
              </div>
            </div>
            
            {/* Title */}
            <div>
              <h1 className="text-3xl font-bold text-text mb-2">
                {t('auth.welcome')}
              </h1>
              <p className="text-neutral">
                Comprehensive internal company management system
              </p>
            </div>
            
            {/* Features */}
            <div className="grid grid-cols-3 gap-4 py-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <BarChart3 className="text-primary w-6 h-6" />
                </div>
                <p className="text-xs text-neutral">Analytics</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Users className="text-secondary w-6 h-6" />
                </div>
                <p className="text-xs text-neutral">CRM</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <FileText className="text-purple-600 w-6 h-6" />
                </div>
                <p className="text-xs text-neutral">Documents</p>
              </div>
            </div>
            
            {/* Login Button */}
            <Button 
              onClick={handleLogin}
              className="w-full py-6 text-lg"
              size="lg"
            >
              {t('auth.getStarted')}
            </Button>
            
            {/* Features List */}
            <div className="text-left space-y-2 pt-4 border-t">
              <p className="text-sm text-neutral">✓ Multi-module dashboard</p>
              <p className="text-sm text-neutral">✓ Role-based access control</p>
              <p className="text-sm text-neutral">✓ KPI tracking & analytics</p>
              <p className="text-sm text-neutral">✓ Document export capabilities</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
