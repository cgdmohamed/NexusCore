import { useState, useEffect } from 'react';

export type Language = 'en' | 'ar';


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
