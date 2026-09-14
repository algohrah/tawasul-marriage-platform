import type { Gender } from './types';

// ====================================================================
//  واجهة العضو — مطابقة لحقول نموذج التسجيل
// ====================================================================
export interface Member {
  id: string;
  nickname: string;        // الاسم المستعار
  username?: string;       // اسم المستخدم / اليوزر
  gender: Gender;          // الجنس
  age: number;             // العمر
  country: string;         // الدولة
  city: string;            // المدينة
  district: string;        // المنطقة / الحي
  nationality: string;     // الجنسية
  sect: string;            // المذهب
  maritalStatus: string;   // الحالة الاجتماعية (قيمة)
  maritalLabel: string;    // الحالة الاجتماعية (نص عربي صحيح حسب الجنس)
  marriageType?: string;   // نوع الزواج (announced | misyar | both)
  marriageTypeLabel?: string; // نوع الزواج بالعربي (معلن | مسيار | لا مانع / معلن او مسيار)
  tribe?: string;          // القبيلة / النسب
  hasChildren: boolean;    // لديه أبناء
  childrenCount: string;   // عدد الأبناء
  // شخصية
  height: number;          // الطول
  weight: number;          // الوزن
  skinColor: string;       // لون البشرة
  health: string;          // الحالة الصحية
  smoking: string;         // التدخين
  ethnicity?: string;      // العرق
  // تعليم وعمل
  education: string;       // المؤهل
  workType: string;        // نوع جهة العمل
  jobTitle: string;        // المسمى الوظيفي
  housing: string;         // نوع السكن
  bio: string;             // نبذة عني
  // مواصفات الشريك
  aboutPartner: string;    // وصف الشريك المطلوب
  // حالة الحساب
  verified: boolean;       // موثق
  premium: boolean;        // عضو ذهبي/نخبة
  online: boolean;         // متصل
  lastActive: string;      // آخر ظهور
  matchScore?: number;     // نسبة التوافق
  hasSeriousnessBadge?: boolean; // وسام الجدية المعتمد
  plan?: 'free' | 'gold' | 'elite'; // باقة العضو الحالية
  pinned?: boolean; // هل العضو مثبت من الإدارة؟
  isManagedByAdmin?: boolean;
  managedByAdminId?: string;
  // ===== حقول الاستيراد =====
  sourceType?: 'registered' | 'imported';  // نوع المصدر
  importBatchId?: string;      // معرف الدفعة
  importOfficeName?: string;   // اسم الخطابة
  importDate?: string;         // تاريخ الاستيراد
  importNotes?: string;        // ملاحظات الاستيراد
  isProfileIncomplete?: boolean; // هل الملف الشخصي غير مكتمل؟
  status?: 'active' | 'suspended' | 'pending' | 'banned';
  email?: string;
  phone?: string;
  whatsapp?: string;
  realName?: string;
  birthDate?: string;
  password?: string;
}

// ===== 8 أعضاء تجريبيين — مطابقين لحقول التسجيل =====
export const MEMBERS: Member[] = [
  {
    id: 'm1',
    nickname: 'أبو عبدالله',
    username: 'abu_abdullah',
    gender: 'male', age: 32,
    country: 'السعودية', city: 'الرياض', district: 'حي العليا',
    nationality: 'السعودية', sect: 'سني',
    maritalStatus: 'single', maritalLabel: 'أعزب',
    hasChildren: false, childrenCount: 'لا يوجد',
    height: 178, weight: 78, skinColor: 'أبيض قمحي',
    health: 'ممتازة', smoking: 'لا أدخن',
    education: 'ماجستير', workType: 'حكومي', jobTitle: 'مهندس مدني',
    housing: 'أملك منزل',
    bio: 'مهندس طموح أحب الحياة المستقرة، أبحث عن شريكة تكملني وتشاركني رحلة الحياة بإذن الله.',
    aboutPartner: 'أبحث عن شريكة متعلمة، هادئة، تحب العائلة وتطمح لبناء بيت مستقر على القيم الإسلامية.',
    verified: true, premium: true, online: true, lastActive: 'متصل الآن', matchScore: 94, hasSeriousnessBadge: true,
  },
  {
    id: 'm2',
    nickname: 'باحثة عن الستر',
    username: 'sara_qht',
    gender: 'female', age: 27,
    country: 'السعودية', city: 'جدة', district: 'حي الروضة',
    nationality: 'السعودية', sect: 'سني',
    maritalStatus: 'single', maritalLabel: 'عزباء',
    hasChildren: false, childrenCount: 'لا يوجد',
    height: 165, weight: 58, skinColor: 'أبيض',
    health: 'ممتازة', smoking: 'لا أدخن',
    education: 'بكالوريوس', workType: 'عمل حر', jobTitle: 'معلمة',
    housing: 'أسكن مع العائلة',
    bio: 'معلمة أحب العلم والمعرفة، أؤمن أن الزواج شراكة عقول قبل القلوب، أبحث عن سكني ومستقر.',
    aboutPartner: 'أبحث عن رجل مثقف، ناضج، يحترم العائلة ويقدّر طموحي ويخاف الله.',
    verified: true, premium: true, online: false, lastActive: 'آخر ظهور منذ ساعة', matchScore: 96,
  },
  {
    id: 'm3',
    nickname: 'القحطاني',
    username: 'fahad_dows',
    gender: 'male', age: 35,
    country: 'السعودية', city: 'الدمام', district: 'حي الشاطئ',
    nationality: 'السعودية', sect: 'سني',
    maritalStatus: 'divorced', maritalLabel: 'مطلق',
    hasChildren: false, childrenCount: 'لا يوجد',
    height: 180, weight: 85, skinColor: 'حنطي',
    health: 'جيدة', smoking: 'سابقة وتركت',
    education: 'بكالوريوس', workType: 'عمل حر', jobTitle: 'رجل أعمال',
    housing: 'أملك منزل',
    bio: 'رجل أعمال ناجح، خبرة الحياة علّمتني الصبر والحكمة، أبحث عن شريكة تكملني بصدق.',
    aboutPartner: 'أبحث عن امرأة ناضجة، واثقة، تفهم معنى الشراكة وتقدّر الاستقرار العائلي.',
    verified: true, premium: true, online: false, lastActive: 'آخر ظهور منذ 3 ساعات', matchScore: 88, hasSeriousnessBadge: true,
  },
  {
    id: 'm4',
    nickname: 'أم محمد',
    username: 'noura_otb',
    gender: 'female', age: 30,
    country: 'السعودية', city: 'مكة المكرمة', district: 'حي العزيزية',
    nationality: 'السعودية', sect: 'سني',
    maritalStatus: 'divorced', maritalLabel: 'مطلقة',
    hasChildren: true, childrenCount: '1',
    height: 162, weight: 60, skinColor: 'حنطي مائل للسمار',
    health: 'ممتازة', smoking: 'لا أدخن',
    education: 'دبلوم', workType: 'عمل حر', jobTitle: 'مصممة أزياء',
    housing: 'أسكن مع العائلة',
    bio: 'أم لطفل واحد، أحب الحياة العائلية، أبحث عن رجل يعرف معنى المسؤولية ويقبل ابني كابن له.',
    aboutPartner: 'أبحث عن رجل متدين، حنون، يقبل أبنائي ويبني معي حياة مستقرة ومستقيمة.',
    verified: true, premium: false, online: true, lastActive: 'متصل الآن', matchScore: 85,
  },
  {
    id: 'm5',
    nickname: 'العتيبي',
    username: 'majed_hrb',
    gender: 'male', age: 29,
    country: 'السعودية', city: 'الخبر', district: 'حي العقربية',
    nationality: 'السعودية', sect: 'سلفي',
    maritalStatus: 'single', maritalLabel: 'أعزب',
    hasChildren: false, childrenCount: 'لا يوجد',
    height: 175, weight: 72, skinColor: 'أبيض قمحي',
    health: 'ممتازة', smoking: 'لا أدخن',
    education: 'بكالوريوس', workType: 'حكومي', jobTitle: 'ضابط عسكري',
    housing: 'أملك منزل',
    bio: 'ضابط في القطاع العسكري، أحب الانضباط والاستقرار، أبحث عن شريكة حياة تقف بجانبي.',
    aboutPartner: 'أبحث عن فتاة طموحة، دافئة، تحب الحياة العائلية البسيطة وتخاف الله.',
    verified: true, premium: false, online: true, lastActive: 'متصل الآن', matchScore: 91, hasSeriousnessBadge: true,
  },
  {
    id: 'm6',
    nickname: 'أم عبدالرحمن',
    username: 'reem_shh',
    gender: 'female', age: 25,
    country: 'السعودية', city: 'المدينة المنورة', district: 'حي قباء',
    nationality: 'السعودية', sect: 'سني',
    maritalStatus: 'single', maritalLabel: 'عزباء',
    hasChildren: false, childrenCount: 'لا يوجد',
    height: 168, weight: 56, skinColor: 'أبيض',
    health: 'ممتازة', smoking: 'لا أدخن',
    education: 'ماجستير', workType: 'حكومي', jobTitle: 'محاضرة جامعية',
    housing: 'أسكن مع العائلة',
    bio: 'محاضرة جامعية شغوفة بالعلم، أؤمن أن خير البيوت من اختارها أهلها على دينها وخلقها.',
    aboutPartner: 'أبحث عن رجل متعلم، ذو خلق ودين، يحترم طموحي ويعينني على الآخرة والدنيا.',
    verified: true, premium: true, online: false, lastActive: 'آخر ظهور أمس', matchScore: 93,
  },
  {
    id: 'm7',
    nickname: 'أبو فيصل',
    username: 'sultan_qrn',
    gender: 'male', age: 40,
    country: 'السعودية', city: 'أبها', district: 'حي المنهل',
    nationality: 'السعودية', sect: 'سني',
    maritalStatus: 'widower', maritalLabel: 'أرمل',
    hasChildren: true, childrenCount: '2',
    height: 172, weight: 80, skinColor: 'أسمر',
    health: 'جيدة', smoking: 'لا أدخن',
    education: 'بكالوريوس', workType: 'عمل حر', jobTitle: 'تاجر',
    housing: 'أملك منزل',
    bio: 'تاجر وأب لطفلين، رزقني الله الصبر بعد فقد زوجتي، أبحث عن أم حنونة لأبنائي وشريكة حياة.',
    aboutPartner: 'أبحث عن امرأة صالحة، حنونة، تقبل أبنائي وتكون لهم أمًا، وتشاركني الحياة بإذن الله.',
    verified: true, premium: true, online: false, lastActive: 'آخر ظهور منذ يومين', matchScore: 82,
  },
  {
    id: 'm8',
    nickname: 'بنت الخليج',
    username: 'latifa_ahmd',
    gender: 'female', age: 24,
    country: 'الإمارات', city: 'دبي', district: 'حي الكرامة',
    nationality: 'الإمارات', sect: 'سني',
    maritalStatus: 'single', maritalLabel: 'عزباء',
    hasChildren: false, childrenCount: 'لا يوجد',
    height: 160, weight: 52, skinColor: 'أبيض جدا',
    health: 'ممتازة', smoking: 'لا أدخن',
    education: 'بكالوريوس', workType: 'باحث عن عمل', jobTitle: 'محاسبة',
    housing: 'أسكن مع العائلة',
    bio: 'محاسبة هادئة الطباع، أحب العائلة والاستقرار، أبحث عن شريك حياة جاد وحسن الخلق.',
    aboutPartner: 'أبحث عن رجل متدين، مستقر ماديًا، يحب العائلة ويقدّر معنى الزواج الحقيقي.',
    verified: false, premium: false, online: true, lastActive: 'متصل الآن', matchScore: 89,
  },
  {
    id: 'reg-m101',
    sourceType: 'registered',
    nickname: 'سلمان بن خالد',
    name: 'سلمان بن خالد',
    displayName: 'سلمان بن خالد',
    username: 'salman_khaled',
    gender: 'male',
    age: 35,
    country: 'السعودية',
    city: 'الرياض',
    district: 'حي النخيل',
    nationality: 'السعودية',
    sect: 'سني',
    maritalStatus: 'single',
    maritalLabel: 'أعزب',
    marriageType: 'announced',
    marriageTypeLabel: 'معلن (عادي)',
    tribe: 'عنزة',
    ethnicity: 'عربي',
    hasChildren: false,
    childrenCount: '',
    childrenLiveWith: '',
    wifeCount: '',
    seekingWife: '',
    acceptPolygamy: '',
    acceptDivorced: 'أقبل بالمطلقة',
    acceptWithChildren: 'أقبل بالأبناء بشروط',
    height: 182,
    weight: 82,
    skinColor: 'أبيض قمحي',
    health: 'ممتازة (سليم)',
    smoking: 'لا أدخن',
    education: 'ماجستير',
    workType: 'قطاع خاص',
    jobTitle: 'مدير مشاريع تقنية',
    housing: 'أملك منزل',
    bio: 'مهندس وتقني طموح، هادئ ومحافظ، أعمل مديرًا للمشاريع في إحدى كبرى الشركات بالرياض. أحب الرياضات المائية، القراءة، والتطوير الذاتي. أبحث عن شريكة حياة تناسب طموحي وتشاركني بناء بيت مستقر وقائم على المودة والتفاهم والتواصل الراقي.',
    aboutPartner: 'أبحث عن فتاة متعلمة (بكالوريوس أو أعلى)، تخاف الله، تتمتع بحس عالي من المسؤولية والهدوء، تقدّر الحياة الأسرية وترغب في بناء بيت سعيد قائم على الاحترام والمودة.',
    pCountry: 'السعودية',
    pCity: 'الرياض، جدة، الشرقية',
    pAgeMin: 23,
    pAgeMax: 30,
    pNationality: 'السعودية',
    pMaritalStatus: 'عزباء',
    pAcceptChildren: 'لا يهم',
    pSect: 'سني',
    pEducation: 'بكالوريوس فأعلى',
    pWorkType: 'لا يهم',
    pSkinColor: 'أبيض أو حنطي',
    pHousing: 'سكن مستقل',
    pNotes: 'أن تكون ذات دين وخلق رفيع، تحب الاستقرار وتتعامل بحكمة مع متطلبات الحياة.',
    email: 'salman.khaled.sa@gmail.com',
    phone: '+966509876543',
    whatsapp: '+966509876543',
    realName: 'سلمان خالد عبدالعزيز آل سعود',
    birthDate: '1991-05-14',
    password: 'Salman@2026Password',
    status: 'active',
    plan: 'elite',
    verified: true,
    premium: true,
    online: true,
    lastActive: 'متصل الآن',
    hasSeriousnessBadge: true,
    matchScore: 97,
  },
  {
    id: 'reg-f102',
    sourceType: 'registered',
    nickname: 'جوهره الرياض',
    name: 'جوهره الرياض',
    displayName: 'جوهره الرياض',
    username: 'jawhara_alriyadh',
    gender: 'female',
    age: 30,
    country: 'السعودية',
    city: 'الرياض',
    district: 'حي حطين',
    nationality: 'السعودية',
    sect: 'سني',
    maritalStatus: 'single',
    maritalLabel: 'عزباء',
    marriageType: 'announced',
    marriageTypeLabel: 'معلن (عادي)',
    tribe: 'عتيبة',
    ethnicity: 'عربي',
    hasChildren: false,
    childrenCount: '',
    childrenLiveWith: '',
    wifeCount: '',
    seekingWife: '',
    acceptPolygamy: 'لا أقبل التعدد',
    acceptDivorced: 'أقبل بوجود سبب مقنع',
    acceptWithChildren: 'أقبل إذا كان العدد قليلاً',
    height: 166,
    weight: 59,
    skinColor: 'أبيض',
    health: 'ممتازة',
    smoking: 'لا أدخن',
    education: 'بكالوريوس',
    workType: 'حكومي',
    jobTitle: 'أخصائية جودة وتطوير',
    housing: 'أسكن مع العائلة',
    bio: 'امرأة طموحة، هادئة الطباع ومثقفة، أعمل أخصائية جودة وتطوير بالقطاع الحكومي بمدينة الرياض. أهتم بالقراءة، التصميم الداخلي، والتطوير المهني. أبحث عن رجل يكون سكنًا وسندًا حقيقيًا، يقدر الحياة الزوجية ويخاف الله.',
    aboutPartner: 'أبحث عن رجل متدين، صادق، خلوق ونبيل النفس، يملك وظيفة مستقرة، يحترم طموح المرأة، ويحرص على بناء أسرة يسودها التفاهم والرحمة.',
    pCountry: 'السعودية',
    pCity: 'الرياض',
    pAgeMin: 31,
    pAgeMax: 39,
    pNationality: 'السعودية',
    pMaritalStatus: 'أعزب، مطلق',
    pAcceptChildren: 'أقبل بشروط',
    pSect: 'سني',
    pEducation: 'بكالوريوس فأعلى',
    pWorkType: 'حكومي أو قطاع خاص استقراري',
    pSkinColor: 'لا يهم',
    pHousing: 'سكن مستقل خاص',
    pNotes: 'رجل ناضج، غير مدخن، قادر على تحمل مسؤوليات الزواج وبناء مستقبل أسري مستقر.',
    email: 'jawhara.ateebi.sa@gmail.com',
    phone: '+966501122334',
    whatsapp: '+966501122334',
    realName: 'الجوهرة عبدالله سعد العتيبي',
    birthDate: '1996-09-22',
    password: 'Jawhara@2026Password',
    status: 'active',
    plan: 'elite',
    verified: true,
    premium: true,
    online: true,
    lastActive: 'متصل الآن',
    hasSeriousnessBadge: true,
    matchScore: 98,
  },
  {
    id: 'imp-88001',
    sourceType: 'imported',
    nickname: 'سارة آل تميم',
    name: 'سارة آل تميم',
    displayName: 'سارة آل تميم (كود #88001)',
    username: 'sara_tamim_88001',
    gender: 'female',
    age: 26,
    country: 'السعودية',
    city: 'الرياض',
    district: 'حي الصحافة',
    nationality: 'السعودية',
    sect: 'سني',
    maritalStatus: 'single',
    maritalLabel: 'عزباء',
    marriageType: 'announced',
    marriageTypeLabel: 'معلن (عادي)',
    tribe: 'بني تميم',
    ethnicity: 'عربي (قبيلي)',
    hasChildren: false,
    childrenCount: 'لا يوجد',
    acceptPolygamy: 'لا أقبل التعدد',
    acceptDivorced: 'أقبل بالمطلق دون أطفال',
    acceptWithChildren: 'لا أفضل ذلك',
    height: 167,
    weight: 58,
    skinColor: 'أبيض',
    health: 'ممتازة (سليمة ولله الحمد)',
    smoking: 'لا تدخن',
    education: 'بكالوريوس',
    workType: 'قطاع حكومي',
    jobTitle: 'أخصائية إدارية في جهة حكومية',
    housing: 'تسكن مع الأسرة',
    bio: 'فتاة هادئة ومحافظة، ذات خلق ودين، من عائلة كريمة ومحترمة بالرياض. تهتم بالاستقرار وبناء بيت مسلم على المودة والرحمة. (هذا الملف مرفوع ومنسق عبر وساطة الإدارة مع الخطابة).',
    aboutPartner: 'شاب قبيلي من عائلة محترمة، أعزب أو مطلق بدون أطفال، عمره بين 27 و 35 سنة، جامعي، موظف مستقر مادياً، غير مدخن ويخاف الله ويقدر الحياة الزوجية.',
    pCountry: 'السعودية',
    pCity: 'الرياض',
    pAgeMin: 27,
    pAgeMax: 35,
    pNationality: 'السعودية',
    pMaritalStatus: 'أعزب، مطلق بدون أطفال',
    pAcceptChildren: 'لا أقبل',
    pSect: 'سني',
    pEducation: 'بكالوريوس فأعلى',
    pWorkType: 'موظف حكومي أو قطاع خاص مستقر',
    pSkinColor: 'أبيض أو حنطي',
    pHousing: 'سكن مستقل',
    pNotes: 'أن يكون رجل كفؤ، صاحب خلق ودين، جاد بالزواج وقادر على فتح بيت مستقر.',
    email: 'admin.imported.88001@twafok.com',
    phone: '+96655588001',
    whatsapp: '+96655588001',
    realName: 'سارة بنت تميم التميمي',
    birthDate: '2000-01-15',
    importOfficeName: 'أم فهد (وساطة وتنسيق الإدارة)',
    importBatchId: 'batch-khataaba-01',
    importDate: '2026-09-10',
    status: 'active',
    plan: 'gold',
    verified: false,
    premium: true,
    online: false,
    lastActive: 'مرفوع عبر وساطة الإدارة',
    hasSeriousnessBadge: true,
    matchScore: 96,
  },
  {
    id: 'imp-88002',
    sourceType: 'imported',
    nickname: 'المهندس عبدالعزيز',
    name: 'المهندس عبدالعزيز',
    displayName: 'المهندس عبدالعزيز (كود #88002)',
    username: 'eng_abdulaziz_88002',
    gender: 'male',
    age: 33,
    country: 'السعودية',
    city: 'الرياض',
    district: 'حي الملقا',
    nationality: 'السعودية',
    sect: 'سني',
    maritalStatus: 'single',
    maritalLabel: 'أعزب',
    marriageType: 'announced',
    marriageTypeLabel: 'معلن (عادي)',
    tribe: 'قحطان',
    ethnicity: 'عربي (قبيلي)',
    hasChildren: false,
    childrenCount: 'لا يوجد',
    acceptPolygamy: 'لا أرغب بالتعدد',
    acceptDivorced: 'أقبل بالمطلقة',
    acceptWithChildren: 'أقبل بطفل واحد كحد أقصى',
    height: 180,
    weight: 79,
    skinColor: 'حنطي فاتح',
    health: 'ممتازة ورياضي',
    smoking: 'لا أدخن',
    education: 'ماجستير هندسة نظم',
    workType: 'قطاع شبه حكومي',
    jobTitle: 'مهندس أول مشاريع',
    housing: 'أملك شقة تمليك مؤثثة بالكامل',
    bio: 'مهندس شاب طموح، هادئ ومحافظ، أمارس الرياضة والقراءة، جاهز ومستعد مادياً للزواج في سكن خاص ومستقل. (هذا الملف مرفوع ومنسق عبر وساطة الإدارة مع الخطابة).',
    aboutPartner: 'فتاة ذات دين وخلق وأصل طيب، عمرها بين 22 و 29 سنة، جامعية، خلوقة، تقدّر الهدوء والاستقرار والشراكة الإيجابية في بناء الأسرة.',
    pCountry: 'السعودية',
    pCity: 'الرياض أو الخرج أو الشرقية',
    pAgeMin: 22,
    pAgeMax: 29,
    pNationality: 'السعودية',
    pMaritalStatus: 'عزباء أو مطلقة بدون أطفال',
    pAcceptChildren: 'لا أفضل',
    pSect: 'سني',
    pEducation: 'جامعية',
    pWorkType: 'لا يهم (موظفة أو غير موظفة)',
    pSkinColor: 'بيضاء أو حنطية',
    pHousing: 'سكن مستقل',
    pNotes: 'ذات أصل وخلق، حسنة المظهر والتعامل، تبحث عن الاستقرار وبناء أسرة سعيدة.',
    email: 'admin.imported.88002@twafok.com',
    phone: '+96655588002',
    whatsapp: '+96655588002',
    realName: 'عبدالعزيز خالد القحطاني',
    birthDate: '1993-04-10',
    importOfficeName: 'أم سعود (وساطة وتنسيق الإدارة)',
    importBatchId: 'batch-khataaba-01',
    importDate: '2026-09-10',
    status: 'active',
    plan: 'elite',
    verified: true,
    premium: true,
    online: true,
    lastActive: 'مرفوع عبر وساطة الإدارة',
    hasSeriousnessBadge: true,
    matchScore: 98,
  },
];

// يقرأ تعديلات الإدارة المحفوظة (saved_members_list) أولاً كي تظهر
// أي موافقة أو تعديل أجرته الإدارة لجميع الأطراف، ثم يسقط للقائمة الأصلية.
export function getMemberById(id: string): Member | undefined {
  let member: Member | undefined;
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('saved_members_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const found = parsed.find((m: Member) => m.id === id);
          if (found) member = found;
        }
      }
    } catch { /* تجاهل */ }
  }
  if (!member) {
    member = MEMBERS.find((m) => m.id === id);
  }
  // التحقق من حالة العضو في adminMeta — إخفاء المحذوفين والمحظورين والمجمّدين
  if (member && typeof window !== 'undefined') {
    try {
      const metaRaw = localStorage.getItem('twafok_admin_meta_v1');
      if (metaRaw) {
        const meta = JSON.parse(metaRaw);
        const m = meta[member.id];
        if (m) {
          if (m.deleted) return undefined;
          if (m.status && m.status !== 'active') return undefined;
        }
        if (member.status && member.status !== 'active') return undefined;
      }
    } catch { /* تجاهل */ }
  }
  return member;
}
