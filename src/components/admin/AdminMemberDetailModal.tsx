import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../ui/Modal';
import {
  Edit, Eye, Lock, BadgeCheck, Crown, UserCheck, UserX, Flag, Send,
  LogIn, Trash2, Copy, KeyRound, AlertCircle, Fingerprint, Mail, Phone,
  StickyNote, Ban, Award, Pin, Loader2, Save, RefreshCw, User, Heart,
  Ruler, GraduationCap, FileText, Check,
} from 'lucide-react';
import { useAdminMembers } from '../../lib/useAdminData';
import { useApp } from '../../lib/AppContext';
import { dataService } from '../../lib/data/DataService';
import supabase from '../../lib/supabase';
import * as C from '../../lib/constants';
import {
  Field, TextInput, SelectInput, TextArea, RadioGroup,
  DateSelect, SelectWithOther,
} from '../ui/FormFields';
import SearchableSelect from '../ui/SearchableSelect';
import MultiSearchableSelect from '../ui/MultiSearchableSelect';
import {
  getSelfMaritalOptions,
  getPartnerMaritalOptions,
  getPartnerTerms,
  getUnifiedCountries,
  getUnifiedCitiesForCountry,
  getUnifiedCitiesForPartnerCountries,
  getUnifiedNationalities,
  getUnifiedSects,
  getUnifiedSkinColors,
  getUnifiedSkinColorOptions,
  getUnifiedEducationLevels,
  getUnifiedWorkTypes,
  getUnifiedHousingTypes,
  getUnifiedSmokingOptions,
  getChildrenCountList,
} from '../../lib/registrationOptions';
import { getMemberSourceAndDate, getPartnerSummary } from '../../lib/memberUtils';

interface AdminMemberDetailModalProps {
  member: any | null;
  open: boolean;
  onClose: () => void;
  initialEditing?: boolean;
  onUpdated?: () => void;
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  active: { label: 'نشط', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  pending: { label: 'قيد المراجعة', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  suspended: { label: 'موقوف', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  banned: { label: 'محظور نهائياً', color: 'bg-rose-100 text-rose-700', dot: 'bg-rose-600' },
  inactive: { label: 'غير نشط', color: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
};
const getStatusCfg = (st?: string) => statusConfig[st || 'active'] || { label: st, color: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' };
const getPlanCfg = (p?: string) => {
  if (p === 'gold') return { label: 'الذهبية', color: 'bg-amber-100 text-amber-800' };
  if (p === 'elite') return { label: 'المميز 👑', color: 'bg-purple-100 text-purple-800' };
  return { label: 'المجانية', color: 'bg-slate-100 text-slate-700' };
};

export default function AdminMemberDetailModal({ member, open, onClose, initialEditing = false, onUpdated }: AdminMemberDetailModalProps) {
  const navigate = useNavigate();
  const { impersonateUser, showToast: globalShowToast } = useApp();
  const { updateMember, deleteMember, toggleVerified, setPremium, setNote, toggleFlag } = useAdminMembers();

  const [isEditing, setIsEditing] = useState(initialEditing);
  const [activeEditTab, setActiveEditTab] = useState<'profile' | 'account'>('profile');
  const [activeViewTab, setActiveViewTab] = useState<'basic' | 'partner'>('basic');
  const [editForm, setEditForm] = useState<any>({});
  const [showPassword, setShowPassword] = useState(false);
  const [revealSensitive, setRevealSensitive] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteFor, setDeleteFor] = useState<any | null>(null);
  const [notifyFor, setNotifyFor] = useState<any | null>(null);
  const [notifyText, setNotifyText] = useState('');
  const [localToast, setLocalToast] = useState<string | null>(null);

  // partner pref toggle states — same as EditProfile
  const [pCountryCustomOpen, setPCountryCustomOpen] = useState(false);
  const [pCityCustomOpen, setPCityCustomOpen] = useState(false);
  const [pNationalityCustomOpen, setPNationalityCustomOpen] = useState(false);

  const showLocalToast = (msg: string) => { setLocalToast(msg); globalShowToast?.(msg); setTimeout(() => setLocalToast(null), 3000); };

  const set = (key: string, value: any) => setEditForm((prev: any) => ({ ...prev, [key]: value }));

  const countryOptions = useMemo(() => getUnifiedCountries(), []);
  const cities = useMemo(() => getUnifiedCitiesForCountry(editForm.country || ''), [editForm.country]);
  const nationalityOptions = useMemo(() => getUnifiedNationalities(editForm.gender as any, countryOptions), [editForm.gender, countryOptions]);
  const partnerNationalityOptions = useMemo(() => {
    const opposite = editForm.gender === 'male' ? 'female' : 'male';
    return getUnifiedNationalities(opposite as any, countryOptions);
  }, [editForm.gender, countryOptions]);

  const pCities = useMemo(() => getUnifiedCitiesForPartnerCountries(editForm.pCountry, editForm.country), [editForm.pCountry, editForm.country]);

  const pSelectedCountries = useMemo(() => {
    if (!editForm.pCountry || editForm.pCountry === 'لا يهم') return [];
    return editForm.pCountry.split('،').map((s: string) => s.trim()).filter(Boolean);
  }, [editForm.pCountry]);
  const pSelectedCities = useMemo(() => {
    if (!editForm.pCity || editForm.pCity === 'لا يهم') return [];
    return editForm.pCity.split('،').map((s: string) => s.trim()).filter(Boolean);
  }, [editForm.pCity]);
  const pSelectedNationalities = useMemo(() => {
    const v = editForm.pNationality;
    if (!v || v === 'لا يهم' || v === 'نفس جنسيتي' || v === 'اقبل اجنبي' || v === 'أقبل أجنبي') return [];
    return v.split('،').map((s: string) => s.trim()).filter(Boolean);
  }, [editForm.pNationality]);
  const partnerMaritalOptions = useMemo(() => getPartnerMaritalOptions(editForm.gender as any), [editForm.gender]);

  const isAllMaritalSelected = useMemo(() => {
    if (!editForm.pMaritalStatus || editForm.pMaritalStatus === 'لا يهم') return true;
    const items = editForm.pMaritalStatus.split('،').map((s: string) => s.trim()).filter((s: string) => s && s !== 'لا يهم');
    return partnerMaritalOptions.length > 0 && partnerMaritalOptions.every((opt) => items.includes(opt));
  }, [editForm.pMaritalStatus, partnerMaritalOptions]);

  const pSelectedMarital = useMemo(() => {
    if (!editForm.pMaritalStatus || editForm.pMaritalStatus === 'لا يهم' || isAllMaritalSelected) {
      return ['لا يهم', ...partnerMaritalOptions];
    }
    return editForm.pMaritalStatus.split('،').map((s: string) => s.trim()).filter(Boolean);
  }, [editForm.pMaritalStatus, isAllMaritalSelected, partnerMaritalOptions]);

  const isSingleOnly = useMemo(() => {
    if (!editForm.pMaritalStatus || editForm.pMaritalStatus === 'لا يهم' || isAllMaritalSelected) return false;
    const items = editForm.pMaritalStatus.split('،').map((s: string) => s.trim()).filter((s: string) => s && s !== 'لا يهم');
    return items.length === 1 && (items[0] === 'عزباء' || items[0] === 'أعزب' || items[0] === 'single');
  }, [editForm.pMaritalStatus, isAllMaritalSelected]);

  const handleTogglePartnerMarital = (opt: string) => {
    if (!editForm.pMaritalStatus || editForm.pMaritalStatus === 'لا يهم' || isAllMaritalSelected) {
      set('pMaritalStatus', opt);
      return;
    }
    const current = editForm.pMaritalStatus.split('،').map((s: string) => s.trim()).filter((s: string) => s && s !== 'لا يهم');
    let updated: string[];
    if (current.includes(opt)) {
      updated = current.filter((m: string) => m !== opt);
    } else {
      updated = [...current, opt];
    }
    if (updated.length === 0 || partnerMaritalOptions.every((o) => updated.includes(o))) {
      set('pMaritalStatus', 'لا يهم');
    } else {
      set('pMaritalStatus', updated.join('، '));
    }
  };

  const isMale = editForm.gender === 'male';
  const isFemale = editForm.gender === 'female';
  const partnerTerms = useMemo(() => getPartnerTerms(editForm.gender as any), [editForm.gender]);

  const handleBirthDateChange = (date: string) => {
    set('birthDate', date); set('birth_date', date);
    if (date) {
      const birth = new Date(date); const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const md = today.getMonth() - birth.getMonth();
      if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--;
      set('age', age);
    }
  };

  const handleAddCity = (country: string) => (name: string) => dataService.db.addPendingGeo?.('city', name, country, 'الإدارة', 'admin') || { ok: true };
  const handleAddCountry = (name: string) => dataService.db.addPendingGeo?.('country', name, '', 'الإدارة', 'admin') || { ok: true };
  const handleAddNationality = (name: string) => dataService.db.addPendingGeo?.('nationality', name, editForm.country || '', 'الإدارة', 'admin') || { ok: true };

  useEffect(() => {
    if (open && member) {
      setIsEditing(initialEditing);
      const bd = member.birthDate || member.birth_date || (member.age ? `${new Date().getFullYear() - member.age}-01-01` : '');
      const details = member.details && typeof member.details === 'object' ? member.details : {};
      // تتلقى النافذة بياناتها من API ومن كاش الإدارة؛ نوحّد الشكل هنا حتى لا
      // تختفي تفضيلات الشريك المسجلة سابقاً بسبب اختلاف camelCase / snake_case.
      setEditForm({
        ...details,
        ...member,
        birthDate: bd,
        birth_date: bd,
        realName: member.realName || member.real_name || '',
        pCountry: member.pCountry || member.p_country || details.pCountry || 'لا يهم',
        pCity: member.pCity || member.p_city || details.pCity || 'لا يهم',
        pNationality: member.pNationality || member.p_nationality || details.pNationality || 'اقبل اجنبي',
        pAgeMin: member.pAgeMin ?? member.p_age_min ?? details.pAgeMin ?? '',
        pAgeMax: member.pAgeMax ?? member.p_age_max ?? details.pAgeMax ?? '',
        pMaritalStatus: member.pMaritalStatus || member.p_marital_status || details.pMaritalStatus || 'لا يهم',
        pAcceptChildren: member.pAcceptChildren || member.p_accept_children || details.pAcceptChildren || '',
      });
      setNoteDraft(member.adminNote || member.adminNotes || member.admin_notes || member.notes || '');
      setRevealSensitive(false); setActiveEditTab('profile'); setActiveViewTab('basic');
      setPCountryCustomOpen(false); setPCityCustomOpen(false); setPNationalityCustomOpen(false);
    }
  }, [open, member, initialEditing]);

  useEffect(() => { dataService.db.ensureGeoLoaded?.().catch(() => undefined); }, []);

  if (!open || !member) return null;

  const handleSaveEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const ok = await updateMember(member.id, editForm);
      if (ok !== false) { showLocalToast('تم حفظ بيانات العضو بنجاح ✓'); setIsEditing(false); onUpdated?.(); }
      else showLocalToast('حدث خطأ أثناء حفظ بيانات العضو');
    } catch (err: any) { showLocalToast(err.message || 'حدث خطأ غير متوقع'); }
    finally { setIsSaving(false); }
  };

  const hardDeleteMember = async (id: string) => {
    try { await dataService.db.adminDeleteMember?.(id); await deleteMember(id); showLocalToast('تم حذف العضو نهائياً'); setDeleteFor(null); onClose(); onUpdated?.(); }
    catch { showLocalToast('تعذّر إكمال الحذف'); }
  };

  // ═══════════════════════════════════════════════════════════
  //  EDIT FORM — Exact copy of EditProfile sections
  // ═══════════════════════════════════════════════════════════
  const renderProfileEditTab = () => (
    <div className="space-y-5 max-h-[60vh] overflow-y-auto px-0.5 py-1">
      {editForm.isProfileIncomplete && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-xs font-cairo text-amber-900 font-bold">هذا الملف معلّم كـ غير مكتمل وسيكون محجوباً عن العرض العام.</p>
        </div>
      )}

      {/* ═══ 1. المعلومات الأساسية ═══ */}
      <div className="bg-white rounded-3xl shadow-soft border border-cream-200/60 p-5 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gold-300/15 flex items-center justify-center"><User className="w-5 h-5 text-gold-600" /></div>
          <h2 className="font-cairo font-bold text-lg text-navy-900">المعلومات الأساسية</h2>
        </div>
        <Field label="الجنس" required>
          <RadioGroup options={[{ value: 'male', label: 'ذكر' }, { value: 'female', label: 'أنثى' }]} value={editForm.gender || ''} onChange={(v) => set('gender', v)} columns={2} />
        </Field>
        <Field label="الاسم المستعار" hint="يظهر في ملفه العام">
          <TextInput value={editForm.nickname || ''} onChange={(v) => set('nickname', v)} placeholder="مثال: أبو عبدالله، باحثة عن الستر" />
        </Field>
        <Field label="تاريخ الميلاد" hint="اختر السنة ثم الشهر ثم اليوم">
          <DateSelect value={editForm.birthDate || ''} onChange={handleBirthDateChange} />
        </Field>
        <Field label="العمر (محسوب تلقائيًا)">
          <div className="px-4 py-3 rounded-xl bg-gold-300/10 border-2 border-gold-300/40 flex items-center gap-2">
            <span className="font-cairo font-extrabold text-2xl text-gradient-gold">{editForm.age > 0 ? editForm.age : '—'}</span>
            {editForm.age > 0 && <span className="text-navy-500 font-tajawal">سنة</span>}
          </div>
        </Field>
        <Field label="الدولة" required>
          <SearchableSelect value={editForm.country || ''} onChange={(v) => { set('country', v); set('city', ''); }} options={countryOptions} placeholder="ابحث واختر الدولة" searchPlaceholder="اكتب اسم الدولة..." allowAddNew onAddNew={handleAddCountry} addNewLabel="إذا لم تجد دولتك؟ اضغط هنا لكتابة اسم الدولة" addNewPlaceholder="اكتب اسم الدولة..." />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="المدينة" required>
            <SearchableSelect value={editForm.city || ''} onChange={(v) => set('city', v)} options={cities} placeholder={editForm.country ? 'ابحث واختر المدينة' : 'اختر الدولة أولًا'} searchPlaceholder="اكتب اسم المدينة..." disabled={!editForm.country} allowAddNew={!!editForm.country} onAddNew={handleAddCity(editForm.country || '')} addNewLabel="إذا لم تجد مدينتك؟ اضغط هنا لكتابة اسم المدينة" addNewPlaceholder="اكتب اسم مدينتك..." />
          </Field>
          <Field label="المنطقة / الحي" hint="الحي أو المنطقة التفصيلية">
            <TextInput value={editForm.district || ''} onChange={(v) => set('district', v)} placeholder="حي العليا..." />
          </Field>
        </div>
        <Field label="الجنسية" hint="جنسيته">
          <SearchableSelect value={editForm.nationality || ''} onChange={(v) => set('nationality', v)} options={nationalityOptions} placeholder="ابحث عن الجنسية" searchPlaceholder="أدخل اسم الدولة التي منها جنسيتك..." allowAddNew onAddNew={handleAddNationality} addNewLabel="إذا لم تجد جنسيتك؟ اضغط هنا لكتابة دولة الجنسية" addNewPlaceholder="أدخل اسم الدولة التي منها جنسيتك..." />
        </Field>
        <Field label="المذهب" hint="المذهب الديني">
          <SelectWithOther value={editForm.sect || ''} otherValue={editForm.sectOther || ''} onChange={(v) => set('sect', v)} onOtherChange={(v) => set('sectOther', v)} options={getUnifiedSects()} placeholder="اختر المذهب" />
        </Field>
      </div>

      {/* ═══ 2. الحالة الاجتماعية ═══ */}
      <div className="bg-white rounded-3xl shadow-soft border border-cream-200/60 p-5 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gold-300/15 flex items-center justify-center"><Heart className="w-5 h-5 text-gold-600" /></div>
          <h2 className="font-cairo font-bold text-lg text-navy-900">الحالة الاجتماعية</h2>
        </div>
        <Field label="الحالة الاجتماعية" required>
          <RadioGroup options={getSelfMaritalOptions(editForm.gender as any)} value={editForm.maritalStatus || editForm.marital_status || ''} onChange={(v) => { set('maritalStatus', v); set('marital_status', v); }} columns={isMale ? 4 : 3} />
        </Field>
        <Field label="نوع الزواج المطلوب">
          <RadioGroup options={[{ value: 'announced', label: 'معلن' }, { value: 'misyar', label: 'مسيار' }, { value: 'both', label: 'لا مانع / معلن او مسيار' }]} value={editForm.marriageType || 'announced'} onChange={(v) => set('marriageType', v)} columns={3} />
        </Field>
        {['divorced', 'widower', 'widow', 'widowed', 'مطلق', 'مطلقة', 'أرمل', 'أرملة'].includes(editForm.maritalStatus || editForm.marital_status || '') && (
          <div className="space-y-4 bg-cream-50 rounded-2xl p-4 border border-cream-200">
            <h4 className="font-cairo font-bold text-navy-900 text-sm flex items-center gap-2"><User className="w-4 h-4 text-gold-600" /> معلومات الأبناء</h4>
            <Field label={isMale ? 'هل لديك أبناء؟' : 'هل لديكِ أبناء؟'}>
              <RadioGroup options={C.YES_NO} value={editForm.hasChildren === true ? 'yes' : editForm.hasChildren === 'yes' ? 'yes' : editForm.hasChildren === false ? 'no' : editForm.hasChildren || ''} onChange={(v) => set('hasChildren', v)} />
            </Field>
            {(editForm.hasChildren === 'yes' || editForm.hasChildren === true) && (
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="عدد الأبناء"><SelectInput value={editForm.childrenCount || ''} onChange={(v) => set('childrenCount', v)} options={getChildrenCountList()} placeholder="اختر" /></Field>
                <Field label={isMale ? 'هل الأبناء يعيشون معك؟' : 'هل الأبناء يعيشون معكِ؟'}>
                  <RadioGroup options={C.YES_NO} value={editForm.childrenLiveWith || ''} onChange={(v) => set('childrenLiveWith', v)} />
                </Field>
              </div>
            )}
          </div>
        )}
        {isMale && ['married', 'متزوج'].includes(editForm.maritalStatus || editForm.marital_status || '') && (
          <div className="space-y-4 bg-cream-50 rounded-2xl p-4 border border-cream-200">
            <h4 className="font-cairo font-bold text-navy-900 text-sm flex items-center gap-2"><User className="w-4 h-4 text-gold-600" /> تفاصيل الزواج</h4>
            <Field label="عدد الزوجات الحالي"><RadioGroup options={C.WIFE_COUNT} value={editForm.wifeCount || ''} onChange={(v) => set('wifeCount', v)} columns={3} /></Field>
            <Field label="هل لديك أبناء؟"><RadioGroup options={C.YES_NO} value={editForm.hasChildren === true ? 'yes' : editForm.hasChildren === 'yes' ? 'yes' : editForm.hasChildren === false ? 'no' : editForm.hasChildren || ''} onChange={(v) => set('hasChildren', v)} /></Field>
            {(editForm.hasChildren === 'yes' || editForm.hasChildren === true) && (<Field label="كم عدد الأبناء؟"><SelectInput value={editForm.childrenCount || ''} onChange={(v) => set('childrenCount', v)} options={getChildrenCountList()} placeholder="اختر" /></Field>)}
            <Field label="هل تبحث عن زوجة أخرى؟"><RadioGroup options={C.YES_NO} value={editForm.seekingWife || ''} onChange={(v) => set('seekingWife', v)} /></Field>
          </div>
        )}
      </div>

      {/* ═══ 3. المواصفات الشخصية ═══ */}
      <div className="bg-white rounded-3xl shadow-soft border border-cream-200/60 p-5 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gold-300/15 flex items-center justify-center"><Ruler className="w-5 h-5 text-gold-600" /></div>
          <h2 className="font-cairo font-bold text-lg text-navy-900">المواصفات الشخصية</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="الطول (كتابة)" hint="بالسنتيمتر"><div className="relative"><TextInput type="number" min={80} max={300} value={editForm.height ? String(editForm.height) : ''} onChange={(v) => set('height', v ? Number(v) : '')} placeholder="80 - 300 سم" className="pl-12" /><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-navy-400 font-tajawal pointer-events-none">سم</span></div></Field>
          <Field label="الوزن (كتابة)" hint="بالكيلوغرام"><div className="relative"><TextInput type="number" min={20} max={300} value={editForm.weight ? String(editForm.weight) : ''} onChange={(v) => set('weight', v ? Number(v) : '')} placeholder="20 - 300 كجم" className="pl-12" /><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-navy-400 font-tajawal pointer-events-none">كجم</span></div></Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="لون البشرة" hint="لون البشرة الطبيعي">
            <SearchableSelect value={editForm.skinColor || editForm.skin_color || ''} onChange={(v) => { set('skinColor', v); set('skin_color', v); }} options={getUnifiedSkinColorOptions()} placeholder="اختر لون البشرة" searchPlaceholder="ابحث عن لون البشرة..." />
          </Field>
          <Field label="العرق" hint="مثال: عربي، خليجي، قبلي"><TextInput value={editForm.ethnicity || ''} onChange={(v) => set('ethnicity', v)} placeholder="اكتب العرق..." /></Field>
        </div>
        <Field label="القبيلة / النسب" hint="اسم القبيلة أو انتسابك"><TextInput value={editForm.tribe || ''} onChange={(v) => set('tribe', v)} placeholder="اسم القبيلة أو النسب..." /></Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="الحالة الصحية" hint="مثال: ممتازة، جيدة"><TextInput value={editForm.health || editForm.healthStatus || ''} onChange={(v) => { set('health', v); set('healthStatus', v); }} placeholder="اكتب حالتك الصحية..." /></Field>
          <Field label={isFemale ? 'هل تدخنين؟' : 'هل تدخن؟'} hint="عادة التدخين"><SelectInput value={editForm.smoking || ''} onChange={(v) => set('smoking', v)} options={getUnifiedSmokingOptions()} placeholder="اختر" /></Field>
        </div>
      </div>

      {/* ═══ 4. التعليم والعمل ═══ */}
      <div className="bg-white rounded-3xl shadow-soft border border-cream-200/60 p-5 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gold-300/15 flex items-center justify-center"><GraduationCap className="w-5 h-5 text-gold-600" /></div>
          <h2 className="font-cairo font-bold text-lg text-navy-900">التعليم والعمل</h2>
        </div>
        <Field label="المؤهل الدراسي" hint="أعلى مؤهل علمي"><SelectInput value={editForm.education || ''} onChange={(v) => set('education', v)} options={getUnifiedEducationLevels()} placeholder="اختر المؤهل" /></Field>
        <Field label="نوع جهة العمل" hint="طبيعة العمل">
          <RadioGroup options={getUnifiedWorkTypes().map((w) => ({ value: w, label: w }))} value={editForm.workType || editForm.work_type || ''} onChange={(v) => { set('workType', v); set('work_type', v); set('jobTitle', ''); set('job_title', ''); }} columns={3} />
        </Field>
        {(editForm.workType || editForm.work_type) && (editForm.workType || editForm.work_type) !== 'بدون عمل' && (
          <Field label="المسمى الوظيفي"><TextInput value={editForm.jobTitle || editForm.job_title || ''} onChange={(v) => { set('jobTitle', v); set('job_title', v); }} placeholder="معلم، طبيب، مهندس..." /></Field>
        )}
        <Field label="نوع السكن" hint="الوضع السكني"><SelectInput value={editForm.housing || ''} onChange={(v) => set('housing', v)} options={getUnifiedHousingTypes()} placeholder="اختر" /></Field>
      </div>

      {/* ═══ 5. نبذة ═══ */}
      <div className="bg-white rounded-3xl shadow-soft border border-cream-200/60 p-5 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gold-300/15 flex items-center justify-center"><FileText className="w-5 h-5 text-gold-600" /></div>
          <h2 className="font-cairo font-bold text-lg text-navy-900">نبذة عن العضو</h2>
        </div>
        <Field label="اكتب نبذة قصيرة" hint={`${(editForm.bio || '').length}/500 حرف`}>
          <TextArea value={editForm.bio || ''} onChange={(v) => set('bio', v)} placeholder="اكتب نبذة عن شخصيتك وأهدافك..." rows={4} />
        </Field>
      </div>

      {/* ═══ 6. مواصفات الشريك — EXACT copy of EditProfile ═══ */}
      <div className="bg-white rounded-3xl shadow-soft border border-cream-200/60 p-5 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gold-300/15 flex items-center justify-center"><Heart className="w-5 h-5 text-gold-600" /></div>
          <h2 className="font-cairo font-bold text-lg text-navy-900">مواصفات {partnerTerms.partnerLabel} المطلوبة</h2>
        </div>

        {/* 1. دولة الشريك */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
          <label className="block text-xs font-cairo font-bold text-slate-800">1. {partnerTerms.countryLabel}</label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { set('pCountry', editForm.country || 'السعودية'); setPCountryCustomOpen(false); }} className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${!pCountryCustomOpen && (editForm.pCountry === (editForm.country || 'السعودية') || editForm.pCountry === 'نفس دولتي') ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}>✓ نفس دولتي ({editForm.country || 'السعودية'})</button>
            <button type="button" onClick={() => { set('pCountry', 'لا يهم'); setPCountryCustomOpen(false); }} className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${!pCountryCustomOpen && editForm.pCountry === 'لا يهم' ? 'bg-slate-900 text-white border-slate-900 shadow-2xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}>أي دولة / لا يهم</button>
            <button type="button" onClick={() => { setPCountryCustomOpen(true); if (editForm.pCountry === 'لا يهم') set('pCountry', editForm.country || 'السعودية'); }} className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${pCountryCustomOpen || (editForm.pCountry && editForm.pCountry !== 'لا يهم' && editForm.pCountry !== 'نفس دولتي' && editForm.pCountry !== (editForm.country || 'السعودية')) ? 'bg-amber-500 text-white border-amber-500 shadow-2xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}>تحديد دول معينة (دولة أو أكثر)</button>
          </div>
          {(pCountryCustomOpen || (editForm.pCountry && editForm.pCountry !== 'لا يهم' && editForm.pCountry !== 'نفس دولتي' && editForm.pCountry !== (editForm.country || 'السعودية'))) && (
            <div className="pt-2"><Field label="الدول المطلوبة (يمكنك اختيار دولة واحدة أو عدة دول)" hint="اختر دولة أو أكثر من القائمة"><MultiSearchableSelect values={pSelectedCountries} onChange={(v) => set('pCountry', v.length > 0 ? v.join('، ') : 'لا يهم')} options={countryOptions} placeholder="ابحث واختر الدول المطلوبة..." searchPlaceholder="ابحث عن دولة..." allowAddNew onAddNew={handleAddCountry} addNewLabel="إذا لم تجد الدولة؟ اضغط هنا لكتابتها" /></Field></div>
          )}
        </div>

        {/* 2. مدينة الشريك */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
          <label className="block text-xs font-cairo font-bold text-slate-800">2. {partnerTerms.cityLabel}</label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { set('pCity', editForm.city || 'الرياض'); setPCityCustomOpen(false); }} className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${!pCityCustomOpen && (editForm.pCity === (editForm.city || 'الرياض') || editForm.pCity === 'نفس مدينتي') ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}>✓ نفس مدينتي ({editForm.city || 'الرياض'})</button>
            <button type="button" onClick={() => { set('pCity', 'لا يهم'); setPCityCustomOpen(false); }} className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${!pCityCustomOpen && editForm.pCity === 'لا يهم' ? 'bg-slate-900 text-white border-slate-900 shadow-2xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}>أي مدينة / لا يهم</button>
            <button type="button" onClick={() => { setPCityCustomOpen(true); if (editForm.pCity === 'لا يهم') set('pCity', editForm.city || 'الرياض'); }} className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${pCityCustomOpen || (editForm.pCity && editForm.pCity !== 'لا يهم' && editForm.pCity !== 'نفس مدينتي' && editForm.pCity !== (editForm.city || 'الرياض')) ? 'bg-amber-500 text-white border-amber-500 shadow-2xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}>تحديد مدن معينة (مدينة أو أكثر)</button>
          </div>
          {(pCityCustomOpen || (editForm.pCity && editForm.pCity !== 'لا يهم' && editForm.pCity !== 'نفس مدينتي' && editForm.pCity !== (editForm.city || 'الرياض'))) && (
            <div className="pt-2"><Field label="المدن المطلوبة (يمكنك اختيار مدينة واحدة أو عدة مدن)" hint="اختر مدينة أو أكثر من القائمة"><MultiSearchableSelect values={pSelectedCities} onChange={(v) => set('pCity', v.length > 0 ? v.join('، ') : 'لا يهم')} options={pCities} placeholder="ابحث واختر المدن المطلوبة..." searchPlaceholder="ابحث عن مدينة..." allowAddNew onAddNew={(n) => handleAddCity(editForm.pCountry || editForm.country || 'السعودية')(n)} addNewLabel="إذا لم تجد المدينة؟ اضغط هنا لكتابتها" /></Field></div>
          )}
        </div>

        {/* 3. الجنسية */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
          <label className="block text-xs font-cairo font-bold text-slate-800">3. {partnerTerms.nationalityLabel}</label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { set('pNationality', editForm.nationality || editForm.country || 'نفس جنسيتي'); setPNationalityCustomOpen(true); }} className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${(editForm.pNationality === 'نفس جنسيتي' || editForm.pNationality === editForm.nationality || editForm.pNationality === editForm.country) ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}>✓ نفس جنسيتي ({editForm.country || 'دولة الإقامة'})</button>
            <button type="button" onClick={() => { set('pNationality', 'اقبل اجنبي'); setPNationalityCustomOpen(false); }} className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${!pNationalityCustomOpen && (editForm.pNationality === 'اقبل اجنبي' || editForm.pNationality === 'أقبل أجنبي' || editForm.pNationality === 'لا يهم') ? 'bg-slate-900 text-white border-slate-900 shadow-2xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}>اقبل اجنبي (أية جنسية)</button>
            <button type="button" onClick={() => { setPNationalityCustomOpen(true); if (editForm.pNationality === 'نفس جنسيتي' || editForm.pNationality === 'اقبل اجنبي' || editForm.pNationality === 'أقبل أجنبي' || editForm.pNationality === 'لا يهم') set('pNationality', ''); }} className={`px-3 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${pNationalityCustomOpen || (editForm.pNationality && editForm.pNationality !== 'نفس جنسيتي' && editForm.pNationality !== 'اقبل اجنبي' && editForm.pNationality !== 'أقبل أجنبي' && editForm.pNationality !== 'لا يهم') ? 'bg-amber-500 text-white border-amber-500 shadow-2xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}>تحديد جنسيات معينة</button>
          </div>
          {(pNationalityCustomOpen || (editForm.pNationality && editForm.pNationality !== 'نفس جنسيتي' && editForm.pNationality !== 'اقبل اجنبي' && editForm.pNationality !== 'أقبل أجنبي' && editForm.pNationality !== 'لا يهم')) && (
            <div className="pt-2"><Field label="تحديد جنسيات معينة (يمكنك اختيار جنسية واحدة أو عدة جنسيات)" hint={`الدولة التي منها جنسية العضو: ${editForm.country || 'اختر دولة الإقامة أولاً'}`}><MultiSearchableSelect values={pSelectedNationalities} onChange={(v) => set('pNationality', v.length > 0 ? v.join('، ') : 'اقبل اجنبي')} options={partnerNationalityOptions} placeholder="ابحث واختر الجنسيات المطلوبة..." searchPlaceholder="أدخل اسم الدولة التي منها جنسيتك..." allowAddNew onAddNew={handleAddNationality} addNewLabel="إذا لم تجد الجنسية؟ اضغط هنا لكتابة دولة الجنسية" addNewPlaceholder="أدخل اسم الدولة التي منها جنسيتك..." /></Field></div>
          )}
        </div>

        {/* 4. العمر */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="block text-xs font-cairo font-bold text-slate-800">4. {partnerTerms.ageLabel}</label>
            <span className="text-xs font-cairo font-extrabold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">{(!editForm.pAgeMin && !editForm.pAgeMax) || (Number(editForm.pAgeMin) === 0 && Number(editForm.pAgeMax) === 0) ? 'غير محدد (أي عمر)' : `من ${editForm.pAgeMin || 'أي عمر'} إلى ${editForm.pAgeMax || 'أي عمر'} سنة`}</span>
          </div>
          <div className="flex gap-2"><button type="button" onClick={() => { set('pAgeMin', ''); set('pAgeMax', ''); }} className={`px-3 py-1.5 rounded-xl text-xs font-cairo font-bold border transition-all ${(!editForm.pAgeMin && !editForm.pAgeMax) || (Number(editForm.pAgeMin) === 0 && Number(editForm.pAgeMax) === 0) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}>غير محدد / أي عمر</button></div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div><label className="text-[11px] text-slate-600 font-cairo font-bold mb-1 block">الحد الأدنى للعمر (من)</label><input type="number" min={16} max={90} value={editForm.pAgeMin || ''} onChange={(e) => set('pAgeMin', e.target.value === '' ? '' : Number(e.target.value))} placeholder="مثال: 20" className="w-full px-4 py-2.5 rounded-xl bg-white border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal text-sm text-navy-900" /></div>
            <div><label className="text-[11px] text-slate-600 font-cairo font-bold mb-1 block">الحد الأقصى للعمر (إلى)</label><input type="number" min={16} max={90} value={editForm.pAgeMax || ''} onChange={(e) => set('pAgeMax', e.target.value === '' ? '' : Number(e.target.value))} placeholder="مثال: 45" className="w-full px-4 py-2.5 rounded-xl bg-white border-2 border-cream-200 focus:border-gold-500 focus:outline-none font-tajawal text-sm text-navy-900" /></div>
          </div>
        </div>

        {/* 5. الحالة الاجتماعية */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
          <label className="block text-xs font-cairo font-bold text-slate-800">5. {partnerTerms.maritalLabel} (يمكنك اختيار أكثر من خيار)</label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => set('pMaritalStatus', 'لا يهم')} className={`px-3.5 py-2 rounded-xl text-xs font-cairo font-bold transition-all border ${pSelectedMarital.includes('لا يهم') ? 'bg-slate-900 text-white border-slate-900 shadow-2xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}>لا يهم / الجميع</button>
            {partnerMaritalOptions.map((opt) => {
              const isSelected = pSelectedMarital.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleTogglePartnerMarital(opt)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-cairo font-bold transition-all border flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-gold-300/30 text-navy-900 border-gold-500 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 text-navy-900" />}
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* 6. قبول الأطفال */}
        {!isSingleOnly && (
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <label className="block text-xs font-cairo font-bold text-slate-800">6. {partnerTerms.childrenLabel}</label>
            <RadioGroup options={[{ value: 'نعم', label: 'نعم (أقبل)' }, { value: 'لا', label: 'لا (أفضل بدون أطفال)' }, { value: 'لا يهم', label: 'لا يهم' }, { value: 'بشرط ألا يعيشوا معنا', label: 'بشرط ألا يعيشوا معنا' }]} value={editForm.pAcceptChildren || 'لا يهم'} onChange={(v) => set('pAcceptChildren', v)} columns={2} />
          </div>
        )}

        {/* 7. ملاحظات */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
          <label className="block text-xs font-cairo font-bold text-slate-800">7. ملاحظات وصفات إضافية مرغوبة</label>
          <TextArea value={editForm.pNotes || editForm.aboutPartner || ''} onChange={(v) => { set('pNotes', v); set('aboutPartner', v); }} placeholder={partnerTerms.notesPlaceholder || "اكتب أي مواصفات أو تفاصيل إضافية ترغب بها في شريك حياتك..."} rows={3} />
        </div>
      </div>

      {/* حالة غير مكتملة */}
      <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center justify-between">
        <div className="flex items-start gap-2"><AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" /><div><p className="font-bold text-xs text-amber-900">حالة غير مكتملة</p><p className="text-[10px] text-amber-700">عند التفعيل سيُحجب الملف من العرض العام.</p></div></div>
        <input type="checkbox" checked={!!editForm.isProfileIncomplete} onChange={(e) => set('isProfileIncomplete', e.target.checked)} className="w-4 h-4 rounded accent-amber-500 cursor-pointer" />
      </div>
    </div>
  );

  const renderAccountEditTab = () => (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto px-0.5 py-1">
      <div className="bg-white rounded-3xl shadow-soft border border-cream-200/60 p-5 space-y-3">
        <div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-xl bg-gold-300/15 flex items-center justify-center"><Phone className="w-5 h-5 text-gold-600" /></div><h2 className="font-cairo font-bold text-lg text-navy-900">بيانات الاتصال</h2></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="الاسم الحقيقي بالكامل" required><TextInput value={editForm.realName || editForm.real_name || ''} onChange={(v) => { set('realName', v); set('real_name', v); }} placeholder="الاسم الثلاثي" /></Field>
          <Field label="رقم الواتساب / الهاتف" required><TextInput value={editForm.whatsapp || editForm.phone || ''} onChange={(v) => { set('whatsapp', v); set('phone', v); }} placeholder="0500000000" /></Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="البريد الإلكتروني" required><TextInput type="email" value={editForm.email || ''} onChange={(v) => set('email', v)} placeholder="member@email.com" /></Field>
          <div><div className="flex items-center justify-between mb-1"><label className="block text-xs font-bold text-slate-700 font-cairo">كلمة المرور</label><button type="button" onClick={() => { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$'; let p = 'Tw-'; for (let i = 0; i < 7; i++) p += chars.charAt(Math.floor(Math.random() * chars.length)); set('password', p); showLocalToast('تم توليد كلمة مرور جديدة ✓'); }} className="text-[10px] font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> توليد عشوائي</button></div><div className="relative"><input type={showPassword ? 'text' : 'password'} value={editForm.password || ''} onChange={(e) => set('password', e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-amber-400" placeholder="Pass@1234" dir="ltr" /><button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><Eye className="w-3.5 h-3.5" /></button></div></div>
        </div>
      </div>
      <div className="border border-purple-200 bg-purple-50/40 p-4 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-extrabold text-purple-900 flex items-center gap-1.5"><LogIn className="w-4 h-4 text-purple-600" /> تصنيف ومصدر الملف</p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-cairo font-bold text-slate-700">نوع الملف:</span>
            <select
              value={editForm.sourceType || (editForm.importOfficeName ? 'imported' : 'registered')}
              onChange={(e) => set('sourceType', e.target.value)}
              className="text-xs font-cairo font-bold px-2 py-1 rounded-lg border border-purple-300 bg-white text-purple-950"
            >
              <option value="registered">عضو مسجل ذاتياً في الموقع</option>
              <option value="imported">ملف وساطة مرفوع من الإدارة / الخطابة</option>
            </select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="اسم مكتب / الخطابة الوسيطة"><TextInput value={editForm.importOfficeName || editForm.import_office_name || ''} onChange={(v) => { set('importOfficeName', v); set('import_office_name', v); }} placeholder="مثال: أم فهد (وساطة الإدارة)" /></Field>
          <Field label="ملاحظات الاستيراد والتنسيق"><TextInput value={editForm.importNotes || editForm.import_notes || ''} onChange={(v) => { set('importNotes', v); set('import_notes', v); }} placeholder="ملاحظات..." /></Field>
        </div>
      </div>
      <div className="bg-white rounded-3xl shadow-soft border border-cream-200/60 p-5 space-y-3">
        <div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-xl bg-gold-300/15 flex items-center justify-center"><Crown className="w-5 h-5 text-gold-600" /></div><h2 className="font-cairo font-bold text-lg text-navy-900">الاشتراك والحالة</h2></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="باقة الاشتراك"><SelectInput value={editForm.plan || 'free'} onChange={(v) => { set('plan', v); set('premium', v === 'gold' || v === 'elite'); }} options={['free', 'gold', 'elite']} placeholder="اختر" /></Field>
          <div className="flex items-center gap-2 pt-5"><input type="checkbox" id="editPinned" checked={!!editForm.pinned} onChange={(e) => set('pinned', e.target.checked)} className="w-4 h-4 rounded accent-amber-500 cursor-pointer" /><label htmlFor="editPinned" className="text-xs font-bold text-slate-700 cursor-pointer select-none flex items-center gap-1"><Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500 rotate-45" /> تثبيت في صدارة البحث</label></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="حالة الحساب"><SelectInput value={editForm.status || 'active'} onChange={(v) => set('status', v)} options={['active', 'pending', 'suspended', 'banned', 'inactive']} placeholder="اختر" /></Field>
          {(editForm.status === 'suspended' || editForm.status === 'banned') && (<Field label="سبب الإيقاف / الحظر"><TextInput value={editForm.statusReason || editForm.status_reason || ''} onChange={(v) => { set('statusReason', v); set('status_reason', v); }} placeholder="سبب الإيقاف..." /></Field>)}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-2 bg-sky-50/50 p-2.5 rounded-xl border border-sky-100"><input type="checkbox" id="editVerified" checked={!!editForm.verified} onChange={(e) => set('verified', e.target.checked)} className="w-4 h-4 rounded accent-sky-500 cursor-pointer" /><label htmlFor="editVerified" className="text-xs font-bold text-slate-800 cursor-pointer select-none flex items-center gap-1.5"><BadgeCheck className="w-4 h-4 text-sky-500" /> توثيق الهوية</label></div>
          <div className="flex items-center gap-2 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100"><input type="checkbox" id="editBadge" checked={!!editForm.hasSeriousnessBadge} onChange={(e) => set('hasSeriousnessBadge', e.target.checked)} className="w-4 h-4 rounded accent-emerald-500 cursor-pointer" /><label htmlFor="editBadge" className="text-xs font-bold text-slate-800 cursor-pointer select-none flex items-center gap-1.5"><Award className="w-4 h-4 text-emerald-500" /> منح وسام الجدية</label></div>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  //  VIEW MODE
  // ═══════════════════════════════════════════════════════════
  const renderViewMode = () => {
    const sourceInfo = getMemberSourceAndDate(member);
    const partnerSummary = getPartnerSummary(member);

    return (
      <div className="space-y-4 font-cairo">
        <div className="flex items-center gap-3">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl ${member.gender === 'male' ? 'bg-blue-500' : 'bg-rose-500'}`}>
            {(member.nickname || member.realName || '؟').charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 justify-between flex-wrap">
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-lg text-slate-900 truncate">{member.nickname || member.realName || 'بدون اسم'}</h3>
                {member.verified && <BadgeCheck className="w-5 h-5 text-blue-500 shrink-0" />}
                {member.premium && <Crown className="w-5 h-5 text-amber-500 shrink-0" />}
                {member.isProfileIncomplete && <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded select-none shrink-0">غير مكتمل</span>}
              </div>
              <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 rounded-xl bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition-all flex items-center gap-1">
                <Edit className="w-3.5 h-3.5" /> تعديل البيانات
              </button>
            </div>
            <p className="text-sm text-slate-500">{member.age} سنة · {member.city}، {member.country}</p>
            <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusCfg(member.status).color}`}>{getStatusCfg(member.status).label}</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${getPlanCfg(member.plan).color}`}>{getPlanCfg(member.plan).label}</span>
              {/* شارة مصدر العضو وتاريخ التسجيل/الاستيراد */}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                sourceInfo.isImported ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-sky-50 text-sky-700 border-sky-200'
              }`}>
                {sourceInfo.badgeLabel}: {sourceInfo.dateFormatted || 'غير محدد'}
              </span>
              {member.flagged && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 flex items-center gap-0.5"><Flag className="w-3 h-3" /> معلّم</span>}
            </div>
          </div>
        </div>

        {member.status !== 'active' && member.status !== 'pending' && (
          <div className={`rounded-xl p-3 border ${member.status === 'banned' ? 'bg-rose-50 border-rose-200' : 'bg-orange-50 border-orange-200'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              {member.status === 'banned' ? <UserX className="w-4 h-4 text-rose-600" /> : <Ban className="w-4 h-4 text-orange-600" />}
              <span className="text-xs font-bold text-slate-800">الحساب {getStatusCfg(member.status).label}</span>
            </div>
            {member.statusReason && <p className="text-xs text-slate-600">السبب: {member.statusReason}</p>}
          </div>
        )}

        <div className="flex border-b border-slate-200 mb-3">
          <button
            type="button"
            onClick={() => setActiveViewTab('basic')}
            className={`flex-1 text-center py-2.5 font-bold text-xs border-b-2 transition-all ${activeViewTab === 'basic' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            البيانات والصفات الشخصية
          </button>
          <button
            type="button"
            onClick={() => setActiveViewTab('partner')}
            className={`flex-1 text-center py-2.5 font-bold text-xs border-b-2 transition-all flex items-center justify-center gap-1.5 ${activeViewTab === 'partner' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Heart className="w-3.5 h-3.5 text-rose-500" />
            <span>مواصفات الشريك المطلوبة</span>
          </button>
        </div>

        {activeViewTab === 'basic' ? (
          <div className="space-y-4 max-h-[50vh] overflow-y-auto px-1 py-1">
            {(() => {
              const items = [
                { label: 'نوع الزواج المطلوب', value: member.marriageType === 'misyar' ? 'مسيار' : member.marriageType === 'both' ? 'لا مانع (معلن أو مسيار)' : member.marriageType === 'announced' ? 'معلن' : (member.marriageType || '') },
                { label: 'القبيلة', value: member.tribe },
                { label: 'العرق', value: member.ethnicity },
                { label: 'الجنس', value: member.gender === 'male' ? 'ذكر' : member.gender === 'female' ? 'أنثى' : '' },
                { label: 'الحالة الاجتماعية', value: member.maritalLabel || member.maritalStatus },
                { label: 'العمر', value: member.age ? `${member.age} سنة` : '' },
                { label: 'الدولة', value: member.country },
                { label: 'المدينة', value: member.city },
                { label: 'الحي', value: member.district },
                { label: 'الجنسية', value: member.nationality },
                { label: 'المذهب', value: member.sect },
                { label: 'عدد الأبناء', value: member.childrenCount },
                { label: 'الطول', value: member.height ? `${member.height} سم` : '' },
                { label: 'الوزن', value: member.weight ? `${member.weight} كجم` : '' },
                { label: 'لون البشرة', value: member.skinColor || member.skin_color },
                { label: 'الحالة الصحية', value: member.health || member.healthStatus },
                { label: 'التدخين', value: member.smoking },
                { label: 'التعليم', value: member.education },
                { label: 'طبيعة السكن', value: member.housing },
                { label: 'جهة العمل', value: member.workType || member.work_type },
                { label: 'المسمى الوظيفي', value: member.jobTitle || member.job_title },
              ].filter((i) => i.value && String(i.value).trim() && !['—','-','غير محدد','0'].includes(String(i.value).trim()));

              return (
                <>
                  {items.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                      {items.map((i) => (
                        <div key={i.label} className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                          <span className="text-[10px] text-slate-400 block mb-0.5">{i.label}</span>
                          <span className="font-bold text-xs text-slate-800">{i.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-8">لا توجد بيانات</p>
                  )}
                  {member.bio && String(member.bio).trim() && (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block mb-1">نبذة تعريفية</span>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{member.bio}</p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <div className="space-y-4 max-h-[50vh] overflow-y-auto px-1 py-1">
            {(() => {
              const pMaritalRaw = (member.pMaritalStatus || member.p_marital_status || member.pMarital || '').toString();
              const isAcceptAllMarital = !pMaritalRaw || ['لا يهم', 'الجميع', 'يقبل الجميع', 'all', 'أي حالة', 'اي حالة', 'كافة الحالات'].some(k => pMaritalRaw.toLowerCase().includes(k));
              const displayMarital = isAcceptAllMarital ? 'يقبل الجميع (كافة الحالات الاجتماعية)' : pMaritalRaw;

              const isAcceptForeigner = member.acceptForeigner === 'yes' || member.accept_foreigner === 'yes' || ['اقبل اجنبي', 'أقبل أجنبي', 'أي جنسية'].some(k => (member.pNationality || '').includes(k));
              const displayNat = isAcceptForeigner
                ? 'يقبل أجنبي / غير مواطن (أي جنسية)'
                : (member.pNationality === 'نفس جنسيتي' ? `نفس جنسيتي (${member.nationality || member.country})` : (member.pNationality || 'لا يهم / غير محدد'));

              const items = [
                { label: 'قبول غير مواطن / أجنبي', value: isAcceptForeigner ? 'نعم (يقبل أجنبي)' : (member.acceptForeigner === 'no' ? 'لا (مواطن فقط)' : 'غير محدد') },
                { label: 'جنسية الشريك المطلوبة', value: displayNat },
                { label: 'الحالة الاجتماعية المقبولة', value: displayMarital },
                { label: 'نطاق عمر الشريك المطلوب', value: (member.pAgeMin || member.pAgeMax) ? `من ${member.pAgeMin || 'أي'} إلى ${member.pAgeMax || 'أي'} سنة` : 'غير محدد' },
                { label: 'بلد إقامة الشريك', value: member.pCountry === 'لا يهم' ? 'أي دولة' : member.pCountry },
                { label: 'مدينة إقامة الشريك', value: member.pCity === 'لا يهم' ? 'أي مدينة' : member.pCity },
                { label: 'قبول أطفال لدى الشريك', value: member.pAcceptChildren === 'لا يهم' ? 'لا يهم' : member.pAcceptChildren },
              ].filter((i) => i.value && String(i.value).trim() && !['—','-','0','null','undefined'].includes(String(i.value).trim()));

              const pNotes = member.pNotes || member.aboutPartner;

              return (
                <>
                  {/* شارات سريعة للمواصفات */}
                  {partnerSummary.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200">
                      <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1 w-full mb-1">
                        <Heart className="w-3.5 h-3.5 text-amber-600" />
                        ملخص رغبات الشريك:
                      </span>
                      {partnerSummary.tags.map((t, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-lg bg-white border border-amber-200 text-xs font-bold text-slate-800 shadow-2xs">
                          {t.label}: <span className="text-amber-700 font-black mr-1">{t.value}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {items.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                      {items.map((i) => (
                        <div key={i.label} className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                          <span className="text-[10px] text-slate-400 block mb-0.5">{i.label}</span>
                          <span className="font-bold text-xs text-slate-800">{i.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-8">لا توجد مواصفات محددة</p>
                  )}

                  {pNotes && String(pNotes).trim() && (
                    <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-200/80">
                      <span className="text-[10px] font-bold text-amber-800 block mb-1">📝 ملاحظات إضافية ومواصفات الشريك المطلوبة</span>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-tajawal">{pNotes}</p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Sensitive Data */}
        {(() => {
          const items = [
            { icon: Fingerprint, label: 'الاسم الحقيقي', value: member.realName || member.real_name },
            { icon: Mail, label: 'البريد', value: member.email },
            { icon: Phone, label: 'رقم الواتساب', value: member.whatsapp || member.phone }
          ].filter((f) => f.value && String(f.value).trim());
          if (items.length === 0) return null;
          return (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-rose-700"><Lock className="w-4 h-4" /> بيانات حساسة — للإدارة فقط</span>
                <button onClick={() => setRevealSensitive((v) => !v)} className="text-[11px] font-bold text-rose-700 bg-white px-2.5 py-1 rounded-lg border border-rose-200 hover:bg-rose-100 transition-colors flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {revealSensitive ? 'إخفاء' : 'كشف الكل'}
                </button>
              </div>
              <div className="space-y-1.5">
                {items.map((f) => {
                  const Icon = f.icon;
                  return (
                    <div key={f.label} className="flex items-center gap-2 text-sm bg-white/60 rounded-lg px-2 py-1.5">
                      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-500 text-xs w-24 flex-shrink-0">{f.label}:</span>
                      <span className="text-slate-800 flex-1 truncate font-mono" dir="ltr">{revealSensitive ? f.value : '•••••••••'}</span>
                      {revealSensitive && (
                        <button onClick={() => { navigator.clipboard?.writeText(f.value); showLocalToast('تم نسخ ' + f.label + ' ✓'); }} className="text-slate-400 hover:text-slate-700 flex-shrink-0" title="نسخ">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Admin Note */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1"><StickyNote className="w-4 h-4" /> ملاحظة إدارية خاصة</label>
          <div className="flex gap-2">
            <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="اكتب ملاحظة..." className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none text-sm" />
            <button onClick={async () => { await setNote(member.id, noteDraft); showLocalToast('حُفظت الملاحظة ✓'); onUpdated?.(); }} className="px-4 rounded-xl bg-slate-900 text-white font-bold text-sm">حفظ</button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
          <button onClick={async () => { await toggleVerified(member.id, !member.verified); showLocalToast(member.verified ? 'أُلغي التوثيق' : 'تم التوثيق ✓'); onUpdated?.(); }} className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm ${member.verified ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
            <BadgeCheck className="w-4 h-4" /> {member.verified ? 'موثق' : 'توثيق'}
          </button>
          <button onClick={async () => { await setPremium(member.id, !member.premium); showLocalToast(member.premium ? 'أُلغي التميّز' : 'ترقية مميّز 👑'); onUpdated?.(); }} className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm ${member.premium ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
            <Crown className="w-4 h-4" /> {member.premium ? 'مميّز' : 'ترقية'}
          </button>
          {member.status !== 'active' ? (
            <button onClick={async () => { await updateMember(member.id, { status: 'active' }); showLocalToast('تم التفعيل ✓'); onUpdated?.(); }} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-100 text-emerald-700 font-bold text-sm">
              <UserCheck className="w-4 h-4" /> تفعيل
            </button>
          ) : (
            <button onClick={async () => { await updateMember(member.id, { status: 'suspended' }); showLocalToast('تم الإيقاف'); onUpdated?.(); }} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-100 text-rose-700 font-bold text-sm">
              <UserX className="w-4 h-4" /> إيقاف
            </button>
          )}
          <button onClick={async () => { await toggleFlag(member.id, !member.flagged); showLocalToast(member.flagged ? 'أُزيل التعليم' : 'تم التعليم'); onUpdated?.(); }} className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm ${member.flagged ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
            <Flag className="w-4 h-4" /> {member.flagged ? 'معلّم' : 'تعليم'}
          </button>
        </div>
        <button onClick={() => { setNotifyFor(member); setNotifyText(''); }} className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-amber-500 text-white font-bold text-sm hover:brightness-105"><Send className="w-4 h-4 -scale-x-100" /> إرسال إشعار للعضو</button>
        <button onClick={() => { (impersonateUser as any)({ id: member.id, nickname: member.nickname, gender: member.gender, age: member.age, country: member.country, city: member.city, realName: member.realName, email: member.email, phone: member.phone, whatsapp: member.whatsapp, plan: member.plan, status: member.status, verified: member.verified, premium: member.premium }); onClose(); navigate('/profile'); }} className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-gradient-to-l from-slate-900 to-slate-800 text-amber-300 font-bold text-sm hover:brightness-110 transition-all border border-amber-500/30"><LogIn className="w-4 h-4" /> الدخول بحساب العضو</button>
        <button onClick={() => setDeleteFor(member)} className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white border-2 border-rose-200 text-rose-600 font-bold text-sm hover:bg-rose-50 transition-colors"><Trash2 className="w-4 h-4" /> حذف الحساب نهائياً</button>
      </div>
    );
  };

  return (
    <>
      {localToast && <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] bg-slate-900 text-white font-cairo font-bold text-xs px-4 py-2.5 rounded-xl shadow-2xl border border-amber-500/40 animate-bounce">{localToast}</div>}
      <Modal open={open} onClose={onClose} title={isEditing ? `تعديل بيانات العضو: ${member.nickname || member.realName || member.id}` : `ملف العضو: ${member.nickname || member.realName || member.id}`} size="lg">
        <div dir="rtl" className="space-y-4">
          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="flex border-b border-slate-200">
                <button type="button" onClick={() => setActiveEditTab('profile')} className={`flex-1 text-center py-2.5 font-bold text-xs border-b-2 transition-all font-cairo ${activeEditTab === 'profile' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>الملف الشخصي ومواصفات الشريك</button>
                <button type="button" onClick={() => setActiveEditTab('account')} className={`flex-1 text-center py-2.5 font-bold text-xs border-b-2 transition-all font-cairo ${activeEditTab === 'account' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>بيانات الحساب والاتصال</button>
              </div>
              {activeEditTab === 'profile' ? renderProfileEditTab() : renderAccountEditTab()}
              <div className="flex gap-2 pt-3 border-t border-slate-200 font-cairo">
                <button type="submit" disabled={isSaving} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>حفظ التغييرات</span></button>
                <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors">إلغاء</button>
              </div>
            </form>
          ) : renderViewMode()}
        </div>
      </Modal>
      <Modal open={!!deleteFor} onClose={() => setDeleteFor(null)} title="حذف أو تعطيل الحساب">
        {deleteFor && (<div className="text-center font-cairo" dir="rtl"><div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center mx-auto mb-3"><Trash2 className="w-7 h-7 text-rose-500" /></div><p className="font-bold text-slate-800 mb-1">التحكم بحساب العضو «{deleteFor.nickname || deleteFor.realName}»</p><p className="text-xs text-slate-500 mb-4">اختر الإجراء المناسب:</p><div className="grid gap-3 mb-5 text-right"><button type="button" onClick={async () => { await updateMember(deleteFor.id, { status: 'suspended', statusReason: 'تعطيل مؤقت من الإدارة' }); setDeleteFor(null); showLocalToast('تم تعطيل حساب العضو مؤقتاً'); onClose(); onUpdated?.(); }} className="p-3.5 rounded-2xl border-2 border-amber-200 hover:border-amber-400 bg-amber-50/50 hover:bg-amber-50 transition-all text-right flex items-start gap-3"><div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 mt-0.5">⚠️</div><div><h4 className="font-bold text-xs text-amber-900">تعطيل الحساب مؤقتاً</h4><p className="text-[11px] text-slate-600 mt-0.5">يخفي الملف مع الاحتفاظ بالبيانات.</p></div></button><button type="button" onClick={() => hardDeleteMember(deleteFor.id)} className="p-3.5 rounded-2xl border-2 border-rose-200 hover:border-rose-400 bg-rose-50/30 hover:bg-rose-50 transition-all text-right flex items-start gap-3"><div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0 mt-0.5">☠️</div><div><h4 className="font-bold text-xs text-rose-900">حذف العضو نهائياً</h4><p className="text-[11px] text-slate-600 mt-0.5">يمسح العضو تماماً من قاعدة البيانات.</p></div></button></div><button onClick={() => setDeleteFor(null)} className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors">إلغاء</button></div>)}
      </Modal>
      <Modal open={!!notifyFor} onClose={() => setNotifyFor(null)} title="إرسال إشعار للعضو">
        {notifyFor && (<div className="font-cairo" dir="rtl"><p className="text-xs text-slate-600 mb-3">إرسال إشعار إلى: <strong>{notifyFor.nickname || notifyFor.realName}</strong></p><textarea value={notifyText} onChange={(e) => setNotifyText(e.target.value)} placeholder="اكتب نص الإشعار هنا..." className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:outline-none text-sm h-24 resize-none mb-3" /><div className="flex gap-2"><button onClick={async () => { if (!notifyText.trim()) return; try { await dataService.db.adminSendNotification(notifyFor.id, notifyText.trim(), 'إشعار من الإدارة'); showLocalToast('تم إرسال الإشعار بنجاح ✓'); } catch { showLocalToast('تعذّر إرسال الإشعار'); } setNotifyFor(null); }} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition-all flex items-center justify-center gap-1.5"><Send className="w-4 h-4 -scale-x-100" /> إرسال</button><button onClick={() => setNotifyFor(null)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm">إلغاء</button></div></div>)}
      </Modal>
    </>
  );
}
