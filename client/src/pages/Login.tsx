import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { 
  Building, 
  BarChart3, 
  Users, 
  FileText, 
  Shield, 
  Globe,
  Moon,
  Sun,
  LogIn,
  CheckCircle,
  ArrowRight,
  Loader2
} from "lucide-react";

export default function Login() {
  const { t, language, changeLanguage } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      setLocation("/");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  // Dark mode toggle
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    document.documentElement.classList.toggle('dark', newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  const toggleLanguage = () => {
    changeLanguage(language === 'en' ? 'ar' : 'en');
  };

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      // Start OIDC authentication flow
      window.location.href = "/api/login";
    } catch (error) {
      console.error("Login error:", error);
      setLoginLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: BarChart3,
      title: language === 'en' ? 'Analytics & KPIs' : 'التحليلات ومؤشرات الأداء',
      description: language === 'en' ? 'Real-time business intelligence' : 'ذكاء الأعمال في الوقت الفعلي',
      color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
    },
    {
      icon: Users,
      title: language === 'en' ? 'Client Management' : 'إدارة العملاء',
      description: language === 'en' ? 'Complete CRM solution' : 'حل إدارة علاقات عملاء شامل',
      color: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
    },
    {
      icon: FileText,
      title: language === 'en' ? 'Document Management' : 'إدارة الوثائق',
      description: language === 'en' ? 'Invoices, quotes & reports' : 'الفواتير والعروض والتقارير',
      color: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
    },
    {
      icon: Shield,
      title: language === 'en' ? 'Secure & Compliant' : 'آمن ومطابق للمعايير',
      description: language === 'en' ? 'Role-based access control' : 'التحكم في الوصول بناء على الأدوار',
      color: 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
    }
  ];

  const capabilities = [
    { text: language === 'en' ? 'Multi-module dashboard' : 'لوحة قيادة متعددة الوحدات', completed: true },
    { text: language === 'en' ? 'Role-based access control' : 'التحكم في الوصول حسب الدور', completed: true },
    { text: language === 'en' ? 'KPI tracking & analytics' : 'تتبع مؤشرات الأداء والتحليلات', completed: true },
    { text: language === 'en' ? 'Document export capabilities' : 'قدرات تصدير المستندات', completed: true },
    { text: language === 'en' ? 'Real-time collaboration' : 'التعاون في الوقت الفعلي', completed: true },
    { text: language === 'en' ? 'Arabic & English support' : 'دعم العربية والإنجليزية', completed: true }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      {/* Header with Language and Theme Toggle */}
      <div className="absolute top-4 right-4 flex items-center space-x-3 rtl:space-x-reverse rtl:left-4 rtl:right-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLanguage}
          className="text-muted-foreground hover:text-foreground"
        >
          <Globe className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
          {language === 'en' ? 'العربية' : 'English'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleDarkMode}
          className="text-muted-foreground hover:text-foreground"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </div>

      <div className="container mx-auto px-4 py-8 min-h-screen">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-screen">
          
          {/* Left Side - Company Branding & Info */}
          <div className="space-y-8 lg:pr-8 rtl:lg:pr-0 rtl:lg:pl-8">
            {/* Logo and Company Info */}
            <div className="text-center lg:text-left rtl:lg:text-right">
              <div className="flex justify-center lg:justify-start rtl:lg:justify-end mb-6">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg">
                  <Building className="text-white w-10 h-10" />
                </div>
              </div>
              
              <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-4">
                CompanyOS
              </h1>
              
              <p className="text-xl text-muted-foreground mb-6 leading-relaxed">
                {language === 'en' 
                  ? 'Comprehensive internal company management system designed to streamline business operations with advanced employee management, financial tracking, and organizational insights.'
                  : 'نظام إدارة داخلي شامل للشركات مصمم لتبسيط العمليات التجارية مع إدارة متقدمة للموظفين وتتبع مالي ورؤى تنظيمية.'
                }
              </p>

              <div className="flex flex-wrap gap-2 justify-center lg:justify-start rtl:lg:justify-end">
                <Badge variant="secondary" className="px-3 py-1">
                  {language === 'en' ? 'Enterprise Ready' : 'جاهز للمؤسسات'}
                </Badge>
                <Badge variant="secondary" className="px-3 py-1">
                  {language === 'en' ? 'Multi-language' : 'متعدد اللغات'}
                </Badge>
                <Badge variant="secondary" className="px-3 py-1">
                  {language === 'en' ? 'Cloud Based' : 'قائم على السحابة'}
                </Badge>
              </div>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <div key={index} className="p-4 rounded-xl border bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-200">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 ${feature.color}`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>

            {/* Capabilities List */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">
                {language === 'en' ? 'Platform Capabilities' : 'قدرات المنصة'}
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {capabilities.map((capability, index) => (
                  <div key={index} className="flex items-center space-x-3 rtl:space-x-reverse">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{capability.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side - Login Card */}
          <div className="flex justify-center lg:justify-end rtl:lg:justify-start">
            <Card className="w-full max-w-md shadow-2xl border-0 bg-background/80 backdrop-blur-xl">
              <CardHeader className="pb-8 pt-8">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                    <LogIn className="text-white w-8 h-8" />
                  </div>
                  
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      {t('auth.welcome')}
                    </h2>
                    <p className="text-muted-foreground">
                      {language === 'en' 
                        ? 'Sign in to access your company dashboard and manage your business operations.'
                        : 'سجل الدخول للوصول إلى لوحة قيادة شركتك وإدارة عملياتك التجارية.'
                      }
                    </p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pb-8 px-8">
                <div className="space-y-6">
                  {/* Security Notice */}
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start space-x-3 rtl:space-x-reverse">
                      <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-900 dark:text-blue-100 text-sm">
                          {language === 'en' ? 'Secure Authentication' : 'مصادقة آمنة'}
                        </h4>
                        <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
                          {language === 'en' 
                            ? 'Your login is protected by enterprise-grade security protocols.'
                            : 'تسجيل دخولك محمي ببروتوكولات الأمان على مستوى المؤسسات.'
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Login Button */}
                  <Button 
                    onClick={handleLogin}
                    disabled={loginLoading}
                    className="w-full py-6 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
                    size="lg"
                  >
                    {loginLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0 animate-spin" />
                        {language === 'en' ? 'Signing in...' : 'جاري تسجيل الدخول...'}
                      </>
                    ) : (
                      <>
                        {t('auth.getStarted')}
                        <ArrowRight className="w-5 h-5 ml-2 rtl:mr-2 rtl:ml-0" />
                      </>
                    )}
                  </Button>

                  {/* Additional Info */}
                  <div className="text-center space-y-3 pt-4 border-t">
                    <p className="text-xs text-muted-foreground">
                      {language === 'en' 
                        ? 'By signing in, you agree to our Terms of Service and Privacy Policy.'
                        : 'بتسجيل الدخول، فإنك توافق على شروط الخدمة وسياسة الخصوصية.'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}