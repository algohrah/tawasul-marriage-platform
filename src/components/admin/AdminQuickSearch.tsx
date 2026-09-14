import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, UserRound, Heart, ArrowUpLeft, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Member = { id: string; nickname?: string; realName?: string; city?: string; country?: string };
type Request = { id: string | number; senderId?: string; receiverId?: string; status?: string; journey_stage?: string };

type Props = { members: Member[]; requests: Request[] };

export default function AdminQuickSearch({ members, requests }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const normalized = query.trim().toLowerCase();
  const memberMatches = useMemo(() => !normalized ? [] : members.filter((member) =>
    [member.id, member.nickname, member.realName, member.city, member.country].some((value) => String(value || '').toLowerCase().includes(normalized))
  ).slice(0, 5), [members, normalized]);
  const requestMatches = useMemo(() => !normalized ? [] : requests.filter((request) =>
    [request.id, request.senderId, request.receiverId, request.status, request.journey_stage].some((value) => String(value || '').toLowerCase().includes(normalized))
  ).slice(0, 4), [requests, normalized]);

  const go = (path: string) => { navigate(path); setOpen(false); setQuery(''); };

  return (
    <div className="relative">
      <button type="button" onClick={() => { setOpen(true); window.setTimeout(() => inputRef.current?.focus(), 0); }} className="hidden xl:flex w-72 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right text-xs font-tajawal text-slate-500 transition hover:bg-white hover:border-amber-300" aria-label="بحث إداري شامل">
        <Search className="h-4 w-4 text-amber-600" />
        <span className="flex-1">ابحث عن عضو أو طلب...</span>
        <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400">⌘ K</kbd>
      </button>
      {open && <>
        <div className="fixed inset-0 z-[70] bg-slate-950/30 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
        <div className="fixed z-[80] left-3 right-3 top-20 mx-auto max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" dir="rtl">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <Search className="h-5 w-5 text-amber-600" />
            <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم، المعرف، المدينة أو رقم الطلب..." className="min-w-0 flex-1 bg-transparent text-sm font-tajawal text-slate-800 outline-none placeholder:text-slate-400" />
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="إغلاق البحث"><X className="h-4 w-4" /></button>
          </div>
          <div className="max-h-[55vh] overflow-y-auto p-2">
            {!normalized && <p className="p-4 text-center text-xs font-tajawal text-slate-400">ابدأ بالكتابة للبحث في بيانات الإدارة الحية.</p>}
            {memberMatches.length > 0 && <SearchGroup title="الأعضاء">{memberMatches.map((member) => <button type="button" key={member.id} onClick={() => go(`/admin/members?member=${encodeURIComponent(member.id)}`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right hover:bg-amber-50"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700"><UserRound className="h-4 w-4" /></span><span className="min-w-0 flex-1"><b className="block truncate text-xs font-cairo text-slate-800">{member.nickname || member.realName || member.id}</b><small className="block truncate text-[11px] text-slate-400">{member.country || '—'} · {member.city || '—'} · {member.id}</small></span><ArrowUpLeft className="h-4 w-4 text-slate-400" /></button>)}</SearchGroup>}
            {requestMatches.length > 0 && <SearchGroup title="طلبات الاهتمام">{requestMatches.map((request) => <button type="button" key={String(request.id)} onClick={() => go(`/admin/journeys?tab=requests&request=${encodeURIComponent(String(request.id))}`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right hover:bg-rose-50"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-700"><Heart className="h-4 w-4" /></span><span className="min-w-0 flex-1"><b className="block text-xs font-cairo text-slate-800">طلب رقم {request.id}</b><small className="block truncate text-[11px] text-slate-400">{request.status || request.journey_stage || 'قيد المتابعة'}</small></span><ArrowUpLeft className="h-4 w-4 text-slate-400" /></button>)}</SearchGroup>}
            {normalized && memberMatches.length + requestMatches.length === 0 && <p className="p-5 text-center text-xs font-tajawal text-slate-400">لا توجد نتائج مطابقة في البيانات الحالية.</p>}
          </div>
        </div>
      </>}
    </div>
  );
}

function SearchGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-2"><p className="px-3 pb-1 pt-2 text-[11px] font-cairo font-bold text-slate-400">{title}</p>{children}</section>;
}
