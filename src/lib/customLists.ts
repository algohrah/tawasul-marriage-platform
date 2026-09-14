import { dataService } from './data/DataService';

// ====================================================================
//  نظام القوائم والتصنيفات المخصصة للأعضاء (Custom Member Lists & Tags)
//  يتيح للإدارة إنشاء قوائم مثل: "أعضاء طرف الخطابة أم زيد"، "خاص بي - تعليم"،
//  وإسناد الأعضاء إليها، وفلترتها بالكامل.
// ====================================================================

export interface CustomMemberList {
  id: string;
  name: string;
  description?: string;
  color: string; // e.g. 'amber' | 'emerald' | 'indigo' | 'rose' | 'blue' | 'purple' | 'cyan' | 'slate';
  createdAt: string;
  updatedAt?: string;
}

const STORAGE_KEY = 'twafok_custom_member_lists_v1';

export const DEFAULT_LIST_COLORS = [
  { value: 'amber', label: 'كهرماني / ذهبي', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300', dot: 'bg-amber-500' },
  { value: 'indigo', label: 'نيلي / ملكي', bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300', dot: 'bg-indigo-500' },
  { value: 'emerald', label: 'زمردي / أخضر', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  { value: 'rose', label: 'وردي / ياقوتي', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300', dot: 'bg-rose-500' },
  { value: 'blue', label: 'أزرق سماوي', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', dot: 'bg-blue-500' },
  { value: 'purple', label: 'بنفسجي', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', dot: 'bg-purple-500' },
  { value: 'cyan', label: 'فيروزي', bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300', dot: 'bg-cyan-500' },
  { value: 'slate', label: 'رمادي حيادي', bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300', dot: 'bg-slate-500' },
];

export function getListColorStyles(colorName?: string) {
  const match = DEFAULT_LIST_COLORS.find(c => c.value === colorName);
  return match || DEFAULT_LIST_COLORS[0];
}

const SEED_LISTS: CustomMemberList[] = [
  {
    id: 'list_om_zaid',
    name: 'أعضاء طرف الخطابة أم زيد',
    description: 'أعضاء مستوردين ومنسقين عبر الخطابة أم زيد',
    color: 'amber',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'list_vip_education',
    name: 'خاص بي - قطاع التعليم',
    description: 'قائمة خاصة بالعملاء التابعين لقطاع التعليم والجامعات',
    color: 'indigo',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'list_direct_clients',
    name: 'عملاء وساطة مباشرة (جادون)',
    description: 'عملاء تم دفع العربون والتواصل المباشر معهم',
    color: 'emerald',
    createdAt: new Date().toISOString(),
  }
];

export function getCustomLists(): CustomMemberList[] {
  if (typeof window === 'undefined') return SEED_LISTS;
  try {
    const raw = dataService.db.settings.get(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  // إذا كانت فارغة لأول مرة نحفظ القوائم المبدئية
  saveCustomLists(SEED_LISTS);
  return SEED_LISTS;
}

export function saveCustomLists(lists: CustomMemberList[]): void {
  if (typeof window === 'undefined') return;
  try {
    dataService.db.settings.set(STORAGE_KEY, JSON.stringify(lists));
    // Trigger storage event for live UI reactivity
    window.dispatchEvent(new Event('twafok_custom_lists_updated'));
  } catch {
    // ignore
  }
}

export function createCustomList(name: string, description?: string, color: string = 'amber'): CustomMemberList {
  const lists = getCustomLists();
  const trimmedName = name.trim();
  
  // فحص وجود قائمة بنفس الاسم
  const existing = lists.find(l => l.name.trim().toLowerCase() === trimmedName.toLowerCase());
  if (existing) return existing;

  const newList: CustomMemberList = {
    id: 'list_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    name: trimmedName,
    description: description?.trim() || '',
    color: color || 'amber',
    createdAt: new Date().toISOString(),
  };

  lists.unshift(newList);
  saveCustomLists(lists);
  return newList;
}

export function updateCustomList(id: string, updates: Partial<Omit<CustomMemberList, 'id' | 'createdAt'>>): CustomMemberList | null {
  const lists = getCustomLists();
  const index = lists.findIndex(l => l.id === id);
  if (index === -1) return null;

  lists[index] = {
    ...lists[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveCustomLists(lists);
  return lists[index];
}

export async function deleteCustomList(id: string): Promise<void> {
  const liveMembers = dataService.db.getLiveMembers?.(true) || [];
  const affected = liveMembers.filter((m: any) => {
    const values = Array.isArray(m.customLists) ? m.customLists : String(m.customLists || '').split(',').filter(Boolean);
    return values.includes(id);
  });
  // نحفظ إزالة الوسم في قاعدة البيانات أولاً، ثم نحذف تعريف القائمة.
  await Promise.all(affected.map((member: any) => {
    const values = Array.isArray(member.customLists) ? member.customLists : String(member.customLists || '').split(',').filter(Boolean);
    return dataService.db.adminUpdateMember(member.id, { customLists: values.filter((listId: string) => listId !== id) });
  }));
  saveCustomLists(getCustomLists().filter(l => l.id !== id));
}

/**
 * جلب تفاصيل القوائم التي ينتمي لها العضو
 */
export function getMemberCustomLists(memberOrId: any, allLists?: CustomMemberList[]): CustomMemberList[] {
  if (!memberOrId) return [];
  const lists = allLists || getCustomLists();
  let customListsField: any = null;

  if (typeof memberOrId === 'object') {
    customListsField = memberOrId.customLists || memberOrId.custom_lists;
  } else if (typeof memberOrId === 'string') {
    try {
      const live = dataService.db.getLiveMembers?.(true) || [];
      const found = live.find((x: any) => x.id === memberOrId);
      if (found) {
        customListsField = found.customLists || found.custom_lists;
      }
    } catch {
      // ignore
    }
  }

  const memberListIds: string[] = Array.isArray(customListsField)
    ? customListsField
    : (typeof customListsField === 'string' ? customListsField.split(',').map((s: string) => s.trim()) : []);

  if (memberListIds.length === 0) return [];

  return lists.filter(l => memberListIds.includes(l.id) || memberListIds.includes(l.name));
}

/**
 * فحص ما إذا كان العضو ينتمي لقائمة محددة
 */
export function isMemberInCustomList(memberOrId: any, listIdOrName: string): boolean {
  if (!memberOrId || !listIdOrName || listIdOrName === 'all') return true;
  let customListsField: any = null;

  if (typeof memberOrId === 'object') {
    customListsField = memberOrId.customLists || memberOrId.custom_lists;
  } else if (typeof memberOrId === 'string') {
    try {
      const live = dataService.db.getLiveMembers?.(true) || [];
      const found = live.find((x: any) => x.id === memberOrId);
      if (found) {
        customListsField = found.customLists || found.custom_lists;
      }
    } catch {
      // ignore
    }
  }

  const listIds: string[] = Array.isArray(customListsField)
    ? customListsField
    : (typeof customListsField === 'string' ? customListsField.split(',').map((s: string) => s.trim()) : []);

  return listIds.some(lid => lid === listIdOrName || lid.toLowerCase() === listIdOrName.toLowerCase());
}

/**
 * إسناد قائمة مخصصة لمجموعة من الأعضاء وحفظ التغييرات في قاعدة البيانات
 */
export async function assignMembersToCustomList(listId: string, memberIds: string[]): Promise<void> {
  if (!listId || !memberIds || memberIds.length === 0) return;
  const targetSet = new Set(memberIds);
  let liveMembers = dataService.db.getLiveMembers?.(true) || [];
  // قاعدة البيانات هي المصدر المرجعي: إن كان الكاش قديماً أو فارغاً نعيد جلب الأعضاء.
  if (liveMembers.filter((m: any) => targetSet.has(m.id)).length !== targetSet.size) {
    liveMembers = await dataService.db.adminGetMembers();
  }
  const targets = liveMembers.filter((m: any) => targetSet.has(m.id));
  if (targets.length !== targetSet.size) throw new Error('تعذّر العثور على الأعضاء المحددين في قاعدة البيانات');
  const results = await Promise.all(targets.map((member: any) => {
    const current = Array.isArray(member.customLists) ? member.customLists : String(member.customLists || '').split(',').filter(Boolean);
    return dataService.db.adminUpdateMember(member.id, { customLists: current.includes(listId) ? current : [...current, listId] });
  }));
  if (results.some((result) => !result)) throw new Error('تعذّر حفظ إسناد القائمة في قاعدة البيانات');
  window.dispatchEvent(new Event('twafok_custom_lists_updated'));
}

/**
 * إزالة عضو من قائمة مخصصة
 */
export async function removeMemberFromCustomList(listId: string, memberId: string): Promise<void> {
  if (!listId || !memberId) return;
  try {
    const liveMembers = dataService.db.getLiveMembers?.(true) || [];
    const member = liveMembers.find((m: any) => m.id === memberId);
    if (member) {
      const current = Array.isArray(member.customLists) ? member.customLists : String(member.customLists || '').split(',').filter(Boolean);
      if (current.includes(listId)) {
        await dataService.db.adminUpdateMember(member.id, { customLists: current.filter((id: string) => id !== listId) });
      }
      window.dispatchEvent(new Event('twafok_custom_lists_updated'));
    }
  } catch {
    // ignore
  }
}

/**
 * تبديل انتماء العضو لقائمة مخصصة (إضافة / إزالة)
 */
export function toggleMemberCustomList(listId: string, memberId: string): boolean {
  if (!listId || !memberId) return false;
  try {
    const liveMembers = dataService.db.getLiveMembers?.(true) || [];
    let added = false;
    let modified = false;

    const updated = liveMembers.map((m: any) => {
      if (m.id === memberId) {
        const curLists: string[] = Array.isArray(m.customLists) ? [...m.customLists] : [];
        if (curLists.includes(listId)) {
          added = false;
          modified = true;
          return { ...m, customLists: curLists.filter((id: string) => id !== listId) };
        } else {
          added = true;
          modified = true;
          curLists.push(listId);
          return { ...m, customLists: curLists };
        }
      }
      return m;
    });

    if (modified && dataService.db.saveMembers) {
      dataService.db.saveMembers(updated);
      window.dispatchEvent(new Event('twafok_custom_lists_updated'));
    }
    return added;
  } catch {
    return false;
  }
}

