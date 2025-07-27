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
  'nav.clients': { en: 'Clients', ar: 'العملاء' },
  'nav.quotations': { en: 'Quotations', ar: 'عروض الأسعار' },
  'nav.invoices': { en: 'Invoices', ar: 'الفواتير' },
  'nav.payments': { en: 'Payments', ar: 'المدفوعات' },
  'nav.expenses': { en: 'Expenses', ar: 'المصروفات' },
  'nav.tasks': { en: 'Tasks', ar: 'المهام' },
  'nav.team_roles': { en: 'Team & Roles', ar: 'الفريق والأدوار' },
  'nav.reports_kpis': { en: 'Reports & KPIs', ar: 'التقارير ومؤشرات الأداء' },
  'nav.services': { en: 'Services & Offerings', ar: 'الخدمات والعروض' },
  
  // Services
  'services.title': { en: 'Services & Offerings', ar: 'الخدمات والعروض' },
  'services.subtitle': { en: 'Manage your service catalog and pricing', ar: 'إدارة كتالوج الخدمات والأسعار' },
  'services.add_service': { en: 'Add Service', ar: 'إضافة خدمة' },
  'services.edit_service': { en: 'Edit Service', ar: 'تعديل الخدمة' },
  'services.add_first_service': { en: 'Add Your First Service', ar: 'إضافة أول خدمة' },
  'services.no_services': { en: 'No Services Yet', ar: 'لا توجد خدمات بعد' },
  'services.no_services_desc': { en: 'Get started by adding your first service offering', ar: 'ابدأ بإضافة أول عرض خدمة' },
  'services.total_services': { en: 'Total Services', ar: 'إجمالي الخدمات' },
  'services.active_services': { en: 'Active Services', ar: 'الخدمات النشطة' },
  'services.name': { en: 'Service Name', ar: 'اسم الخدمة' },
  'services.description': { en: 'Description', ar: 'الوصف' },
  'services.category': { en: 'Category', ar: 'الفئة' },
  'services.default_price': { en: 'Default Price', ar: 'السعر الافتراضي' },
  'services.price': { en: 'Price', ar: 'السعر' },
  'services.name_placeholder': { en: 'Enter service name', ar: 'أدخل اسم الخدمة' },
  'services.description_placeholder': { en: 'Enter service description', ar: 'أدخل وصف الخدمة' },
  'services.select_category': { en: 'Select category', ar: 'اختر الفئة' },
  'services.delete_confirm': { en: 'Are you sure you want to delete {{name}}?', ar: 'هل أنت متأكد من حذف {{name}}؟' },
  'services.delete_success': { en: 'Service Deleted', ar: 'تم حذف الخدمة' },
  'services.service_deleted': { en: 'Service has been successfully deleted', ar: 'تم حذف الخدمة بنجاح' },
  'services.delete_error': { en: 'Failed to delete service', ar: 'فشل في حذف الخدمة' },
  'services.create_success': { en: 'Service Created', ar: 'تم إنشاء الخدمة' },
  'services.service_created': { en: 'Service has been successfully created', ar: 'تم إنشاء الخدمة بنجاح' },
  'services.create_error': { en: 'Failed to create service', ar: 'فشل في إنشاء الخدمة' },
  'services.update_success': { en: 'Service Updated', ar: 'تم تحديث الخدمة' },
  'services.service_updated': { en: 'Service has been successfully updated', ar: 'تم تحديث الخدمة بنجاح' },
  'services.update_error': { en: 'Failed to update service', ar: 'فشل في تحديث الخدمة' },
  'nav.notifications': { en: 'Notifications', ar: 'الإشعارات' },
  
  // Dashboard
  'dashboard.title': { en: 'Dashboard Overview', ar: 'نظرة عامة على لوحة القيادة' },
  'dashboard.welcome': { en: 'Welcome back, {{name}}. Here\'s what\'s happening today.', ar: 'أهلاً بعودتك، {{name}}. إليك ما يحدث اليوم.' },
  'dashboard.totalRevenue': { en: 'Total Revenue', ar: 'إجمالي الإيرادات' },
  'dashboard.activeClients': { en: 'Active Clients', ar: 'العملاء النشطون' },
  'dashboard.pendingInvoices': { en: 'Pending Invoices', ar: 'الفواتير المعلقة' },
  'dashboard.teamPerformance': { en: 'Team Performance', ar: 'أداء الفريق' },
  'dashboard.recentActivities': { en: 'Recent Activities', ar: 'الأنشطة الأخيرة' },
  'dashboard.quickActions': { en: 'Quick Actions', ar: 'إجراءات سريعة' },
  
  // Common
  'common.search': { en: 'Search...', ar: 'بحث...' },
  'common.searchPlaceholder': { en: 'Search clients, invoices, tasks...', ar: 'البحث في العملاء والفواتير والمهام...' },
  'common.export': { en: 'Export', ar: 'تصدير' },
  'common.create': { en: 'Create', ar: 'إنشاء' },
  'common.add': { en: 'Add', ar: 'إضافة' },
  'common.edit': { en: 'Edit', ar: 'تعديل' },
  'common.delete': { en: 'Delete', ar: 'حذف' },
  'common.save': { en: 'Save', ar: 'حفظ' },
  'common.cancel': { en: 'Cancel', ar: 'إلغاء' },
  'common.confirm': { en: 'Confirm', ar: 'تأكيد' },
  'common.loading': { en: 'Loading...', ar: 'جاري التحميل...' },
  'common.error': { en: 'Error', ar: 'خطأ' },
  'common.success': { en: 'Success', ar: 'نجح' },
  'common.noResults': { en: 'No results found', ar: 'لا توجد نتائج' },
  'common.viewAll': { en: 'View All', ar: 'عرض الكل' },
  'common.view': { en: 'View', ar: 'عرض' },
  'common.update': { en: 'Update', ar: 'تحديث' },
  'common.filter': { en: 'Filter', ar: 'تصفية' },
  'common.sort': { en: 'Sort', ar: 'ترتيب' },
  'common.status': { en: 'Status', ar: 'الحالة' },
  'common.date': { en: 'Date', ar: 'التاريخ' },
  'common.amount': { en: 'Amount', ar: 'المبلغ' },
  'common.total': { en: 'Total', ar: 'المجموع' },
  'common.name': { en: 'Name', ar: 'الاسم' },
  'common.email': { en: 'Email', ar: 'البريد الإلكتروني' },
  'common.phone': { en: 'Phone', ar: 'الهاتف' },
  'common.address': { en: 'Address', ar: 'العنوان' },
  'common.description': { en: 'Description', ar: 'الوصف' },
  'common.notes': { en: 'Notes', ar: 'الملاحظات' },
  'common.actions': { en: 'Actions', ar: 'الإجراءات' },
  
  // Auth
  'auth.login': { en: 'Login', ar: 'تسجيل الدخول' },
  'auth.logout': { en: 'Logout', ar: 'تسجيل الخروج' },
  'auth.welcome': { en: 'Welcome to CompanyOS', ar: 'مرحباً بك في CompanyOS' },
  'auth.getStarted': { en: 'Sign In to Continue', ar: 'سجل الدخول للمتابعة' },
  'auth.signIn': { en: 'Sign In', ar: 'تسجيل الدخول' },
  'auth.signingIn': { en: 'Signing in...', ar: 'جاري تسجيل الدخول...' },
  'auth.secureLogin': { en: 'Secure Login', ar: 'تسجيل دخول آمن' },
  
  // CRM
  'crm.title': { en: 'Customer Relationship Management', ar: 'إدارة علاقات العملاء' },
  'crm.clients': { en: 'Clients', ar: 'العملاء' },
  'crm.addClient': { en: 'Add Client', ar: 'إضافة عميل' },
  'crm.clientName': { en: 'Client Name', ar: 'اسم العميل' },
  'crm.company': { en: 'Company', ar: 'الشركة' },
  'crm.industry': { en: 'Industry', ar: 'الصناعة' },
  'crm.leadSource': { en: 'Lead Source', ar: 'مصدر العميل المحتمل' },
  'crm.clientValue': { en: 'Client Value', ar: 'قيمة العميل' },
  'crm.active': { en: 'Active', ar: 'نشط' },
  'crm.inactive': { en: 'Inactive', ar: 'غير نشط' },
  'crm.lead': { en: 'Lead', ar: 'عميل محتمل' },
  
  // Quotations
  'quotations.title': { en: 'Quotations', ar: 'عروض الأسعار' },
  'quotations.createQuotation': { en: 'Create Quotation', ar: 'إنشاء عرض سعر' },
  'quotations.quotationNumber': { en: 'Quotation Number', ar: 'رقم عرض السعر' },
  'quotations.client': { en: 'Client', ar: 'العميل' },
  'quotations.validUntil': { en: 'Valid Until', ar: 'صالح حتى' },
  'quotations.items': { en: 'Items', ar: 'العناصر' },
  'quotations.service': { en: 'Service', ar: 'الخدمة' },
  'quotations.quantity': { en: 'Quantity', ar: 'الكمية' },
  'quotations.price': { en: 'Price', ar: 'السعر' },
  'quotations.draft': { en: 'Draft', ar: 'مسودة' },
  'quotations.sent': { en: 'Sent', ar: 'مرسل' },
  'quotations.accepted': { en: 'Accepted', ar: 'مقبول' },
  'quotations.rejected': { en: 'Rejected', ar: 'مرفوض' },
  'quotations.expired': { en: 'Expired', ar: 'منتهي الصلاحية' },
  
  // Invoices
  'invoices.title': { en: 'Invoices', ar: 'الفواتير' },
  'invoices.createInvoice': { en: 'Create Invoice', ar: 'إنشاء فاتورة' },
  'invoices.invoiceNumber': { en: 'Invoice Number', ar: 'رقم الفاتورة' },
  'invoices.dueDate': { en: 'Due Date', ar: 'تاريخ الاستحقاق' },
  'invoices.paid': { en: 'Paid', ar: 'مدفوع' },
  'invoices.pending': { en: 'Pending', ar: 'معلق' },
  'invoices.overdue': { en: 'Overdue', ar: 'متأخر' },
  'invoices.partial': { en: 'Partial', ar: 'جزئي' },
  'invoices.paymentDate': { en: 'Payment Date', ar: 'تاريخ الدفع' },
  'invoices.paymentMethod': { en: 'Payment Method', ar: 'طريقة الدفع' },
  'invoices.subtotal': { en: 'Subtotal', ar: 'المجموع الفرعي' },
  'invoices.tax': { en: 'Tax', ar: 'الضريبة' },
  'invoices.totalAmount': { en: 'Total Amount', ar: 'المبلغ الإجمالي' },
  
  // Expenses
  'expenses.title': { en: 'Expenses', ar: 'المصروفات' },
  'expenses.addExpense': { en: 'Add Expense', ar: 'إضافة مصروف' },
  'expenses.expenseTitle': { en: 'Expense Title', ar: 'عنوان المصروف' },
  'expenses.category': { en: 'Category', ar: 'الفئة' },
  'expenses.receipt': { en: 'Receipt', ar: 'الإيصال' },
  'expenses.uploadReceipt': { en: 'Upload Receipt', ar: 'رفع الإيصال' },
  'expenses.recurring': { en: 'Recurring', ar: 'متكرر' },
  'expenses.approved': { en: 'Approved', ar: 'موافق عليه' },
  'expenses.rejected': { en: 'Rejected', ar: 'مرفوض' },
  
  // Payment Sources
  'paymentSources.title': { en: 'Payment Sources', ar: 'مصادر الدفع' },
  'paymentSources.addSource': { en: 'Add Payment Source', ar: 'إضافة مصدر دفع' },
  'paymentSources.sourceName': { en: 'Source Name', ar: 'اسم المصدر' },
  'paymentSources.accountType': { en: 'Account Type', ar: 'نوع الحساب' },
  'paymentSources.balance': { en: 'Balance', ar: 'الرصيد' },
  'paymentSources.bank': { en: 'Bank', ar: 'بنك' },
  'paymentSources.cash': { en: 'Cash', ar: 'نقد' },
  'paymentSources.wallet': { en: 'Wallet', ar: 'محفظة' },
  
  // Tasks
  'tasks.title': { en: 'Tasks', ar: 'المهام' },
  'tasks.createTask': { en: 'Create Task', ar: 'إنشاء مهمة' },
  'tasks.taskTitle': { en: 'Task Title', ar: 'عنوان المهمة' },
  'tasks.assignedTo': { en: 'Assigned To', ar: 'مكلف به' },
  'tasks.priority': { en: 'Priority', ar: 'الأولوية' },
  'tasks.dueDate': { en: 'Due Date', ar: 'تاريخ الاستحقاق' },
  'tasks.todo': { en: 'To Do', ar: 'للقيام به' },
  'tasks.inProgress': { en: 'In Progress', ar: 'قيد التنفيذ' },
  'tasks.completed': { en: 'Completed', ar: 'مكتمل' },
  'tasks.high': { en: 'High', ar: 'عالية' },
  'tasks.medium': { en: 'Medium', ar: 'متوسطة' },
  'tasks.low': { en: 'Low', ar: 'منخفضة' },
  
  // Employees
  'employees.title': { en: 'Employees', ar: 'الموظفون' },
  'employees.addEmployee': { en: 'Add Employee', ar: 'إضافة موظف' },
  'employees.firstName': { en: 'First Name', ar: 'الاسم الأول' },
  'employees.lastName': { en: 'Last Name', ar: 'الاسم الأخير' },
  'employees.jobTitle': { en: 'Job Title', ar: 'المسمى الوظيفي' },
  'employees.department': { en: 'Department', ar: 'القسم' },
  'employees.hireDate': { en: 'Hire Date', ar: 'تاريخ التوظيف' },
  'employees.salary': { en: 'Salary', ar: 'الراتب' },
  'employees.operations': { en: 'Operations', ar: 'العمليات' },
  'employees.finance': { en: 'Finance', ar: 'المالية' },
  'employees.hr': { en: 'HR', ar: 'الموارد البشرية' },
  'employees.sales': { en: 'Sales', ar: 'المبيعات' },
  'employees.management': { en: 'Management', ar: 'الإدارة' },
  
  // User Management
  'userManagement.title': { en: 'User Management', ar: 'إدارة المستخدمين' },
  'userManagement.addUser': { en: 'Add User', ar: 'إضافة مستخدم' },
  'userManagement.username': { en: 'Username', ar: 'اسم المستخدم' },
  'userManagement.role': { en: 'Role', ar: 'الدور' },
  'userManagement.permissions': { en: 'Permissions', ar: 'الصلاحيات' },
  'userManagement.lastLogin': { en: 'Last Login', ar: 'آخر تسجيل دخول' },
  'userManagement.admin': { en: 'Admin', ar: 'مدير' },
  'userManagement.employee': { en: 'Employee', ar: 'موظف' },
  'userManagement.viewer': { en: 'Viewer', ar: 'مشاهد' },
  
  // Analytics
  'analytics.title': { en: 'Analytics & Reports', ar: 'التحليلات والتقارير' },
  'analytics.revenue': { en: 'Revenue Analytics', ar: 'تحليلات الإيرادات' },
  'analytics.clients': { en: 'Client Analytics', ar: 'تحليلات العملاء' },
  'analytics.performance': { en: 'Performance Metrics', ar: 'مقاييس الأداء' },
  'analytics.monthlyRevenue': { en: 'Monthly Revenue', ar: 'الإيرادات الشهرية' },
  'analytics.clientGrowth': { en: 'Client Growth', ar: 'نمو العملاء' },
  'analytics.taskCompletion': { en: 'Task Completion Rate', ar: 'معدل إنجاز المهام' },
  
  // Notifications
  'notifications.title': { en: 'Notifications', ar: 'الإشعارات' },
  'notifications.subtitle': { en: 'Stay updated with the latest activities', ar: 'ابق على اطلاع بآخر الأنشطة' },
  'notifications.markAllRead': { en: 'Mark all as read', ar: 'تحديد الكل كمقروء' },
  'notifications.markRead': { en: 'Mark as read', ar: 'تحديد كمقروء' },
  'notifications.empty': { en: 'No notifications', ar: 'لا توجد إشعارات' },
  'notifications.noNotifications': { en: 'You\'re all caught up! No new notifications.', ar: 'لا توجد إشعارات جديدة!' },
  'notifications.noResults': { en: 'No notifications match your filters', ar: 'لا توجد إشعارات تطابق المرشحات' },
  'notifications.viewAll': { en: 'View all notifications', ar: 'عرض جميع الإشعارات' },
  'notifications.allNotifications': { en: 'All Notifications', ar: 'جميع الإشعارات' },
  'notifications.filters': { en: 'Filters', ar: 'المرشحات' },
  'notifications.searchPlaceholder': { en: 'Search notifications...', ar: 'البحث في الإشعارات...' },
  'notifications.total': { en: 'notifications', ar: 'إشعار' },
  'notifications.new': { en: 'New', ar: 'جديد' },
  'notifications.filters.all': { en: 'All', ar: 'الكل' },
  'notifications.filters.unread': { en: 'Unread', ar: 'غير مقروء' },
  'notifications.filters.read': { en: 'Read', ar: 'مقروء' },
  'notifications.types.invoice': { en: 'Invoices', ar: 'الفواتير' },
  'notifications.types.client': { en: 'Clients', ar: 'العملاء' },
  'notifications.types.task': { en: 'Tasks', ar: 'المهام' },
  'notifications.types.expense': { en: 'Expenses', ar: 'المصروفات' },
  'notifications.invoice.paid': { en: 'Invoice {{number}} has been paid', ar: 'تم دفع الفاتورة {{number}}' },
  'notifications.client.added': { en: 'New client {{name}} has been added', ar: 'تم إضافة عميل جديد {{name}}' },
  'notifications.task.assigned': { en: 'Task {{title}} has been assigned to you', ar: 'تم تكليفك بمهمة {{title}}' },
  'notifications.quotation.accepted': { en: 'Quotation {{number}} has been accepted', ar: 'تم قبول عرض السعر {{number}}' },
  
  // Search Results
  'search.clients': { en: 'Clients', ar: 'العملاء' },
  'search.invoices': { en: 'Invoices', ar: 'الفواتير' },
  'search.tasks': { en: 'Tasks', ar: 'المهام' },
  'search.quotations': { en: 'Quotations', ar: 'عروض الأسعار' },
  'search.expenses': { en: 'Expenses', ar: 'المصروفات' },
  'search.noResults': { en: 'No search results found', ar: 'لم يتم العثور على نتائج بحث' },
  
  // Forms
  'forms.required': { en: 'This field is required', ar: 'هذا الحقل مطلوب' },
  'forms.invalidEmail': { en: 'Invalid email address', ar: 'عنوان بريد إلكتروني غير صحيح' },
  'forms.invalidPhone': { en: 'Invalid phone number', ar: 'رقم هاتف غير صحيح' },
  'forms.selectOption': { en: 'Select an option', ar: 'اختر خياراً' },
  'forms.uploadFile': { en: 'Upload file', ar: 'رفع ملف' },
  'forms.dragDropFile': { en: 'Drag and drop file here', ar: 'اسحب وأفلت الملف هنا' },
  
  // Dialogs
  'dialogs.confirmDelete': { en: 'Are you sure you want to delete this item?', ar: 'هل أنت متأكد من حذف هذا العنصر؟' },
  'dialogs.confirmAction': { en: 'Are you sure you want to perform this action?', ar: 'هل أنت متأكد من تنفيذ هذا الإجراء؟' },
  'dialogs.unsavedChanges': { en: 'You have unsaved changes. Do you want to save them?', ar: 'لديك تغييرات غير محفوظة. هل تريد حفظها؟' },
  
  // Messages
  'messages.success.created': { en: 'Item created successfully', ar: 'تم إنشاء العنصر بنجاح' },
  'messages.success.updated': { en: 'Item updated successfully', ar: 'تم تحديث العنصر بنجاح' },
  'messages.success.deleted': { en: 'Item deleted successfully', ar: 'تم حذف العنصر بنجاح' },
  'messages.error.generic': { en: 'An error occurred. Please try again.', ar: 'حدث خطأ. يرجى المحاولة مرة أخرى.' },
  'messages.error.network': { en: 'Network error. Please check your connection.', ar: 'خطأ في الشبكة. يرجى التحقق من اتصالك.' },
  'messages.error.unauthorized': { en: 'You are not authorized to perform this action.', ar: 'ليس لديك صلاحية لتنفيذ هذا الإجراء.' },
  
  // Profile
  'profile.title': { en: 'User Profile', ar: 'الملف الشخصي' },
  'profile.editProfile': { en: 'Edit Profile', ar: 'تعديل الملف الشخصي' },
  'profile.changePassword': { en: 'Change Password', ar: 'تغيير كلمة المرور' },
  'profile.profilePicture': { en: 'Profile Picture', ar: 'صورة الملف الشخصي' },
  'profile.personalInfo': { en: 'Personal Information', ar: 'المعلومات الشخصية' },
  'profile.contactInfo': { en: 'Contact Information', ar: 'معلومات الاتصال' },
  'profile.workInfo': { en: 'Work Information', ar: 'معلومات العمل' },


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