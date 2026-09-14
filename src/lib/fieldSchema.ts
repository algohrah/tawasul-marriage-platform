// ====================================================================
//  ملف تعريف الحقول الموحد — يستخدمه نموذج التسجيل ونظام الاستيراد
//  أي حقل جديد يضاف هنا يظهر تلقائياً في التسجيل والاستيراد
// ====================================================================

// ===== تعريف الحقل =====
export interface FieldDefinition {
  key: string;              // اسم الحقل في النظام
  label: string;            // الاسم العربي للعرض
  labelEn?: string;         // الاسم الإنجليزي (للاستيراد)
  type: 'text' | 'number' | 'select' | 'radio' | 'textarea' | 'date' | 'checkbox' | 'conditional';
  required: boolean;        // هل الحقل مطلوب
  group: 'basic' | 'personal' | 'partner' | 'contact' | 'admin';
  options?: string[];       // الخيارات للقوائم
  optionsWithLabel?: { value: string; label: string }[];  // خيارات مع قيم
  min?: number;             // للحقول الرقمية
  max?: number;             // للحقول الرقمية
  minLength?: number;       // للنصوص
  maxLength?: number;       // للنصوص
  placeholder?: string;     // نص التلميح
  hint?: string;            // وصف إضافي
  conditionalOn?: string;   // يظهر فقط إذا...
  conditionalValue?: string | string[];  // القيمة المطلوبة
  genderSpecific?: 'male' | 'female' | 'both';  // يظهر لجنس محدد
  defaultValue?: any;       // القيمة الافتراضية
  csvColumn?: string;       // اسم العمود في CSV
  sensitive?: boolean;      // بيانات حساسة (للإدارة فقط)
}

// ===== المجموعات =====
export const FIELD_GROUPS = {
  basic: { label: 'البيانات الأساسية', icon: 'User', order: 1 },
  personal: { label: 'المواصفات الشخصية', icon: 'FileText', order: 2 },
  partner: { label: 'مواصفات الشريك', icon: 'Heart', order: 3 },
  contact: { label: 'بيانات الحساب', icon: 'ShieldCheck', order: 4 },
  admin: { label: 'بيانات الإدارة', icon: 'Lock', order: 5 },
} as const;

// ===== الثوابت المستخدمة ===== (يجب أن تكون قبل REGISTRATION_FIELDS)
export const COUNTRIES = [
  'السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عمان',
  'مصر', 'سوريا', 'الأردن', 'اليمن', 'العراق', 'لبنان',
  'فلسطين', 'السودان', 'ليبيا', 'تونس', 'الجزائر', 'المغرب',
  'موريتانيا', 'الصومال', 'جيبوتي', 'جزر القمر', 'أخرى',
];

export const CITIES_BY_COUNTRY: Record<string, string[]> = {
  'السعودية': ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الطائف', 'بريدة', 'تبوك', 'أبها', 'خميس مشيط', 'الجبيل', 'ينبع', 'حائل', 'نجران', 'الجوف', 'الأحساء', 'القطيف', 'القصيم', 'الباحة'],
  'الإمارات': ['دبي', 'أبو ظبي', 'الشارقة', 'العين', 'عجمان', 'رأس الخيمة', 'الفجيرة', 'أم القيوين'],
  'الكويت': ['الكويت', 'حولي', 'الجهراء', 'السالمية', 'الفروانية', 'الأحمدي'],
  'قطر': ['الدوحة', 'الريان', 'الوكرة', 'الخور', 'الظعين'],
  'البحرين': ['المنامة', 'المحرق', 'الرفاع', 'حمد', 'عيسى'],
  'عمان': ['مسقط', 'صلالة', 'نزوى', 'صحار', 'صور', 'بهلا'],
  'مصر': ['القاهرة', 'الجيزة', 'الإسكندرية', 'المنصورة', 'طنطا', 'أسيوط', 'الزقازيق', 'بني سويف', 'الفيوم', 'أسوان', 'بورسعيد', 'السويس', 'الإسماعيلية'],
  'سوريا': ['دمشق', 'حلب', 'حمص', 'حماة', 'اللاذقية', 'دير الزور', 'الرقة', 'الحسكة', 'درعا', 'السويداء', 'طرطوس', 'إدلب'],
  'الأردن': ['عمّان', 'الزرقاء', 'إربد', 'العقبة', 'السلط', 'مادبا', 'الكرك', 'معان', 'جرش', 'عجلون'],
  'اليمن': ['صنعاء', 'عدن', 'تعز', 'الحديدة', 'المكلا', 'إب', 'ذمار', 'صعدة', 'المخا'],
  'العراق': ['بغداد', 'البصرة', 'الموصل', 'أربيل', 'النجف', 'كربلاء', 'كركوك', 'السليمانية', 'الناصرية', 'الديوانية', 'العمارة', 'الرمادي'],
  'لبنان': ['بيروت', 'طرابلس', 'صيدا', 'صور', 'جونية', 'زحلة', 'بعلبك', 'النبطية'],
  'فلسطين': ['القدس', 'غزة', 'رام الله', 'نابلس', 'الخليل', 'بيت لحم', 'جنين', 'طولكرم', 'قلقيلية', 'رفح', 'خان يونس'],
  'السودان': ['الخرطوم', 'أم درمان', 'بخت الرضا', 'بورتسودان', 'كسلا', 'القضارف', 'مدني', 'الأبيض', 'دنقلا', 'نيالا'],
  'ليبيا': ['طرابلس', 'بنغازي', 'مصراتة', 'الزاوية', 'سبها', 'البيضاء', 'زوارة', 'درنة'],
  'تونس': ['تونس', 'صفاقس', 'سوسة', 'قابس', 'بنزرت', 'القيروان', 'المنستير', 'المهدية', 'قفصة'],
  'الجزائر': ['الجزائر', 'وهران', 'قسنطينة', 'عنابة', 'البليدة', 'باتنة', 'سطيف', 'تبسة', 'تيزي وزو', 'بجاية'],
  'المغرب': ['الدار البيضاء', 'الرباط', 'فاس', 'مراكش', 'طنجة', 'أكادير', 'مكناس', 'وجدة', 'القنيطرة', 'تطوان'],
  'موريتانيا': ['نواكشوط', 'نواذيبو', 'روصو', 'كيهيدي', 'أطار', 'زويرات'],
  'الصومال': ['مقديشو', 'هرجيسا', 'بيدوا', 'كيسمايو', 'بوصاصا', 'جالكعيو'],
  'جيبوتي': ['جيبوتي', 'علي صبيح', 'تاجورة', 'أوبوك', 'دخيل'],
  'جزر القمر': ['موروني', 'موتسامودو', 'فومبوني', 'دوموني'],
  'أخرى': ['مدينة أخرى'],
};

export const SECTS = ['سني', 'سلفي', 'صوفي', 'زيدي', 'جعفري', 'إباضي', 'أخرى'];

export const SKIN_COLORS = ['أبيض جدا', 'أبيض', 'أبيض قمحي', 'حنطي', 'حنطي مائل للسمار', 'أسمر', 'أسمر داكن'];

export const SMOKING_OPTIONS = ['لا أدخن', 'أدخن أحيانًا', 'أدخن بانتظام', 'أدخن شيشة', 'سابقًا وتركت'];

export const EDUCATION_LEVELS = ['أقل من الثانوية', 'الثانوية العامة', 'دبلوم', 'دبلوم عالي', 'بكالوريوس', 'ماجستير', 'دكتوراه'];

export const WORK_TYPES_OPTIONS = [
  { value: 'حكومي', label: 'حكومي' },
  { value: 'قطاع خاص', label: 'قطاع خاص' },
  { value: 'عمل حر', label: 'عمل حر' },
  { value: 'باحث عن عمل', label: 'باحث عن عمل' },
  { value: 'طالب', label: 'طالب' },
  { value: 'بدون عمل', label: 'بدون عمل' },
  { value: 'أخرى', label: 'أخرى' },
];

export const HOUSING_TYPES = ['أملك منزل', 'أسكن مع العائلة', 'أستأجر', 'أخرى'];

export const CHILDREN_COUNT = ['لا يوجد', '1', '2', '3', '4', '5', 'أكثر من 5'];

export const WIFE_COUNT = [
  { value: '1', label: 'زوجة واحدة' },
  { value: '2', label: 'زوجتان' },
  { value: '3', label: 'ثلاث زوجات' },
];

export const YES_NO = [{ value: 'yes', label: 'نعم' }, { value: 'no', label: 'لا' }];

export const MARITAL_MALE = [
  { value: 'single', label: 'أعزب' },
  { value: 'divorced', label: 'مطلق' },
  { value: 'widower', label: 'أرمل' },
  { value: 'married', label: 'متزوج' },
];

export const MARITAL_FEMALE = [
  { value: 'single', label: 'عزباء' },
  { value: 'divorced', label: 'مطلقة' },
  { value: 'widow', label: 'أرملة' },
];

export const POLYGAMY_ACCEPT = [
  { value: 'yes', label: 'نعم، أقبل التعدد' },
  { value: 'first_only', label: 'أقبل أن أكون الزوجة الأولى فقط' },
  { value: 'no', label: 'لا أقبل التعدد' },
];

export const MARRIAGE_TYPES = [
  { value: 'announced', label: 'معلن' },
  { value: 'misyar', label: 'مسيار' },
  { value: 'both', label: 'لا مانع / معلن او مسيار' },
];

// ===== جميع الحقول =====
export const REGISTRATION_FIELDS: FieldDefinition[] = [
  // === البيانات الأساسية ===
  {
    key: 'gender',
    label: 'الجنس',
    labelEn: 'Gender',
    type: 'radio',
    required: true,
    group: 'basic',
    optionsWithLabel: [{ value: 'male', label: 'ذكر' }, { value: 'female', label: 'أنثى' }],
    csvColumn: 'gender',
    defaultValue: '',
  },
  {
    key: 'nickname',
    label: 'الاسم المستعار',
    labelEn: 'Nickname',
    type: 'text',
    required: false,
    group: 'basic',
    placeholder: 'مثال: أبو محمد، المطيري',
    hint: 'اختياري — يظهر في ملفك العام',
    maxLength: 50,
    csvColumn: 'nickname',
    defaultValue: '',
  },
  {
    key: 'birthDate',
    label: 'تاريخ الميلاد',
    labelEn: 'Birth Date',
    type: 'date',
    required: true,
    group: 'basic',
    hint: 'اختر السنة ثم الشهر ثم اليوم',
    csvColumn: 'birth_date',
    defaultValue: '',
  },
  {
    key: 'age',
    label: 'العمر',
    labelEn: 'Age',
    type: 'number',
    required: true,
    group: 'basic',
    min: 16,
    max: 80,
    hint: 'محسوب تلقائياً من تاريخ الميلاد',
    csvColumn: 'age',
    defaultValue: 0,
  },
  {
    key: 'country',
    label: 'الدولة',
    labelEn: 'Country',
    type: 'select',
    required: true,
    group: 'basic',
    options: COUNTRIES,
    hint: 'دولة الإقامة الحالية',
    csvColumn: 'country',
    defaultValue: '',
  },
  {
    key: 'city',
    label: 'المدينة',
    labelEn: 'City',
    type: 'select',
    required: true,
    group: 'basic',
    options: [], // يتم تحديثها ديناميكياً حسب الدولة
    hint: 'المدينة حسب الدولة المختارة',
    csvColumn: 'city',
    defaultValue: '',
  },
  {
    key: 'district',
    label: 'المنطقة / الحي',
    labelEn: 'District',
    type: 'text',
    required: true,
    group: 'basic',
    placeholder: 'حي العليا...',
    hint: 'الحي أو المنطقة التفصيلية',
    maxLength: 100,
    csvColumn: 'district',
    defaultValue: '',
  },
  {
    key: 'nationalityMode',
    label: 'الجنسية',
    labelEn: 'Nationality Mode',
    type: 'radio',
    required: true,
    group: 'basic',
    optionsWithLabel: [{ value: 'same', label: 'نفس دولة الإقامة' }, { value: 'other', label: 'جنسية أخرى' }],
    hint: 'هل جنسيتك نفس دولة الإقامة؟',
    csvColumn: 'nationality_mode',
    defaultValue: '',
  },
  {
    key: 'nationality',
    label: 'الجنسية (أخرى)',
    labelEn: 'Nationality',
    type: 'select',
    required: false,
    group: 'basic',
    options: COUNTRIES,
    conditionalOn: 'nationalityMode',
    conditionalValue: 'other',
    csvColumn: 'nationality',
    defaultValue: '',
  },
  {
    key: 'sect',
    label: 'المذهب',
    labelEn: 'Sect',
    type: 'select',
    required: true,
    group: 'basic',
    options: SECTS,
    hint: 'المذهب الديني الذي تتبعه',
    csvColumn: 'sect',
    defaultValue: '',
  },
  {
    key: 'sectOther',
    label: 'المذهب (أخرى)',
    labelEn: 'Sect Other',
    type: 'text',
    required: false,
    group: 'basic',
    conditionalOn: 'sect',
    conditionalValue: 'أخرى',
    maxLength: 50,
    csvColumn: 'sect_other',
    defaultValue: '',
  },
  {
    key: 'maritalStatus',
    label: 'الحالة الاجتماعية',
    labelEn: 'Marital Status',
    type: 'radio',
    required: true,
    group: 'basic',
    optionsWithLabel: MARITAL_MALE, // يتم استخدام MARITAL_FEMALE للنساء
    csvColumn: 'marital_status',
    defaultValue: '',
  },
  {
    key: 'hasChildren',
    label: 'هل لديك أبناء؟',
    labelEn: 'Has Children',
    type: 'radio',
    required: false,
    group: 'basic',
    optionsWithLabel: YES_NO,
    conditionalOn: 'maritalStatus',
    conditionalValue: ['divorced', 'widower', 'widow', 'married'],
    csvColumn: 'has_children',
    defaultValue: '',
  },
  {
    key: 'childrenCount',
    label: 'عدد الأبناء',
    labelEn: 'Children Count',
    type: 'select',
    required: false,
    group: 'basic',
    options: CHILDREN_COUNT,
    conditionalOn: 'hasChildren',
    conditionalValue: 'yes',
    csvColumn: 'children_count',
    defaultValue: '',
  },
  {
    key: 'childrenLiveWith',
    label: 'هل الأبناء يعيشون معك؟',
    labelEn: 'Children Live With',
    type: 'radio',
    required: false,
    group: 'basic',
    optionsWithLabel: YES_NO,
    conditionalOn: 'hasChildren',
    conditionalValue: 'yes',
    csvColumn: 'children_live_with',
    defaultValue: '',
  },
  {
    key: 'wifeCount',
    label: 'عدد الزوجات الحالي',
    labelEn: 'Wife Count',
    type: 'radio',
    required: false,
    group: 'basic',
    optionsWithLabel: WIFE_COUNT,
    conditionalOn: 'maritalStatus',
    conditionalValue: 'married',
    genderSpecific: 'male',
    csvColumn: 'wife_count',
    defaultValue: '',
  },
  {
    key: 'seekingWife',
    label: 'هل تبحث عن زوجة أخرى؟',
    labelEn: 'Seeking Wife',
    type: 'radio',
    required: false,
    group: 'basic',
    optionsWithLabel: YES_NO,
    conditionalOn: 'maritalStatus',
    conditionalValue: 'married',
    genderSpecific: 'male',
    csvColumn: 'seeking_wife',
    defaultValue: '',
  },
  {
    key: 'marriageType',
    label: 'نوع الزواج المطلوب',
    labelEn: 'Marriage Type',
    type: 'radio',
    required: true,
    group: 'basic',
    optionsWithLabel: MARRIAGE_TYPES,
    hint: 'اختر نوع الزواج: معلن فقط، مسيار فقط، أو لا مانع (إذا اخترت لا مانع فسيظهر ملفك للباحثين عن معلن والباحثين عن مسيار)',
    csvColumn: 'marriage_type',
    defaultValue: 'announced',
  },

  // === المواصفات الشخصية ===
  {
    key: 'height',
    label: 'الطول',
    labelEn: 'Height',
    type: 'number',
    required: true,
    group: 'personal',
    min: 130,
    max: 220,
    hint: 'طولك بالسنتيمتر',
    csvColumn: 'height',
    defaultValue: 0,
  },
  {
    key: 'weight',
    label: 'الوزن',
    labelEn: 'Weight',
    type: 'number',
    required: true,
    group: 'personal',
    min: 35,
    max: 200,
    hint: 'وزنك بالكيلوغرام',
    csvColumn: 'weight',
    defaultValue: 0,
  },
  {
    key: 'skinColor',
    label: 'لون البشرة',
    labelEn: 'Skin Color',
    type: 'select',
    required: true,
    group: 'personal',
    options: SKIN_COLORS,
    hint: 'لون بشرتك الطبيعي',
    csvColumn: 'skin_color',
    defaultValue: '',
  },
  {
    key: 'ethnicity',
    label: 'العرق',
    labelEn: 'Ethnicity',
    type: 'text',
    required: true,
    group: 'personal',
    placeholder: 'مثال: عربي، خليجي، قبلي...',
    hint: 'مثال: عربي، خليجي، قبيلي، إلخ',
    maxLength: 100,
    csvColumn: 'ethnicity',
    defaultValue: '',
  },
  {
    key: 'tribe',
    label: 'القبيلة / النسب',
    labelEn: 'Tribe',
    type: 'text',
    required: false,
    group: 'personal',
    placeholder: 'اكتب اسم القبيلة أو انتسابك (مثل: قبيلي، عتيبي، مطيري، قحطاني، خضيري...)',
    hint: 'اسم القبيلة أو الأصل والنسب',
    maxLength: 100,
    csvColumn: 'tribe',
    defaultValue: '',
  },
  {
    key: 'health',
    label: 'الحالة الصحية',
    labelEn: 'Health',
    type: 'text',
    required: true,
    group: 'personal',
    placeholder: 'مثال: ممتازة، جيدة، وضع صحي خاص...',
    hint: 'مثال: ممتازة، جيدة، وضع صحي خاص',
    maxLength: 200,
    csvColumn: 'health',
    defaultValue: '',
  },
  {
    key: 'smoking',
    label: 'التدخين',
    labelEn: 'Smoking',
    type: 'select',
    required: true,
    group: 'personal',
    options: SMOKING_OPTIONS,
    hint: 'عادتك في التدخين',
    csvColumn: 'smoking',
    defaultValue: '',
  },
  {
    key: 'education',
    label: 'المؤهل الدراسي',
    labelEn: 'Education',
    type: 'select',
    required: true,
    group: 'personal',
    options: EDUCATION_LEVELS,
    hint: 'أعلى مؤهل علمي حصلت عليه',
    csvColumn: 'education',
    defaultValue: '',
  },
  {
    key: 'workType',
    label: 'نوع جهة العمل',
    labelEn: 'Work Type',
    type: 'radio',
    required: true,
    group: 'personal',
    optionsWithLabel: WORK_TYPES_OPTIONS,
    hint: 'طبيعة عملك الحالي',
    csvColumn: 'work_type',
    defaultValue: '',
  },
  {
    key: 'jobTitle',
    label: 'المسمى الوظيفي',
    labelEn: 'Job Title',
    type: 'text',
    required: false,
    group: 'personal',
    placeholder: 'معلم، طبيب، مهندس...',
    hint: 'اكتب مسمى وظيفتك',
    maxLength: 100,
    conditionalOn: 'workType',
    conditionalValue: ['حكومي', 'قطاع خاص', 'عمل حر', 'طالب', 'أخرى'],
    csvColumn: 'job_title',
    defaultValue: '',
  },
  {
    key: 'housing',
    label: 'نوع السكن',
    labelEn: 'Housing',
    type: 'select',
    required: true,
    group: 'personal',
    options: HOUSING_TYPES,
    hint: 'وضعك السكني الحالي',
    csvColumn: 'housing',
    defaultValue: '',
  },
  {
    key: 'bio',
    label: 'نبذة عني',
    labelEn: 'Bio',
    type: 'textarea',
    required: true,
    group: 'personal',
    placeholder: 'اكتب نبذة قصيرة عن شخصيتك وأهدافك...',
    minLength: 20,
    maxLength: 500,
    hint: '20-500 حرف',
    csvColumn: 'bio',
    defaultValue: '',
  },

  // === مواصفات الشريك ===
  {
    key: 'pCountry',
    label: 'الدولة المطلوبة',
    labelEn: 'Partner Country',
    type: 'select',
    required: false,
    group: 'partner',
    options: ['لا يهم', ...COUNTRIES],
    hint: 'دولة الشريك الذي تبحث عنه',
    csvColumn: 'partner_country',
    defaultValue: '',
  },
  {
    key: 'pCity',
    label: 'المدينة المطلوبة',
    labelEn: 'Partner City',
    type: 'select',
    required: false,
    group: 'partner',
    options: [], // ديناميكية
    conditionalOn: 'pCountry',
    conditionalValue: COUNTRIES, // أي دولة غير "لا يهم"
    csvColumn: 'partner_city',
    defaultValue: '',
  },
  {
    key: 'pNationality',
    label: 'الجنسية المطلوبة',
    labelEn: 'Partner Nationality',
    type: 'select',
    required: false,
    group: 'partner',
    options: ['لا يهم', ...COUNTRIES],
    hint: 'جنسية الشريك المطلوب',
    csvColumn: 'partner_nationality',
    defaultValue: '',
  },
  {
    key: 'pAgeMin',
    label: 'العمر المطلوب (من)',
    labelEn: 'Partner Age Min',
    type: 'number',
    required: false,
    group: 'partner',
    min: 16,
    max: 80,
    defaultValue: 18,
    csvColumn: 'partner_age_min',
  },
  {
    key: 'pAgeMax',
    label: 'العمر المطلوب (إلى)',
    labelEn: 'Partner Age Max',
    type: 'number',
    required: false,
    group: 'partner',
    min: 16,
    max: 80,
    defaultValue: 45,
    csvColumn: 'partner_age_max',
  },
  {
    key: 'pMaritalStatus',
    label: 'الحالة الاجتماعية المقبولة',
    labelEn: 'Partner Marital Status',
    type: 'select',
    required: false,
    group: 'partner',
    options: ['لا يهم', 'أعزب/عزباء', 'مطلق/مطلقة', 'أرمل/أرملة'],
    hint: 'حالة الشريك الاجتماعية',
    csvColumn: 'partner_marital_status',
    defaultValue: '',
  },
  {
    key: 'pAcceptChildren',
    label: 'هل تقبل وجود أطفال؟',
    labelEn: 'Partner Accept Children',
    type: 'radio',
    required: false,
    group: 'partner',
    optionsWithLabel: YES_NO,
    conditionalOn: 'pMaritalStatus',
    conditionalValue: ['مطلق/مطلقة', 'أرمل/أرملة'],
    csvColumn: 'partner_accept_children',
    defaultValue: '',
  },
  {
    key: 'pNotes',
    label: 'ملاحظات إضافية',
    labelEn: 'Partner Notes',
    type: 'textarea',
    required: false,
    group: 'partner',
    placeholder: 'اكتب أي ملاحظات إضافية...',
    maxLength: 500,
    csvColumn: 'partner_notes',
    defaultValue: '',
  },

  // === بيانات الحساب (للإدارة فقط) ===
  {
    key: 'realName',
    label: 'الاسم الرباعي الحقيقي',
    labelEn: 'Real Name',
    type: 'text',
    required: true,
    group: 'contact',
    placeholder: 'الاسم الكامل',
    hint: 'اسمك الكامل — سري ولا يظهر لأحد',
    maxLength: 100,
    csvColumn: 'real_name',
    sensitive: true,
    defaultValue: '',
  },
  {
    key: 'whatsapp',
    label: 'رقم الواتساب للتواصل والإدارة',
    labelEn: 'WhatsApp',
    type: 'text',
    required: true,
    group: 'contact',
    placeholder: '05xxxxxxxx',
    hint: 'رقم الواتساب للتواصل — سري للإدارة فقط',
    maxLength: 20,
    csvColumn: 'whatsapp',
    sensitive: true,
    defaultValue: '',
  },
  {
    key: 'email',
    label: 'البريد الإلكتروني',
    labelEn: 'Email',
    type: 'text',
    required: false,
    group: 'contact',
    placeholder: 'example@email.com',
    hint: 'اختياري — لتسجيل الدخول',
    maxLength: 100,
    sensitive: true,
    defaultValue: '',
  },
  {
    key: 'password',
    label: 'كلمة المرور',
    labelEn: 'Password',
    type: 'text',
    required: false,
    group: 'contact',
    minLength: 6,
    hint: 'اختياري — 6 أحرف على الأقل',
    csvColumn: 'password',
    sensitive: true,
    defaultValue: '',
  },
];

// ===== دوال مساعدة =====

// الحصول على الحقول حسب المجموعة
export function getFieldsByGroup(group: string): FieldDefinition[] {
  return REGISTRATION_FIELDS.filter(f => f.group === group);
}

// الحصول على الحقول حسب الجنس
export function getFieldsByGender(gender: 'male' | 'female'): FieldDefinition[] {
  return REGISTRATION_FIELDS.filter(f => f.genderSpecific === 'both' || f.genderSpecific === gender || !f.genderSpecific);
}

// الحصول على الحقول المطلوبة فقط
export function getRequiredFields(): FieldDefinition[] {
  return REGISTRATION_FIELDS.filter(f => f.required);
}

// الحصول على الحقول للCSV (جميع الحقول غير الحساسة)
export function getCSVFields(): FieldDefinition[] {
  return REGISTRATION_FIELDS.filter(f => f.csvColumn);
}

// الحصول على الحقول الحساسة (للإدارة فقط)
export function getSensitiveFields(): FieldDefinition[] {
  return REGISTRATION_FIELDS.filter(f => f.sensitive);
}

// ====================================================================
//  أعمدة الاستيراد الرسمية — مصدر الحقيقة الوحيد للقالب وتوجيه الـ AI
// ====================================================================
export const IMPORT_COLUMNS = [
  'gender', 'age', 'marriage_type', 'tribe', 'nationality', 'country', 'city', 'marital_status', 'sect',
  'height', 'weight', 'skin_color', 'education', 'work_type', 'job_title',
  'housing', 'partner_nationality', 'partner_cities', 'partner_age_min', 'partner_age_max', 'accept_foreigner',
  'whatsapp', 'password', 'bio', 'p_notes', 'admin_notes',
];

// الحقول الإلزامية (تحذير فقط عند نقصها — لا تمنع الاستيراد)
export const IMPORT_REQUIRED_COLUMNS = ['gender', 'age', 'country', 'marital_status'];

// التسميات العربية للأعمدة (للقوالب والمعاينة)
export const IMPORT_COLUMN_LABELS: Record<string, string> = {
  gender: 'الجنس', age: 'العمر', marriage_type: 'نوع الزواج', tribe: 'القبيلة / النسب', nationality: 'الجنسية', country: 'الدولة', city: 'المدينة',
  marital_status: 'الحالة الاجتماعية', sect: 'المذهب', height: 'الطول', weight: 'الوزن',
  skin_color: 'لون البشرة', education: 'المؤهل', work_type: 'نوع العمل', job_title: 'الوظيفة',
  housing: 'السكن', partner_nationality: 'جنسية الشريك المطلوب', partner_cities: 'المدن المقبولة للشريك',
  partner_age_min: 'عمر الشريك (من)', partner_age_max: 'عمر الشريك (إلى)', accept_foreigner: 'قبول غير مواطن / أجنبي',
  whatsapp: 'واتساب', password: 'كلمة المرور',
  bio: 'نبذة عني', p_notes: 'مواصفات الشريك المطلوب', admin_notes: 'ملاحظات إدارية (لا تظهر للعضو)',
};

// ====================================================================
//  توجيه وأوامر الذكاء الاصطناعي — يُولَّد تلقائياً من خيارات المنصة الحقيقية
//  فيستحيل أن يتعارض مع نموذج التسجيل مهما تغيّر مستقبلاً.
// ====================================================================
export function generateAiImportPrompt(format: 'csv' | 'json' = 'csv'): string {
  const list = (arr: string[]) => arr.join(' | ');
  const maritalMale = MARITAL_MALE.map(m => m.label).join(' | ');
  const maritalFemale = MARITAL_FEMALE.map(m => m.label).join(' | ');
  const workTypes = WORK_TYPES_OPTIONS.map(w => w.label).join(' | ');

  const exampleMaleCSV = [
    'ذكر', '32', 'معلن', 'عتيبي', 'السعودية', 'السعودية', 'الرياض', 'أعزب', 'سني', '178', '78', 'أبيض قمحي',
    'بكالوريوس', 'حكومي', 'مهندس', 'أملك منزل', 'السعودية', 'الرياض والخرج', '22', '30', 'لا',
    '0501234567', 'Twafok@123456',
    'شاب جاد ومهتم بالاستقرار وبناء أسرة، العرق: أبيض، الحالة الصحية: سليم', 'أبحث عن زوجة متدينة خلوقة تقبل السكن في الرياض، عمرها بين 22 و30', 'رقم ناشر الاستمارة: 0501234567 | المهر 30 ألف',
  ].join(',');

  const exampleFemaleCSV = [
    'أنثى', '37', 'لا مانع', 'المعبدي', 'السعودية', 'السعودية', 'مكة المكرمة', 'مطلقة', '', '160', '60', 'أبيض قمحي',
    'الثانوية العامة', 'بدون عمل', '', 'أملك منزل', 'لا يهم', 'مكة وجدة', '37', '48', 'نعم',
    '0551234567', 'Twafok@654321',
    'مطلقة بدون أولاد، هادئة ومحبة للأسرة، تنتقب، العرق: أبيض',
    'أريد رجلاً عنده بيت مستقل صاحب خلق ومحافظاً على صلاته، من عمر 37 إلى 48',
    'رقم ناشر الاستمارة: 0551234567 | المهر 10 آلاف والمصروف 1000 ريال شهرياً - أتعاب الخطابة 3000 بعد الملكة - الولي أخوها',
  ].join(',');

  const exampleJsonArray = [
    {
      gender: 'ذكر',
      age: 32,
      marriage_type: 'معلن',
      tribe: 'عتيبي',
      nationality: 'السعودية',
      country: 'السعودية',
      city: 'الرياض',
      marital_status: 'أعزب',
      sect: 'سني',
      height: 178,
      weight: 78,
      skin_color: 'أبيض قمحي',
      education: 'بكالوريوس',
      work_type: 'حكومي',
      job_title: 'مهندس',
      housing: 'أملك منزل',
      partner_nationality: 'السعودية',
      partner_cities: 'الرياض والخرج',
      partner_age_min: 22,
      partner_age_max: 30,
      accept_foreigner: 'لا',
      whatsapp: '0501234567',
      password: 'Twafok@123456',
      bio: 'شاب جاد ومهتم بالاستقرار وبناء أسرة، العرق: أبيض، الحالة الصحية: سليم',
      p_notes: 'أبحث عن زوجة متدينة خلوقة تقبل السكن في الرياض، عمرها بين 22 و30',
      admin_notes: 'رقم ناشر الاستمارة: 0501234567 | المهر 30 ألف',
    },
    {
      gender: 'أنثى',
      age: 37,
      marriage_type: 'لا مانع',
      tribe: 'المعبدي',
      nationality: 'السعودية',
      country: 'السعودية',
      city: 'مكة المكرمة',
      marital_status: 'مطلقة',
      sect: 'سني',
      height: 160,
      weight: 60,
      skin_color: 'أبيض قمحي',
      education: 'الثانوية العامة',
      work_type: 'بدون عمل',
      job_title: '',
      housing: 'أملك منزل',
      partner_nationality: 'لا يهم',
      partner_cities: 'مكة وجدة',
      partner_age_min: 37,
      partner_age_max: 48,
      accept_foreigner: 'نعم',
      whatsapp: '0551234567',
      password: 'Twafok@654321',
      bio: 'مطلقة بدون أولاد، هادئة ومحبة للأسرة، تنتقب، العرق: أبيض',
      p_notes: 'أريد رجلاً عنده بيت مستقل صاحب خلق ومحافظاً على صلاته، من عمر 37 إلى 48',
      admin_notes: 'رقم ناشر الاستمارة: 0551234567 | المهر 10 آلاف والمصروف 1000 شهرياً - أتعاب الخطابة 3000 بعد الملكة',
    }
  ];

  if (format === 'json') {
    return [
      'أنت مساعد خبير ومحلل بيانات ذكي لمنصة «توافق لتيسير الزواج». مهمتك تفريغ وتحويل رسائل واستمارات قروب الواتساب إلى مصفوفة كائنات JSON نظيفة ومجهزة للاستيراد المباشر.',
      '',
      '🛑 1. قاعدة تصفية شات وقروبات الواتساب (تجاهل المحادثات الجانبية):',
      '   • يجب عليك تجاهل وإسقاط أي رسائل شات عادية، صباح/مساء الخير، أدعية، تحايا، ترحيب، استفسارات، إعلانات عامة، أو ردود ونقاشات أعضاء القروب.',
      '   • ركز حصراً على رسائل «استمارات وطلبات الزواج» التي تحتوي على مواصفات شخصية وعمر وبيانات طلب زواج.',
      '   • كل استمارة طلب زواج تُحوَّل إلى كائن (Object) مستقل داخل مصفوفة الـ JSON.',
      '',
      '📞 2. قاعدة استخراج رقم الواتساب لكل ملف (الرقم الذي نشر الاستمارة):',
      '   • في سجل تصدير الواتساب، تبدأ كل رسالة برأس السطر الذي يحتوي على رقم الهاتف المرسل (مثل: `[10/09/2026, 14:30] +966 50 123 4567:` أو `050xxxx:`).',
      '   • خذ رقم هاتف ناشر الاستمارة هذا وضعه في خاصية `whatsapp` وفي `admin_notes` (ملاحظات الإدارة). وإذا وُجد رقم هاتف إضافي للولي أو الخطابة داخل نص الاستمارة، ضعه أيضاً في `admin_notes`.',
      '',
      '🎯 3. قاعدة تفكيك شروط ومواصفات الشريك بذكاء عالي:',
      '   • `partner_nationality` (جنسية الشريك): اسم الدولة الصريح الصافي (مثل "السعودية"، "المغرب") أو "لا يهم" / "أي جنسية".',
      '   • `partner_cities` (المدن المقبولة للشريك): اكتب المدن والمناطق المقبولة (مثل: "الرياض والخرج"، "المنطقة الغربية"، "كافة مناطق المملكة"، "لا يهم").',
      '   • `partner_age_min` و `partner_age_max` (العمر المطلوب للشريك): أرقام إنجليزية فقط (مثال: إذا طُلب "تحت 30" ← min: null, max: 30. وإذا طُلب "بين 25 و 35" ← min: 25, max: 35).',
      '   • `accept_foreigner` (قبول غير مواطن / أجنبي): "نعم" | "لا" | "لا مانع" (إذا كتب "يقبل أجنبي" أو "يقبل مواليد" أو "لا مانع من غير سعودية" اكتب: "نعم").',
      '   • `p_notes` (مواصفات الشريك المطلوبة العامة): ضع فيه باقي النص والشروط الوصفية والالتزامات كالسكن والمهر والمصروف والصفات الأخلاقية والدينية.',
      '',
      '💍 4. قاعدة التعامل مع التعدد والمسيار في الواتساب:',
      '   • `marriage_type` (نوع الزواج): "معلن" | "مسيار" | "لا مانع" (إذا ذكر "مسيار" أو "طلب مسيار" ← "مسيار"، إذا ذكر "معلن" أو "عادي" ← "معلن"، إذا قبل الاثنين ← "لا مانع").',
      '   • `accept_polygamy` (قبول التعدد - للنساء): "نعم" | "لا" (إذا ذكرت في استمارتها قبول التعدد أو زوجة ثانية/ثالثة ← "نعم"، وإذا اشترطت أعزب أو بدون زوجة ثانية ← "لا").',
      '   • للرجال الراغبين بالتعدد: `marital_status: "متزوج"`.',
      '',
      '🌍 5. قاعدة أسماء الدول والجنسيات الصريحة:',
      '   • في `country` و `nationality` اكتب دائماً اسم الدولة المباشر (مثل: السعودية، المغرب، مصر، سوريا، الأردن، الكويت، اليمن...). وممنوع كتابة صيغة المذكر/المؤنث (سعودي/سعودية).',
      '',
      '🏥 6. قاعدة الحالة الصحية والأمراض المزمنة (حقل نصي حر):',
      '   • `health` (الحالة الصحية): حقل نصي حر يُكتب فيه بالتفصيل ما ورد في الاستمارة (مثل: "سليم ولله الحمد"، "سكر وضغط"، "أنيميا خفيفة"...). لا توجد خيارات جاهزة مقيدة.',
      '   • ⚠️ قاعدة الأمراض المزمنة: إذا كان لدى العضو أي مرض مزمن أو وضع صحي خاص، اكتب التفاصيل في `health`، وأعد ذكرها أيضاً بوضوح وشفافية في `bio` (نبذة عني) حتى تظهر للطرف الآخر.',
      '',
      '🚭 7. قاعدة التدخين (صارمة جداً):',
      '   • `smoking` (التدخين): إذا لم يُذكر التدخين صراحة في نص الاستمارة، اتركه فارغاً تماماً `""` ولا تخمن أو تفترض أبداً.',
      '   • إذا ذُكر التدخين، طابق خيارات المنصة المعتمدة: ("لا أدخن" | "أدخن" | "سابقًا وتركت" | "شيشة فقط").',
      '',
      '💼 8. قاعدة تصنيف العمل والوظيفة (work_type و job_title):',
      '   • «أرامكو» أو «سابك» أو أي جهة شبه حكومية أو عسكرية أو وزارية ← `work_type: "حكومي"`، واكتب المسمى الوظيفي الصريح في `job_title` (مثل: "موظف في أرامكو").',
      '   • «ربة منزل» أو «ربة بيت» أو «لا تعمل» ← `work_type: "بدون عمل"`، واكتب `job_title: "ربة منزل"`.',
      '   • «متقاعد» أو «متقاعدة» ← `work_type: "بدون عمل"`، و `job_title: "متقاعد"`.',
      '   • إذا كان العضو يعمل ولديه وظيفة ولم تكن جهة حكومية صريحة ← اختر `work_type: "عمل حر"` (أو "قطاع خاص" إن ذُكرت شركة خاصة)، واكتب المسمى الوظيفي الصريح في `job_title` (مثل: مهندس، مندوب مبيعات، تاجر، محاسب...).',
      '',
      '🎨 9. قاعدة توحيد لون البشرة (12 خياراً معتمدًا في المنصة حسب درجات ولهجات المجتمع):',
      '   • أبيض ناصع ← للكلمات: (ناصع، أبيض جداً، شديد البياض، بيضاء ثلج)',
      '   • أبيض ← للكلمات: (أبيض، بيضاء، فاتح، فاتحة)',
      '   • أبيض مائل للقمحي ← للكلمات: (أبيض قمحي، بياض ناعم، بياض على حنطي)',
      '   • قمحي فاتح ← للكلمات: (قمحي فاتح، قمحية فاتحة)',
      '   • قمحي ← للكلمات: (قمحي، قمحية، لون القمح الطبيعي)',
      '   • قمحي غامق ← للكلمات: (قمحي غامق، قمحي داكن، ذهبي)',
      '   • حنطي فاتح ← للكلمات: (حنطي فاتح، حنطية فاتحة، بياض على سمار خفيف)',
      '   • حنطي ← للكلمات: (حنطي، حنطية، معتدل، وسط، متوسط)',
      '   • حنطي غامق ← للكلمات: (حنطي غامق، حنطي مائل للسمار، مايل للسمرة)',
      '   • أسمر فاتح ← للكلمات: (أسمر فاتح، سمراء فاتحة، برونزي)',
      '   • أسمر ← للكلمات: (أسمر، سمراء، أسمر صريح)',
      '   • أسمر داكن ← للكلمات: (أسمر داكن، أسمر غامق، شديد السمار)',
      '',
      '🔒 10. حماية أرقام الهواتف:',
      '   • يُمنع كتابة أي رقم هاتف أو جوال داخل `bio` أو `p_notes` نهائياً لحماية الخصوصية. مكان الأرقام حصراً هو `whatsapp` و `admin_notes`.',
      '',
      '📋 قائمة القيم المعتمدة:',
      `   • marital_status (رجال): ${maritalMale}`,
      `   • marital_status (نساء): ${maritalFemale} (بكر = عزباء)`,
      `   • work_type: ${workTypes} (أرامكو = حكومي | ربة منزل = بدون عمل)`,
      `   • education: ${list(EDUCATION_LEVELS)}`,
      `   • skin_color: ${list(SKIN_COLORS)}`,
      `   • sect: ${list(SECTS)}`,
      `   • housing: ${list(HOUSING_TYPES)}`,
      '',
      '📦 هيكل المخرجات المطلوب (JSON Array نقي فقط بدون أي مقدمات أو شروحات):',
      '```json',
      JSON.stringify(exampleJsonArray, null, 2),
      '```',
      '',
      '---',
      'نصوص محادثات واستمارات الواتساب المراد تحويلها:',
      '[ألصق نصوص الواتساب هنا]',
    ].join('\n');
  }

  // صيغة CSV الافتراضية
  return [
    'أنت مساعد خبير متخصص في تحليل وتفريغ بيانات «منصة توافق لتيسير الزواج». مهمتك: تحويل نصوص ورسائل قروب الواتساب واستمارات الخطابات إلى ملف CSV نظيف ودقيق للغاية جاهز للاستيراد المباشر في المنصة.',
    '',
    '⭐ القاعدة الذهبية: استخرج ما هو موجود فعلاً في النص فقط. أي معلومة غير موجودة أو مكتوبة كرمز (مثل ✅ ✓ ؟ - — «لا يوجد» أو خانة فارغة) اتركها فارغة تماماً بين فاصلتين (,,). لا تخترع، لا تخمّن، لا تكتب «غير محدد». المنصة تقبل الحقول الفارغة تماماً وتستورد العضو بلا أخطاء.',
    '',
    '🛑 1. تصفية شات وقروبات الواتساب (تجاهل المحادثات الجانبية):',
    '   • يجب عليك تماماً تجاهل وإسقاط أي رسائل شات عادية، صباح/مساء الخير، أدعية، تحايا، ترحيب، استفسارات، إعلانات عامة، أو ردود ونقاشات أعضاء القروب.',
    '   • ركز حصراً على رسائل «استمارات وطلبات الزواج» التي تحتوي على مواصفات شخصية وعمر وبيانات طلب زواج.',
    '   • كل استمارة طلب زواج تُحوَّل إلى صف بيانات (Row) مستقل في ملف الـ CSV.',
    '',
    '📞 2. استخراج رقم الواتساب لكل ملف (الرقم الذي نشر الاستمارة في القروب):',
    '   • في سجل تصدير الواتساب، تبدأ كل رسالة برأس السطر الذي يحتوي على رقم الهاتف المرسل (مثل: `[10/09/2026, 14:30] +966 50 123 4567:` أو `050xxxx:`).',
    '   • خذ رقم هاتف ناشر الاستمارة هذا وضعه في عمود whatsapp وفي عمود admin_notes (ملاحظات الإدارة). وإذا وُجد رقم هاتف إضافي للولي أو الخطابة داخل نص الاستمارة، ضعه أيضاً في admin_notes.',
    '',
    '🎯 3. تفكيك شروط ومواصفات الشريك بذكاء عالي:',
    '   • partner_nationality (جنسية الشريك): اسم الدولة الصريح (مثل "السعودية") أو "لا يهم" / "أي جنسية".',
    '   • partner_cities (المدن المقبولة للشريك): اكتب المدن والمناطق المقبولة (مثل: "الرياض والخرج"، "المنطقة الغربية"، "كافة مناطق المملكة"، "لا يهم").',
    '   • partner_age_min و partner_age_max (العمر المطلوب للشريك): أرقام إنجليزية فقط (مثال: إذا طُلب "تحت 30" اكتب partner_age_max: 30، وإذا طُلب "بين 25 و 35" اكتب 25 في partner_age_min و 35 في partner_age_max).',
    '   • accept_foreigner (قبول غير مواطن / أجنبي): نعم | لا | لا مانع (إذا كتب "يقبل أجنبي" أو "يقبل مواليد" أو "لا مانع من غير سعودية" اكتب: نعم).',
    '   • p_notes (مواصفات الشريك المطلوبة العامة): ضع فيه باقي النص والشروط الوصفية والالتزامات كالسكن والمهر والمصروف والصفات الأخلاقية والدينية.',
    '',
    '💍 4. التعامل مع التعدد والمسيار في الواتساب:',
    '   • marriage_type (نوع الزواج): معلن | مسيار | لا مانع (إذا ذكر "مسيار" أو "طلب مسيار" اكتب: مسيار، إذا ذكر "معلن" أو "عادي" اكتب: معلن، إذا قبل الاثنين اكتب: لا مانع).',
    '   • accept_polygamy (قبول التعدد - للنساء): نعم | لا (إذا ذكرت في استمارتها قبول التعدد أو زوجة ثانية/ثالثة اكتب: نعم، وإذا اشترطت أعزب أو بدون زوجة ثانية اكتب: لا).',
    '   • للرجال الراغبين بالتعدد: الحالة الاجتماعية marital_status: متزوج.',
    '',
    '📌 سطر العناوين (انسخه حرفياً في أول سطر — لا تُغيّره ولا تُترجمه ولا تُعِد ترتيبه):',
    IMPORT_COLUMNS.join(','),
    '',
    '🌍 قاعدة تحويل أسماء الدول والجنسيات حتمياً (مهمة جداً):',
    '   • في حقلي country (الدولة) و nationality (الجنسية)، اكتب دائماً اسم الدولة الصريح الصافي المباشر، وممنوع كتابة صفة المذكر أو المؤنث.',
    '   • أمثلة إجبارية:',
    '     - «سعودي» أو «سعودية» ← اكتب: السعودية',
    '     - «مغربي» أو «مغربية» ← اكتب: المغرب',
    '     - «سوري» أو «سورية» ← اكتب: سوريا',
    '     - «مصري» أو «مصرية» ← اكتب: مصر',
    '     - «تونسي» أو «تونسية» ← اكتب: تونس',
    '     - «أردني» أو «أردنية» ← اكتب: الأردن',
    '     - «كويتي» أو «كويتية» ← اكتب: الكويت',
    '     - «إماراتي» أو «إماراتية» ← اكتب: الإمارات',
    '     - «يمني» أو «يمنية» ← اكتب: اليمن',
    '     - «فلسطيني» أو «فلسطينية» ← اكتب: فلسطين',
    '     - «باكستاني» أو «باكستانية» ← اكتب: باكستان',
    '     - «سوداني» أو «سودانية» ← اكتب: السودان',
    '',
    '🔴 الحقول الأساسية الإلزامية:',
    '   • gender (الجنس): ذكر | أنثى — استنتجه من الحالة (أعزب/شاب/مطلق/معلم=ذكر، عزباء/بكر/شابة/مطلقة/أرملة/معلمة=أنثى).',
    '   • age (العمر): رقم إنجليزي فقط (مثال: 25 أو 32). يُدخل العمر كتابةً كرقم صريح فقط دون الحاجة إطلاقاً لتدوين تاريخ الميلاد.',
    '   • country (الدولة): اسم الدولة الصريح (مثل: السعودية، المغرب، سوريا...).',
    '   • marital_status (الحالة الاجتماعية): مطابقة للقوائم المسموحة.',
    '',
    '📋 القيم المسموحة للحقول ذات القوائم (استخدم القيمة المطابقة حرفياً، وإلا اترك الخانة فارغة):',
    '   • marriage_type (نوع الزواج): معلن | مسيار | لا مانع   ← إذا كان العضو يقبل الاثنين أو كتب "لا مانع معلن أو مسيار" اكتب: لا مانع',
    '   • partner_nationality (جنسية الشريك المطلوبة): اسم الدولة الصريح أو "لا يهم" أو "يقبل أجنبي" أو "أي جنسية"',
    '   • partner_cities (المدن المقبولة للشريك): اكتب المدن والمناطق المقبولة نصاً (مثل: الرياض، جدة ومكة، كافة مناطق المملكة، لا يهم...)',
    '   • partner_age_min و partner_age_max (العمر المطلوب للشريك): أرقام إنجليزية فقط (مثل: 22 إلى 35)',
    '   • accept_foreigner (قبول غير مواطن / أجنبي): نعم | لا | لا مانع',
    '   • tribe (القبيلة / النسب / العائلة): اكتب اسم القبيلة أو انتساب العضو (مثل: عتيبي، مطيري، قحطاني، خضيري، قبيلي...).',
    `   • marital_status (رجال): ${maritalMale}`,
    `   • marital_status (نساء): ${maritalFemale}   ← «بكر»=عزباء، «شاب»=أعزب، «شابة/صبية»=عزباء`,
    `   • sect (المذهب): ${list(SECTS)}`,
    `   • education (المؤهل): ${list(EDUCATION_LEVELS)}`,
    `   • work_type (نوع العمل): ${workTypes}`,
    '     - «أرامكو» أو «سابك» أو أي جهة شبه حكومية أو عسكرية أو وزارية ← حكومي (واكتب المسمى الوظيفي الصريح في job_title مثل: موظف في أرامكو)',
    '     - «ربة منزل» أو «ربة بيت» أو «لا تعمل» ← بدون عمل (واكتب job_title: ربة منزل)',
    '     - «متقاعد» أو «متقاعدة» ← بدون عمل (واكتب job_title: متقاعد)',
    '     - إذا كان العضو موظفاً أو يعمل في قطاع غير حكومي ← عمل حر (أو قطاع خاص إن ذكر شركة خاصة)، واكتب المسمى الوظيفي الصريح في job_title (مثل: مهندس، مندوب، تاجر...)',
    `   • smoking (التدخين): ${list(SMOKING_OPTIONS)}`,
    '     - ⚠️ قاعدة صارمة: إذا لم يُذكر التدخين صراحة في نص الاستمارة، اتركه فارغاً تماماً بين فاصلتين (,,) ولا تخمن أبداً.',
    '   • health (الحالة الصحية — حقل نصي حر): اكتب بالتفصيل ما ذُكر في الاستمارة (مثل: "سليم ولله الحمد"، "سكر وضغط"، "أنيميا"...).',
    '     - ⚠️ إذا كان هناك أي مرض مزمن أو وضع صحي خاص، اكتبه في health وأعد كتابته أيضاً بوضوح في bio (نبذة عني) للشفافية.',
    `   • skin_color (لون البشرة — اختر واحداً من الـ 12 المعتمدة): ${list(SKIN_COLORS)}`,
    '     - «ناصع / أبيض جداً / شديد البياض» ← أبيض ناصع',
    '     - «أبيض / بيضاء / فاتح» ← أبيض',
    '     - «أبيض قمحي / بياض على حنطي» ← أبيض مائل للقمحي',
    '     - «قمحي فاتح» ← قمحي فاتح',
    '     - «قمحي» ← قمحي',
    '     - «قمحي غامق / ذهبي» ← قمحي غامق',
    '     - «حنطي فاتح» ← حنطي فاتح',
    '     - «حنطي / معتدل / وسط» ← حنطي',
    '     - «حنطي غامق / مائل للسمار» ← حنطي غامق',
    '     - «أسمر فاتح / برونزي» ← أسمر فاتح',
    '     - «أسمر / سمراء» ← أسمر',
    '     - «أسمر داكن / غامق / شديد السمار» ← أسمر داكن',
    `   • housing (السكن): ${list(HOUSING_TYPES)}   ← «إيجار/مستأجر»=أستأجر، «ملك/بيت مستقل»=أملك منزل`,
    '   • accept_polygamy (تقبل التعدد — للنساء فقط): نعم | لا',
    '',
    '🔢 الحقول الرقمية (age, height, weight, partner_age_min, partner_age_max): أرقام إنجليزية فقط بدون وحدات (مثال: 165).',
    '',
    '📦 توزيع البيانات الإضافية والتفاصيل الكثيرة بذكاء شمولية (توزيع 100% من المعلومات):',
    '   🔒 قواعد سرية وحظر أرقام التواصل في ملف الأعضاء (توجيه صارم ومهم جداً):',
    '      • يُمنع منعاً باتاً إضافة أي أرقام تواصل (جوال، هاتف، واتساب، رقم ولي أمر، رقم خطابة) في ملف العضو العام أو في حقول العرض العامة (مثل bio أو p_notes).',
    '      • يجب وضع جميع أرقام التواصل والوساطة (رقم الواتساب، رقم الولي، رقم المكتب) حصراً في عمود ملاحظات الإدارة (admin_notes) للعضو المستورد، لتبقى محفوظة للإدارة فقط.',
    '      • يُوضع رقم الواتساب في حقل whatsapp المخصص له (وهو حقل خاص بالإدارة)، وتوضع أرقام أولياء الأمور أو الوساطة في admin_notes. ويُمنع تماماً ظهور أي رقم اتصال داخل bio أو p_notes.',
    '',
    '   💰 المعلومات والالتزامات المالية والشخصية (مسموح ظهورها للعامة):',
    '      • المعلومات والشروط المالية التي يحددها العضو (مثل: المهر المرغوب، المصروف، نوع السكن، الراتب/الدخل، الوظيفة) يصح وضعها في bio أو p_notes لتظهر للعامة.',
    '      • الملاحظات والعمولات والاتفاقات الإدارية الخاصة بالمكتب توضع في admin_notes.',
    '',
    '   • bio (نبذة عني — تظهر للعامة): اجمع فيها كافة المواصفات الشخصية والشروط المالية للعضو والتي لا تملك عموداً منفصلاً (مثل: المهر المرغوب، تفاصيل الأطفال، الحالة الصحية، التدخين، العرق/الأصل، نوع الحجاب، قيادة السيارة، تفاصيل العمل، السكن). يمنع كتابة أي رقم اتصال هنا.',
    '   • p_notes (مواصفات الشريك المطلوب — تظهر للعامة): اجمع فيها كافة الشروط والمتطلبات المطلوب توفرها في الطرف الآخر (مثل: العمر المطلوب، المدينة، السكن، الملاحظات والأنشطة). يمنع كتابة أي رقم اتصال هنا.',
    '   • admin_notes (ملاحظات إدارية — خاصة بالإدارة فقط ولا تظهر للعامة): ضع فيها أرقام الهواتف والتواصل للواتساب والولي والخطابة، وأتعاب الوسيطة والعمولات والتفاصيل التنظيمية المغلقة.',
    '',
    '🧷 قواعد سلامة وتنسيق البيانات:',
    '   • حوّل جميع الأرقام العربية الهندية (مثل ٢٧، ١٦٥، ٠٥٠١٢٣٤٥٦٧) إلى أرقام إنجليزية (27, 165, 0501234567).',
    '   • أي نص يحتوي فاصلة إنجليزية (,) ضع النص بين علامتي اقتباس "..." أو استبدل الفاصلة بفاصلة عربية (،).',
    `   • حافظ على عدد الأعمدة (${IMPORT_COLUMNS.length}) في كل صف.`,
    '   • المخرجات النهائية: كود CSV نقي ومباشر بدون مقدمات أو شرح.',
    '',
    '✅ مثال صف مكتمل:',
    exampleMaleCSV,
    '✅ مثال صف استمارة مسيار بها تفاصيل إضافية:',
    exampleFemaleCSV,
    '',
    '---',
    'النصوص والمرادات المراد تحويلها:',
    '[ألصق نصوص الخطابات / الواتساب / الاستمارات هنا]',
  ].join('\n');
}

// إنشاء قالب CSV بسيط وسهل — مبني على أعمدة الاستيراد الرسمية
export function generateSimpleCSVTemplate(): string {
  const headers = IMPORT_COLUMNS.join(',');
  const exampleRow1 = [
    'ذكر', '32', 'معلن', 'عتيبي', 'السعودية', 'السعودية', 'الرياض', 'أعزب', 'سني', '178', '78', 'أبيض قمحي',
    'بكالوريوس', 'حكومي', 'مهندس', 'أملك منزل', 'السعودية', 'الرياض والخرج', '22', '30', 'لا',
    '0501234567', 'Twafok@123456',
    'شاب جاد ومهتم بالاستقرار وبناء أسرة صالحة', 'أبحث عن زوجة متدينة خلوقة تقبل السكن في الرياض', 'تم التحقق من بيانات الاتصال',
  ].join(',');
  const exampleRow2 = [
    'أنثى', '28', 'معلن', 'القرشي', 'السعودية', 'السعودية', 'جدة', 'عزباء', 'سني', '162', '58', 'أبيض',
    'ماجستير', 'قطاع خاص', 'معلمة', 'أسكن مع العائلة', 'لا يهم', 'جدة ومكة', '28', '38', 'لا مانع',
    '0559876543', 'Twafok@654321',
    'فتاة هادئة خلوقة ومحبة للأسرة والاستقرار', 'رجل جاد متعلم ومستقر وظيفياً يخاف الله', 'الدفعة الأولى - بيانات الخطابة محفوظة',
  ].join(',');

  return `${headers}\n${exampleRow1}\n${exampleRow2}`;
}

// إنشاء قالب CSV (نفس الأعمدة الرسمية للاستيراد)
export function generateCSVTemplate(): string {
  const headers = IMPORT_COLUMNS.join(',');
  const exampleRow = [
    'ذكر', '32', 'معلن', 'عتيبي', 'السعودية', 'السعودية', 'الرياض', 'أعزب', 'سني', '178', '78', 'أبيض قمحي',
    'بكالوريوس', 'حكومي', 'مهندس', 'أملك منزل', 'السعودية', 'الرياض والخرج', '22', '30', 'لا',
    '0501234567', 'Twafok@123456',
    'شاب جاد ومهتم بالاستقرار وبناء أسرة صالحة', 'أبحث عن زوجة متدينة خلوقة تقبل السكن في الرياض', 'ملاحظة إدارية داخلية',
  ].join(',');
  return `${headers}\n${exampleRow}`;
}

// ===== إنشاء قالب كامل مع الخيارات للنسخ =====
export function generateFullTemplateWithOptions(): string {
  const lines: string[] = [];
  
  // العناوين
  lines.push('=== قالب واستعراض خيارات استيراد الأعضاء (تعليمات موجهة للذكاء الاصطناعي AI) ===');
  lines.push('');
  lines.push('📋 هذا القالب موجه لإنشاء ملفات استيراد الأعضاء بنجاح في منصة توافق.');
  lines.push('🔑 يدعم استيراد وتصدير كلمات المرور للأعضاء بدقة.');
  lines.push('💡 الحقول الفارغة يتم قبولها واستيراد العضو بدون أخطاء وتوليد كلمة مرور افتراضية له إن لم تكن محددة.');
  lines.push('');
  lines.push('🤖 تعليمات للذكاء الاصطناعي (Prompt for AI):');
  lines.push('قم بإنشاء جدول بيانات أعضاء بصيغة CSV أو Tab.');
  lines.push('يمكنك ترك الحقول غير المتوفرة فارغة وسيقوم النظام باستيراد الأعضاء مباشرة دون أخطاء.');
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // تنسيق CSV
  lines.push('📌 تنسيق CSV (نسخ هذا السطر كعناوين الأعمدة):');
  lines.push('');
  const csvHeaders = getCSVFields().map(f => f.csvColumn || f.key).join(',');
  lines.push(csvHeaders);
  lines.push('');
  
  // تنسيق Tab (للنسخ من Excel)
  lines.push('📌 تنسيق Tab (للنسخ واللصق المباشر من Excel / Google Sheets):');
  lines.push('');
  const tabHeaders = getCSVFields().map(f => f.label).join('\t');
  lines.push(tabHeaders);
  lines.push('');
  
  lines.push('---');
  lines.push('');
  
  // جميع الحقول مع الخيارات
  lines.push('📖 جميع الحقول والخيارات المتاحة:');
  lines.push('');
  
  const groups = ['basic', 'personal', 'partner', 'contact'] as const;
  const groupLabels: Record<string, string> = {
    basic: 'البيانات الأساسية',
    personal: 'المواصفات الشخصية',
    partner: 'مواصفات الشريك',
    contact: 'بيانات التواصل والإدارة',
  };
  
  groups.forEach(group => {
    const groupFields = getCSVFields().filter(f => f.group === group);
    if (groupFields.length === 0) return;
    
    lines.push(``);
    lines.push(`【${groupLabels[group]}】`);
    lines.push('');
    
    groupFields.forEach(field => {
      const requiredMark = field.required ? '✓ رئيسي' : '○ اختياري (يمكن تركه فارغاً)';
      const csvName = field.csvColumn || field.key;
      
      lines.push(`• ${field.label} (${csvName})`);
      lines.push(`  الحالة: ${requiredMark}`);
      
      if (field.options && field.options.length > 0) {
        lines.push(`  الخيارات: ${field.options.join(' | ')}`);
      }
      
      if (field.optionsWithLabel && field.optionsWithLabel.length > 0) {
        const opts = field.optionsWithLabel.map(o => `${o.label} (${o.value})`).join(' | ');
        lines.push(`  الخيارات: ${opts}`);
      }
      
      if (field.min || field.max) {
        lines.push(`  النطاق: ${field.min || '?'} - ${field.max || '?'}`);
      }
      
      if (field.hint) {
        lines.push(`  توضيح: ${field.hint}`);
      }
      
      if (field.genderSpecific) {
        lines.push(`  خاص ب: ${field.genderSpecific === 'male' ? 'الرجال فقط' : field.genderSpecific === 'female' ? 'النساء فقط' : 'الجميع'}`);
      }
      
      lines.push('');
    });
  });
  
  lines.push('---');
  lines.push('');
  
  // مثال صف بيانات ذكر
  lines.push('📝 مثال صف بيانات عضو (ذكر) - CSV:');
  lines.push('');
  const exampleMale = getCSVFields().map(f => {
    if (f.key === 'gender') return 'ذكر';
    if (f.key === 'nickname') return 'أبو محمد';
    if (f.key === 'birthDate' || f.key === 'birth_date') return '1990-05-15';
    if (f.key === 'age') return '35';
    if (f.key === 'country') return 'السعودية';
    if (f.key === 'city') return 'الرياض';
    if (f.key === 'district') return 'حي العليا';
    if (f.key === 'nationality') return 'السعودية';
    if (f.key === 'sect') return 'سني';
    if (f.key === 'maritalStatus' || f.key === 'marital_status') return 'single';
    if (f.key === 'height') return '175';
    if (f.key === 'weight') return '75';
    if (f.key === 'skinColor' || f.key === 'skin_color') return 'أبيض قمحي';
    if (f.key === 'ethnicity') return 'عربي';
    if (f.key === 'health') return 'ممتازة';
    if (f.key === 'smoking') return 'لا أدخن';
    if (f.key === 'education') return 'بكالوريوس';
    if (f.key === 'workType' || f.key === 'work_type') return 'حكومي';
    if (f.key === 'jobTitle' || f.key === 'job_title') return 'مهندس';
    if (f.key === 'housing') return 'أملك منزل';
    if (f.key === 'bio') return 'مهندس طموح أبحث عن الاستقرار والسعادة الزوجية';
    if (f.key === 'realName' || f.key === 'real_name') return 'محمد عبدالله السالم';
    if (f.key === 'phone') return '0512345678';
    if (f.key === 'whatsapp') return '0512345678';
    if (f.key === 'pCountry' || f.key === 'partner_country') return 'السعودية';
    if (f.key === 'pAgeMin' || f.key === 'partner_age_min') return '22';
    if (f.key === 'pAgeMax' || f.key === 'partner_age_max') return '30';
    if (f.type === 'number') return '25';
    if (f.type === 'checkbox') return 'false';
    return '';
  }).join(',');
  lines.push(exampleMale);
  lines.push('');

  // مثال صف بيانات أنثى
  lines.push('📝 مثال صف بيانات عضوة (أنثى) - CSV:');
  lines.push('');
  const exampleFemale = getCSVFields().map(f => {
    if (f.key === 'gender') return 'female';
    if (f.key === 'nickname') return 'أم عبدالرحمن';
    if (f.key === 'birthDate' || f.key === 'birth_date') return '1995-08-20';
    if (f.key === 'age') return '30';
    if (f.key === 'country') return 'السعودية';
    if (f.key === 'city') return 'جدة';
    if (f.key === 'district') return 'حي الشاطئ';
    if (f.key === 'nationality') return 'السعودية';
    if (f.key === 'sect') return 'سني';
    if (f.key === 'maritalStatus' || f.key === 'marital_status') return 'single';
    if (f.key === 'height') return '162';
    if (f.key === 'weight') return '58';
    if (f.key === 'skinColor' || f.key === 'skin_color') return 'أبيض';
    if (f.key === 'ethnicity') return 'عربي';
    if (f.key === 'health') return 'ممتازة';
    if (f.key === 'smoking') return 'لا أدخن';
    if (f.key === 'education') return 'بكالوريوس';
    if (f.key === 'workType' || f.key === 'work_type') return 'قطاع خاص';
    if (f.key === 'jobTitle' || f.key === 'job_title') return 'معلمة';
    if (f.key === 'housing') return 'أسكن مع العائلة';
    if (f.key === 'bio') return 'إنسانية خلوقة ترغب في تكوين أسرة متماسكة';
    if (f.key === 'realName' || f.key === 'real_name') return 'سارة أحمد علي';
    if (f.key === 'phone') return '0559876543';
    if (f.key === 'whatsapp') return '0559876543';
    if (f.key === 'pCountry' || f.key === 'partner_country') return 'السعودية';
    if (f.key === 'pAgeMin' || f.key === 'partner_age_min') return '28';
    if (f.key === 'pAgeMax' || f.key === 'partner_age_max') return '38';
    if (f.type === 'number') return '25';
    if (f.type === 'checkbox') return 'false';
    return '';
  }).join(',');
  lines.push(exampleFemale);
  lines.push('');
  
  lines.push('---');
  lines.push('');
  
  // قائمة الدول
  lines.push('🌍 الدول المتاحة:');
  lines.push(COUNTRIES.join(' | '));
  lines.push('');
  
  // قائمة المذاهب
  lines.push('🕌 المذاهب المتاحة:');
  lines.push(SECTS.join(' | '));
  lines.push('');
  
  // قائمة لون البشرة
  lines.push('🎨 ألوان البشرة:');
  lines.push(SKIN_COLORS.join(' | '));
  lines.push('');
  
  // قائمة المؤهلات
  lines.push('🎓 المؤهلات الدراسية:');
  lines.push(EDUCATION_LEVELS.join(' | '));
  lines.push('');
  
  // قائمة التدخين
  lines.push('🚬 خيارات التدخين:');
  lines.push(SMOKING_OPTIONS.join(' | '));
  lines.push('');
  
  // قائمة السكن
  lines.push('🏠 أنواع السكن:');
  lines.push(HOUSING_TYPES.join(' | '));
  lines.push('');
  
  // الحالة الاجتماعية
  lines.push('💑 الحالة الاجتماعية (الرجال):');
  lines.push(MARITAL_MALE.map(m => `${m.label} (${m.value})`).join(' | '));
  lines.push('');
  lines.push('💑 الحالة الاجتماعية (النساء):');
  lines.push(MARITAL_FEMALE.map(m => `${m.label} (${m.value})`).join(' | '));
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push('✅ انتهى القالب الصالح للذكاء الاصطناعي');
  
  return lines.join('\n');
}

// إنشاء كائن فارغ للنموذج
export function createEmptyFormData(): Record<string, any> {
  return REGISTRATION_FIELDS.reduce((acc, f) => {
    acc[f.key] = f.defaultValue;
    return acc;
  }, {} as Record<string, any>);
}

// تحويل قيمة CSV إلى القيمة المناسبة (بدون فرض قيم افتراضية للحقول الفارغة)
export function parseCSVValue(field: FieldDefinition, value: string): any {
  if (value === undefined || value === null || value.trim() === '') {
    return '';
  }
  if (field.type === 'number') {
    const num = Number(value);
    return isNaN(num) ? '' : num;
  }
  if (field.type === 'checkbox') {
    return value === 'true' || value === '1' || value === 'نعم';
  }
  if (field.type === 'select' || field.type === 'radio') {
    // تحويل القيمة العربية إلى الإنجليزية إذا لزم الأمر
    if (field.optionsWithLabel) {
      const match = field.optionsWithLabel.find(o => o.label === value || o.value === value);
      return match?.value || value;
    }
    return value;
  }
  return value.trim();
}

// التحقق من صحة الحقل
export function validateField(field: FieldDefinition, value: any, formData?: Record<string, any>): string | null {
  // التحقق من الشرط
  if (field.conditionalOn && formData) {
    const conditionValue = formData[field.conditionalOn];
    const shouldValidate = Array.isArray(field.conditionalValue)
      ? field.conditionalValue.includes(conditionValue)
      : conditionValue === field.conditionalValue;
    if (!shouldValidate) return null; // الحقل غير مطلوب في هذه الحالة
  }

  // التحقق من الجنس
  if (field.genderSpecific && formData?.gender && field.genderSpecific !== formData.gender && field.genderSpecific !== 'both') {
    return null;
  }

  // الحقل المطلوب
  if (field.required) {
    if (value === undefined || value === null || value === '' || (typeof value === 'number' && value === 0)) {
      return `${field.label} مطلوب`;
    }
  }

  // الحد الأدنى للنص
  if (field.minLength && typeof value === 'string' && value.length < field.minLength) {
    return `${field.label} يجب أن يكون ${field.minLength} حرف على الأقل`; 
  }

  // الحد الأقصى للنص
  if (field.maxLength && typeof value === 'string' && value.length > field.maxLength) {
    return `${field.label} يجب أن يكون ${field.maxLength} حرف على الأكثر`; 
  }

  // الحد الأدنى للرقم
  if (field.min && typeof value === 'number' && value < field.min) {
    return `${field.label} يجب أن يكون ${field.min} على الأقل`; 
  }

  // الحد الأقصى للرقم
  if (field.max && typeof value === 'number' && value > field.max) {
    return `${field.label} يجب أن يكون ${field.max} على الأكثر`; 
  }

  // الخيارات
  if (field.options && value && !field.options.includes(value)) {
    return `${field.label} يجب أن يكون أحد: ${field.options.join(', ')}`; 
  }

  if (field.optionsWithLabel && value) {
    const validValues = field.optionsWithLabel.map(o => o.value);
    const validLabels = field.optionsWithLabel.map(o => o.label);
    if (!validValues.includes(value) && !validLabels.includes(value)) {
      return `${field.label} يجب أن يكون أحد: ${validLabels.join(', ')}`; 
    }
  }

  return null;
}

// التحقق من صحة جميع الحقول
export function validateAllFields(formData: Record<string, any>): Record<string, string> {
  const errors: Record<string, string> = {}; 
  REGISTRATION_FIELDS.forEach(field => {
    const error = validateField(field, formData[field.key], formData);
    if (error) errors[field.key] = error; 
  });
  return errors;
}

// تحويل البيانات من CSV إلى كائن مع مطابقة ذكية للترادفات
export function parseCSVRow(headers: string[], row: string[]): Record<string, any> {
  const data: Record<string, any> = {}; 
  const fields = getCSVFields();
  
  headers.forEach((header, idx) => {
    const rawVal = (row[idx] ?? '').trim();
    const trimmedHeader = (header || '').trim();
    if (!trimmedHeader) return;

    data[trimmedHeader] = rawVal;
    const lowerHeader = trimmedHeader.toLowerCase();

    // البحث المباشر
    let field = fields.find(f => 
      f.csvColumn === trimmedHeader || 
      f.label === trimmedHeader || 
      f.key === trimmedHeader ||
      (f.labelEn && f.labelEn.toLowerCase() === lowerHeader) ||
      (f.csvColumn && f.csvColumn.toLowerCase() === lowerHeader)
    );

    // مطابقة الترادفات الشائعة باللغتين
    if (!field) {
      if (['real_name', 'realname', 'الاسم الحقيقي', 'الاسم الكامل', 'الاسم الرباعي', 'اسم العضو'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'realName');
      } else if (['nickname', 'الاسم المستعار', 'اللقب', 'الاسم'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'nickname');
      } else if (['gender', 'الجنس', 'النوع', 'ذكر/أنثى', 'ذكر او انثى'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'gender');
      } else if (['marriage_type', 'marriagetype', 'نوع الزواج', 'نوع_الزواج', 'الزواج المطلوب'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'marriageType');
      } else if (['tribe', 'القبيلة', 'القبيلة / النسب', 'القبيلة أو العائلة', 'النسب', 'العائلة'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'tribe');
      } else if (['sect', 'المذهب', 'المذهب الديني'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'sect');
      } else if (['nationality', 'الجنسية', 'جنسية العضو'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'nationality');
      } else if (['p_notes', 'pnotes', 'partner_notes', 'partnernotes', 'مواصفات الشريك', 'شروط الشريك', 'شروطي', 'مواصفات الشريك المطلوب'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'pNotes');
      } else if (['birth_date', 'birthdate', 'تاريخ الميلاد', 'تاريخ_الميلاد'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'birthDate');
      } else if (['marital_status', 'maritalstatus', 'الحالة الاجتماعية', 'الحالة_الاجتماعية'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'maritalStatus');
      } else if (['skin_color', 'skincolor', 'لون البشرة', 'البشرة'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'skinColor');
      } else if (['work_type', 'worktype', 'نوع العمل', 'العمل'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'workType');
      } else if (['job_title', 'jobtitle', 'الوظيفة', 'المسمى الوظيفي', 'الوظيفة الحالية', 'المهنة'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'jobTitle');
      } else if (['education', 'المؤهل', 'المؤهل العلمي', 'التعليم', 'المستوى التعليمي'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'education');
      } else if (['housing', 'السكن', 'نوع السكن', 'طبيعة السكن'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'housing');
      } else if (['partner_country', 'p_country', 'pcountry', 'دولة الشريك', 'الدولة المطلوبة', 'بلد الشريك'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'pCountry');
      } else if (['partner_city', 'partner_cities', 'p_city', 'pcity', 'مدينة الشريك', 'مدن الشريك', 'المدينة المطلوبة', 'المدن المقبولة للشريك'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'pCity');
      } else if (['partner_nationality', 'p_nationality', 'pnationality', 'جنسية الشريك', 'الجنسية المطلوبة', 'جنسية الشريك المطلوب'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'pNationality');
      } else if (['partner_age_min', 'p_age_min', 'pagemin', 'عمر الشريك (من)', 'عمر الشريك من', 'العمر المطلوب (من)', 'أدنى عمر للشريك'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'pAgeMin');
      } else if (['partner_age_max', 'p_age_max', 'pagemax', 'عمر الشريك (إلى)', 'عمر الشريك الى', 'العمر المطلوب (إلى)', 'أعلى عمر للشريك'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'pAgeMax');
      } else if (['partner_marital_status', 'p_marital_status', 'الحالة الاجتماعية المقبولة', 'حالة الشريك الاجتماعية'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'pMaritalStatus');
      } else if (['accept_foreigner', 'acceptforeigner', 'قبول غير مواطن / أجنبي', 'قبول غير مواطن', 'قبول أجنبي', 'يقبل أجنبي'].includes(lowerHeader)) {
        data['acceptForeigner'] = rawVal;
        data['accept_foreigner'] = rawVal;
      } else if (['phone', 'mobile', 'الهاتف', 'رقم الهاتف', 'الجوال', 'رقم الجوال', 'التلفون', 'whatsapp', 'واتساب', 'واتس', 'رقم الواتساب', 'الواتساب'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'whatsapp');
      } else if (['notes', 'note', 'ملاحظات', 'تفاصيل', 'الوصف', 'نبذة', 'نبذة عني', 'مواصفاتي', 'بيانات اضافية', 'بيانات إضافية'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'bio');
      } else if (['admin_notes', 'adminnotes', 'ملاحظات إدارية', 'ملاحظات إدارية (لا تظهر للعضو)', 'ملاحظات الإدارة', 'ملاحظات خاصة'].includes(lowerHeader)) {
        data['adminNotes'] = rawVal;
        data['admin_notes'] = rawVal;
      } else if (['khataaba_phone', 'khataabaphone', 'هاتف الخطابة', 'جوال الخطابة', 'رقم الخطابة', 'هاتف المكتب'].includes(lowerHeader)) {
        data['khataabaPhone'] = rawVal;
        data['khataaba_phone'] = rawVal;
      } else if (['khataaba_name', 'khataabaname', 'اسم الخطابة', 'الخطابة', 'المكتب', 'اسم المكتب'].includes(lowerHeader)) {
        data['khataabaName'] = rawVal;
        data['khataaba_name'] = rawVal;
      } else if (['height', 'الطول', 'طول القامة'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'height');
      } else if (['weight', 'الوزن', 'وزن الجسم'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'weight');
      } else if (['age', 'العمر', 'سن', 'السن'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'age');
      } else if (['country', 'الدولة', 'بلد الاقامة', 'بلد الإقامة', 'البلد'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'country');
      } else if (['city', 'المدينة', 'منطقة السكن', 'المحافظة'].includes(lowerHeader)) {
        field = fields.find(f => f.key === 'city');
      }
    }

    if (field) {
      data[field.key] = parseCSVValue(field, rawVal);
      if (field.csvColumn) {
        data[field.csvColumn] = rawVal;
      }
    }
  });
  
  return data;
}

// تحويل الكائن إلى صف CSV
export function objectToCSVRow(obj: Record<string, any>): string {
  const fields = getCSVFields();
  return fields.map(f => {
    const value = obj[f.key];
    if (value === undefined || value === null) return '';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  }).join(',');
}
