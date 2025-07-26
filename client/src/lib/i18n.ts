import { useState, useEffect } from 'react';

export type Language = 'en' | 'ar';

interface Translations {
  [key: string]: {
    [lang in Language]: string;
  };
}

const translations: Translations = {
  // Navigation
  'nav.dashboard': { en: 'Dashboard', ar: 'لوحة القيادة' },
  'nav.crm': { en: 'CRM', ar: 'إدارة العملاء' },
  'nav.quotations': { en: 'Quotations', ar: 'عروض الأسعار' },
  'nav.invoices': { en: 'Invoices', ar: 'الفواتير' },
  'nav.expenses': { en: 'Expenses', ar: 'المصروفات' },
  'nav.payment_sources': { en: 'Payment Sources', ar: 'مصادر الدفع' },
  'nav.employees': { en: 'Employees', ar: 'الموظفون' },
  'nav.tasks': { en: 'Tasks', ar: 'المهام' },
  'nav.analytics': { en: 'Analytics', ar: 'التحليلات' },
  
  // Dashboard
  'dashboard.title': { en: 'Dashboard Overview', ar: 'نظرة عامة على لوحة القيادة' },
  'dashboard.welcome': { en: 'Welcome back, {{name}}. Here\'s what\'s happening today.', ar: 'أهلاً بعودتك، {{name}}. إليك ما يحدث اليوم.' },
  'dashboard.totalRevenue': { en: 'Total Revenue', ar: 'إجمالي الإيرادات' },
  'dashboard.activeClients': { en: 'Active Clients', ar: 'العملاء النشطون' },
  'dashboard.pendingInvoices': { en: 'Pending Invoices', ar: 'الفواتير المعلقة' },
  'dashboard.teamPerformance': { en: 'Team Performance', ar: 'أداء الفريق' },
  
  // Common
  'common.search': { en: 'Search...', ar: 'بحث...' },
  'common.export': { en: 'Export', ar: 'تصدير' },
  'common.create': { en: 'Create', ar: 'إنشاء' },
  'common.edit': { en: 'Edit', ar: 'تعديل' },
  'common.delete': { en: 'Delete', ar: 'حذف' },
  'common.save': { en: 'Save', ar: 'حفظ' },
  'common.cancel': { en: 'Cancel', ar: 'إلغاء' },
  'common.loading': { en: 'Loading...', ar: 'جاري التحميل...' },
  'common.error': { en: 'Error', ar: 'خطأ' },
  'common.success': { en: 'Success', ar: 'نجح' },
  
  // Auth
  'auth.login': { en: 'Login', ar: 'تسجيل الدخول' },
  'auth.logout': { en: 'Logout', ar: 'تسجيل الخروج' },
  'auth.welcome': { en: 'Welcome to CompanyOS', ar: 'مرحباً بك في CompanyOS' },
  'auth.getStarted': { en: 'Get Started', ar: 'ابدأ الآن' },
};

export function useTranslation() {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string, params?: Record<string, string>) => {
    const translation = translations[key]?.[language] || key;
    
    if (params) {
      return Object.entries(params).reduce(
        (acc, [param, value]) => acc.replace(`{{${param}}}`, value),
        translation
      );
    }
    
    return translation;
  };

  const changeLanguage = (newLanguage: Language) => {
    setLanguage(newLanguage);
  };

  return { t, language, changeLanguage };
}
