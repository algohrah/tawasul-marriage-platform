import { useEffect, useMemo, useState } from 'react';
import { FolderHeart, Plus, Trash2, Users, X } from 'lucide-react';
import { createCustomList, deleteCustomList, getCustomLists, getListColorStyles, type CustomMemberList } from '../../lib/customLists';
import { dataService } from '../../lib/data/DataService';

type Props = { members: Array<{ id: string; customLists?: string[] | string; custom_lists?: string[] | string }> };

function memberCount(list: CustomMemberList, members: Props['members']) {
  return members.filter((member) => {
    const values = Array.isArray(member.customLists || member.custom_lists)
      ? member.customLists || member.custom_lists
      : String(member.customLists || member.custom_lists || '').split(',').map((item) => item.trim());
    return Array.isArray(values) && values.includes(list.id);
  }).length;
}

export default function CustomListsPanel({ members }: Props) {
  const [lists, setLists] = useState<CustomMemberList[]>(() => getCustomLists());
  const [memberRows, setMemberRows] = useState<Props['members']>(members);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const refresh = () => setLists(getCustomLists());

  useEffect(() => {
    const refreshAll = async () => {
      refresh();
      const rows = await dataService.db.adminGetMembers();
      if (Array.isArray(rows)) setMemberRows(rows);
    };
    void refreshAll();
    window.addEventListener('twafok_custom_lists_updated', refreshAll);
    return () => window.removeEventListener('twafok_custom_lists_updated', refreshAll);
  }, []);

  useEffect(() => setMemberRows(members), [members]);

  const totalAssigned = useMemo(() => lists.reduce((total, list) => total + memberCount(list, memberRows), 0), [lists, memberRows]);
  const create = () => {
    if (!name.trim()) return;
    createCustomList(name, description, 'amber');
    setName(''); setDescription(''); refresh();
  };
  const remove = async (list: CustomMemberList) => {
    if (!window.confirm(`حذف قائمة «${list.name}»؟ سيتم أيضاً إزالة تصنيفها من الأعضاء.`)) return;
    await deleteCustomList(list.id); await dataService.db.adminGetMembers(); refresh();
  };

  return <div className="space-y-4" dir="rtl">
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950"><FolderHeart className="h-5 w-5" /></span><div><h3 className="font-cairo font-extrabold text-slate-900">القوائم والتصنيفات المخصصة</h3><p className="mt-0.5 text-xs font-tajawal text-slate-600">مكان موحد لتصنيف الأعضاء المرتبطين بالمكاتب والخطابات أو أي شريحة عمل.</p></div></div>
      <span className="rounded-full bg-white px-3 py-1 text-xs font-cairo font-bold text-amber-800 border border-amber-200">{lists.length} قائمة · {totalAssigned} إسناد</span>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h4 className="mb-3 text-sm font-cairo font-bold text-slate-800">إنشاء قائمة جديدة</h4>
      <div className="grid gap-2 sm:grid-cols-[1fr_1.3fr_auto]"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم القائمة" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-tajawal outline-none focus:border-amber-400"/><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف مختصر اختياري" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-tajawal outline-none focus:border-amber-400"/><button type="button" onClick={create} disabled={!name.trim()} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-cairo font-bold text-white disabled:opacity-40 hover:bg-slate-800"><Plus className="h-4 w-4"/>إضافة</button></div>
    </div>
    <div className="grid gap-3 md:grid-cols-2">{lists.map((list) => { const color = getListColorStyles(list.color); const count = memberCount(list, memberRows); return <article key={list.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-cairo font-bold ${color.bg} ${color.text} ${color.border}`}><span className={`h-2 w-2 rounded-full ${color.dot}`}/>{list.name}</div><p className="mt-2 truncate text-xs font-tajawal text-slate-500">{list.description || 'بدون وصف'}</p></div><button type="button" onClick={() => remove(list)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" title="حذف القائمة" aria-label={`حذف قائمة ${list.name}`}><Trash2 className="h-4 w-4"/></button></div><div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[11px] font-tajawal text-slate-500"><Users className="h-3.5 w-3.5"/>{count} عضو ضمن القائمة</div></article>; })}</div>
    {lists.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-tajawal text-slate-400">لا توجد قوائم مخصصة بعد.</div>}
  </div>;
}
