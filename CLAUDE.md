# NexusCore — إرشادات العمل على المشروع

نظام تشغيلي ومالي ثنائي اللغة (عربي RTL / إنجليزي LTR): Express + React/Vite/Tailwind/shadcn + Drizzle + PostgreSQL، وتطبيق هاتف PWA تحت `/m`. التفاصيل في `PRODUCT.md` و`TECH_STACK.md` و`docs/`.

## مهارات التصميم
- **`impeccable`** (في `.claude/skills/impeccable/`): تصميم الواجهات ومراجعتها عموماً.
- **`apple-design-skill`** (إضافة مفعّلة من `.claude/settings.json`): إرشادات Apple للواجهات (HIG). تُستعمل **فقط** لشاشات الهاتف `/m` (`client/src/mobile/`) وسلوك التطبيق المثبَّت على iPhone: المناطق الآمنة، أهداف اللمس، الأوراق السفلية، شريط التبويب، الحركة، الوضع الداكن، إمكانية الوصول. لا تُطبَّق على نسخة الكمبيوتر ولا على مستندات الطباعة.
  - المهارة تصف **نية التصميم** من نسخة HIG محلية، لا أسماء واجهات SwiftUI/UIKit، وليست فاحص امتثال آلياً: تُقارَن إرشاداتها بالشاشة الفعلية.
  - إن لم تكن مثبّتة في الجلسة: `/plugin marketplace add https://github.com/NutshellEngineering/apple-design-skill` ثم `/plugin install apple-design-skill@apple-design-skill-marketplace`.
  - مراجعة الهاتف الحالية ونتائجها في `docs/MOBILE_HIG_REVIEW.md`.

## قواعد ثابتة
- نصوص الواجهة والردود بالعربية الفصحى، ودعم RTL حقيقي (الخصائص المنطقية `start/end`، لا `left/right`).
- لا مكتبات npm جديدة. تغييرات قاعدة البيانات إضافية وآمنة دائماً (ملف SQL + مدخل في `_journal.json` + دالة تهيئة idempotent).
- لا حذف لسجلات العمل. المبالغ بالجنيه المصري.
- الدفع إلى `main` عند طلب المستخدم الصريح فقط؛ وإلا يُدفع إلى فرع العمل.
