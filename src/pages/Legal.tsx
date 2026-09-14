import type { ReactNode } from 'react';
import { ShieldCheck, FileText, Lock } from 'lucide-react';

interface LegalPageProps {
  type: 'privacy' | 'terms';
}

const content = {
  privacy: {
    title: 'سياسة الخصوصية',
    icon: Lock,
    intro: 'في توافق، نلتزم بحماية خصوصيتك وحماية بياناتك الشخصية. توضّح هذه السياسة كيفية جمعنا واستخدامنا وحمايتنا لمعلوماتك.',
    sections: [
      { title: '1. المعلومات التي نجمعها', body: 'نجمع المعلومات التي تقدمها عند إنشاء حسابك مثل الاسم، العمر، المدينة، والاهتمامات. كما نجمع معلومات تقنية مثل عنوان IP ونوع المتصفح لتحسين تجربتك.' },
      { title: '2. كيف نستخدم معلوماتك', body: 'نستخدم معلوماتك لتقديم خدمات المنصة، إيجاد التطابق المناسب، تحسين خدماتنا، التواصل معك، وضمان أمان المنصة.' },
      { title: '3. حماية البيانات', body: 'نستخدم تشفير SSL 256-bit لحماية بياناتك الحساسة. معلوماتك الشخصية مثل رقم الهوية والهاتف لا تظهر للأعضاء الآخرين أبدًا. نلتزم بنظام حماية البيانات الشخصية السعودي.' },
      { title: '4. مشاركة المعلومات', body: 'لا نبيع بياناتك لأي طرف ثالث. قد نشارك معلومات محدودة مع مزوّدي الخدمات الموثوقين الذين يساعدون في تشغيل المنصة، وذلك تحت اتفاقيات سرية صارمة.' },
      { title: '5. التحكم في خصوصيتك', body: 'يمكنك التحكم الكامل في خصوصيتك من إعدادات حسابك. يمكنك إخفاء صورتك، التحكم في من يرى ملفك، وحذف حسابك في أي وقت.' },
      { title: '6. ملفات تعريف الارتباط', body: 'نستخدم ملفات تعريف الارتباط (Cookies) لتحسين تجربتك وتذكّر تفضيلاتك. يمكنك التحكم فيها من إعدادات متصفحك.' },
      { title: '7. حقوقك', body: 'لديك الحق في الوصول إلى بياناتك، تصحيحها، أو حذفها. يمكنك ممارسة هذه الحقوق من خلال التواصل معنا أو من إعدادات حسابك.' },
      { title: '8. التحديثات على السياسة', body: 'قد نقوم بتحديث سياسة الخصوصية من وقت لآخر. سنخطّرك بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار داخل المنصة.' },
    ],
  },
  terms: {
    title: 'الشروط والأحكام',
    icon: FileText,
    intro: 'باستخدامك لمنصة توافق، فإنك توافق على الشروط والأحكام التالية. يرجى قراءتها بعناية.',
    sections: [
      { title: '1. قبول الشروط', body: 'باستخدامك للمنصة، فإنك تؤكد أنك قرأت ووافقت على هذه الشروط وجميع السياسات المعمول بها.' },
      { title: '2. الأهلية', body: 'يجب أن يكون عمرك 18 سنة على الأقل لاستخدام المنصة. كما يجب أن تكون معلوماتك صحيحة ودقيقة.' },
      { title: '3. استخدام المنصة', body: 'المنصة مخصصة للزواج الشرعي والعلاقات الجادة فقط. يُمنع استخدامها لأي أغراض غير قانونية أو غير أخلاقية.' },
      { title: '4. حسابات الأعضاء', body: 'أنت مسؤول عن الحفاظ على سرية حسابك وكلمة المرور. يجب تقديم معلومات صحيحة والالتزام بآداب التعامل مع الأعضاء الآخرين.' },
      { title: '5. المحتوى', body: 'أنت مسؤول عن المحتوى الذي تنشره. يُمنع نشر محتوى مسيء، مضلل، أو ينتهك حقوق الآخرين. نحتفظ بحق حذف أي محتوى مخالف.' },
      { title: '6. الاشتراكات والدفع', body: 'الباقات المدفوعة تمنح مزايا إضافية. جميع المدفوعات غير قابلة للاسترداد بعد تفعيل الباقة، إلا في الحالات المنصوص عليها في سياسة الاسترداد.' },
      { title: '7. التحقيق من الحسابات', body: 'نحتفظ بحق تعليق أو حذف أي حساب مخالف للشروط أو مشبوه دون إشعار مسبق. كما نحتفظ بحق رفض طلبات التسجيل.' },
      { title: '8. حدود المسؤولية', body: 'المنصة توفّر وسيلة للتعارف، لكننا لا نضمن نتائج محددة. لا نتحمل مسؤولية أي ضرر ناتج عن تفاعلات بين الأعضاء.' },
      { title: '9. التعديلات', body: 'قد نقوم بتعديل هذه الشروط من وقت لآخر. استمرارك في استخدام المنصة يعني موافقتك على الشروط المحدّثة.' },
      { title: '10. القانون المعمول به', body: 'تخضع هذه الشروط للقوانين المعمول بها في المملكة العربية السعودية، وتختص محاكمها بالنظر في أي نزاع.' },
    ],
  },
};

export default function LegalPage({ type }: LegalPageProps) {
  const data = content[type];
  const Icon = data.icon;

  return (
    <div className="bg-cream-50 min-h-screen">
      <div className="bg-navy-gradient relative overflow-hidden">
        <div className="absolute inset-0 pattern-arabesque opacity-30" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-14 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold-300/15 mb-4">
            <Icon className="w-7 h-7 text-gold-300" />
          </div>
          <h1 className="font-cairo font-extrabold text-3xl sm:text-4xl text-white">{data.title}</h1>
          <p className="mt-3 text-cream-200/80 font-tajawal max-w-xl mx-auto">آخر تحديث: 1 يناير 2025</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-3xl shadow-soft border border-cream-200/60 p-6 sm:p-10">
          <div className="bg-gold-300/10 rounded-2xl p-5 mb-8 flex items-start gap-3 border border-gold-500/20">
            <ShieldCheck className="w-6 h-6 text-gold-600 flex-shrink-0 mt-0.5" />
            <p className="text-navy-700 font-tajawal leading-relaxed">{data.intro}</p>
          </div>

          <div className="space-y-8">
            {data.sections.map((section, i) => (
              <div key={i}>
                <h2 className="font-cairo font-bold text-xl text-navy-900 mb-2">{section.title}</h2>
                <p className="text-navy-600 font-tajawal leading-loose">{section.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
