import { feeSummary, parsePaidAmount, setPaidTotal, canCoordinate, canChangePreview, allowedStage } from './fee-model.js';
const $ = id => document.getElementById(id);
const stages = ['الاهتمام', 'بدء الخدمة', 'التنسيق', 'النتيجة', 'إغلاق الرحلة'];
const descriptions = [
  'يُسجّل قبول أو رفض كل طرف. الإدارة تحصل على الرد مباشرة أو عبر الخطّابة دون تغيير مسار الرحلة.',
  'تم القبول مبدئيًا. تتولى الإدارة مراجعة السداد السابق واعتماد المبلغ أو التأجيل لكل طرف.',
  'الإدارة تتولى التنسيق مع الطرفين. لا تُشارك بيانات التواصل تلقائيًا ولا توجد محادثة بين الأعضاء.',
  'تُسجّل رغبة الطرفين ونتيجة المتابعة. استحقاق المتبقي مرتبط بتسليم المهر وفق اتفاق الخدمة.',
  'انتهت متابعة الرحلة. حالة الرسوم مستقلة؛ الإغلاق لا يعني السداد، والسداد لا يثبت وقوع الزواج.',
];
const sources = [['registered', 'مسجّل بنفسه'], ['matchmaker', 'من طرف خطّابة'], ['admin', 'مستورد بواسطة الإدارة'], ['imported', 'ملف مستورد آخر']];
const money = value => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 }).format(value);
const name = party => party === 'sender' ? 'المرسِل — عضو تجريبي 1' : 'المستقبِل — عضو تجريبي 2';
const initial = () => ({ stage: 0, closed: false, result: '', mahrDelivered: false, sender: { paid: 0, accepted: false, deferred: false, source: 'registered' }, receiver: { paid: 0, accepted: false, deferred: false, source: 'matchmaker' }, audit: ['بدأت المعاينة ببيانات تجريبية، دون أي سداد معتمد.'] });
let state = initial();
let pendingPayment = null;
let toastTimer;
const role = () => $('view-role').value;
const admin = () => canChangePreview(role());
const parties = () => [state.sender, state.receiver];
function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500); }
function record(text) { state.audit.unshift(text); }
function makeButton(text, onClick, style = 'secondary', disabled = false) {
  const button = document.createElement('button'); button.type = 'button'; button.className = `button ${style}`; button.textContent = text; button.disabled = disabled; button.addEventListener('click', onClick); return button;
}
function setStage(next, reason) {
  if (!admin()) return toast('تغيير المرحلة متاح للإدارة فقط في هذه المحاكاة.');
  if (!reason.trim()) return toast('اكتب سبب تحديث المرحلة.');
  if (!allowedStage(next, parties(), state.result)) return toast('استكمل قبول الطرفين ومتطلبات بدء الخدمة، وحدد النتيجة قبل الإغلاق.');
  const previous = stages[state.stage]; state.stage = next; state.closed = next === 4; record(`الإدارة: ${previous} ← ${stages[next]}. السبب: ${reason}`); render(); toast('تم تحديث المرحلة داخل المعاينة فقط.');
}
function renderParty(key) {
  const party = state[key]; const card = document.createElement('article'); card.className = 'party';
  const title = document.createElement('div'); title.className = 'party-title';
  const heading = document.createElement('h3'); heading.textContent = name(key); title.append(heading);
  const status = document.createElement('span'); status.className = 'tag'; status.textContent = party.accepted ? 'قبول مبدئي مسجّل' : 'بانتظار الرد'; title.append(status); card.append(title);
  if (admin()) {
    const label = document.createElement('label'); label.htmlFor = `source-${key}`; label.textContent = 'مصدر الملف — داخلي للإدارة';
    const select = document.createElement('select'); select.id = `source-${key}`;
    sources.forEach(([value, text]) => { const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option); }); select.value = party.source;
    select.addEventListener('change', () => { state[key].source = select.value; record(`تحديث مصدر ${name(key)}، دون تغيير الرسوم أو المراحل.`); render(); }); card.append(label, select);
    const channel = document.createElement('p'); channel.className = 'muted'; channel.textContent = party.source === 'matchmaker' ? 'الإدارة ← الخطّابة ← العضو ← الخطّابة ← الإدارة.' : party.source === 'registered' ? 'يمكن للعضو الرد بنفسه، أو تسجّل الإدارة رده بعد التحقق.' : 'تسجّل الإدارة رد العضو الفعلي بعد التواصل معه.'; card.append(channel);
  }
  if ((admin() || (role() === 'member' && $('view-party').value === key)) && state.stage === 0 && !state.closed) {
    const actions = document.createElement('div'); actions.className = 'actions';
    actions.append(makeButton(party.accepted ? 'إلغاء القبول التجريبي' : admin() ? 'تسجيل قبول الطرف' : 'قبول مبدئي', () => { party.accepted = !party.accepted; record(`${admin() ? 'الإدارة سجّلت الرد' : 'رد العضو التجريبي'}: ${name(key)} — ${party.accepted ? 'قبول مبدئي' : 'إلغاء القبول'}.`); render(); }, party.accepted ? 'secondary' : 'primary'));
    actions.append(makeButton('رفض الطلب', () => { state.result = 'no-match'; state.closed = true; record(`رفض الطلب من ${name(key)}؛ أُغلقت المتابعة دون حذف بيانات الرسوم.`); render(); }, 'danger')); card.append(actions);
  }
  return card;
}
function renderFee(key) {
  const balance = feeSummary(state[key].paid, { deferred: state[key].deferred, mahrDelivered: state.mahrDelivered });
  const card = document.createElement('article'); card.className = 'fee-card';
  // Interpolated values here are fixed labels or validated numbers, never user notes.
  card.innerHTML = `<h3>${name(key)}</h3><div class="money-grid"><div class="money-box"><span>المدفوع المعتمد — تجريبي</span><strong data-paid="${key}">${money(balance.paid)}</strong><span>ريال</span></div><div class="money-box remaining"><span>المتبقي من إجمالي 2500</span><strong data-remaining="${key}">${money(balance.remaining)}</strong><span>ريال</span></div></div><p class="status ${balance.remaining === 0 ? 'paid' : ''}">${balance.status}</p><div class="detail-row"><span>المطلوب الآن في هذا السيناريو</span><strong>${money(balance.dueNow)} ريال</strong></div><div class="detail-row"><span>متبقي رسوم البداية</span><strong>${money(balance.startRemaining)} ريال</strong></div>`;
  const note = document.createElement('p'); note.className = 'footnote'; note.textContent = balance.remaining === 0 ? 'دُفعت جميع الرسوم في هذا السيناريو. هذا لا يثبت الزواج ولا يغيّر نتيجة الرحلة.' : state[key].deferred ? 'تأجيل رسوم البداية معتمد في المحاكاة، وليس إعفاءً. لا يُطلب المتبقي النهائي قبل تحقق الاستحقاق.' : 'المتبقي الحسابي ليس كله مستحقًا الآن. المتبقي النهائي يُطلب بعد تسليم المهر وفق الاتفاق.'; card.append(note); return card;
}
function updateCalculation() {
  try { const balance = feeSummary($('paid-amount').value); $('amount-error').textContent = ''; $('paid-amount').removeAttribute('aria-invalid'); $('live-calculation').innerHTML = `<div><span>المتبقي بعد اعتماد هذا الإجمالي</span><strong id="draft-remaining">${money(balance.remaining)} ريال</strong></div><span>${balance.status}</span>`; $('save-payment').disabled = !admin(); }
  catch (error) { $('amount-error').textContent = error.message; $('paid-amount').setAttribute('aria-invalid', 'true'); $('live-calculation').textContent = 'صحح المبلغ لعرض المتبقي.'; $('save-payment').disabled = true; }
}
function render() {
  $('jump-fees').hidden = !admin(); $('admin-panel').hidden = !admin(); $('audit-panel').hidden = !admin(); $('member-select').hidden = role() !== 'member'; $('member-followup').hidden = state.stage === 0 || state.closed;
  $('steps').replaceChildren(...stages.map((label, index) => { const li = document.createElement('li'); li.className = `step ${!state.closed && index === state.stage ? 'current' : index < state.stage ? 'done' : ''}`; if (!state.closed && index === state.stage) li.setAttribute('aria-current', 'step'); li.innerHTML = `<span class="step-number">${index + 1}</span><span>${label}</span>`; return li; }));
  $('stage-count').textContent = state.closed ? 'متابعة مغلقة — الحالة المالية مستقلة' : `المرحلة ${state.stage + 1} من 5`;
  $('stage-title').textContent = state.closed ? state.result === 'no-match' ? 'انتهت الرحلة دون توافق' : state.result === 'withdrawn' ? 'أُغلقت الرحلة بعد الانسحاب' : 'أُغلقت المتابعة' : stages[state.stage];
  $('stage-description').textContent = state.closed ? descriptions[4] : descriptions[state.stage];
  const actionBox = $('stage-actions'); actionBox.replaceChildren();
  if (admin() && !state.closed && state.stage < 4) actionBox.append(makeButton(`الانتقال إلى ${stages[state.stage + 1]}`, () => setStage(state.stage + 1, 'متابعة تجريبية مع استيفاء المتطلبات'), 'primary', !allowedStage(state.stage + 1, parties(), state.result)));
  if (admin() && state.closed) actionBox.append(makeButton('إعادة فتح المتابعة التجريبية', () => { state.closed = false; state.stage = Math.min(state.stage, 3); record('الإدارة أعادت فتح المتابعة؛ لم تُحذف بيانات الرسوم.'); render(); }));
  $('stage-hint').textContent = role() === 'moderator' ? 'عرض تجريبي للمشرف: لا توجد صلاحية لتسجيل السداد أو التأجيل أو نقل المراحل.' : state.stage === 0 && !state.closed ? 'لا تبدأ الخدمة قبل الحصول على القبول المبدئي من الطرفين.' : state.stage === 1 && !canCoordinate(parties()) ? 'يمكن التواصل مع الإدارة الآن؛ بدء التنسيق يحتاج استيفاء الرسوم أو تأجيلًا معتمدًا لكل طرف.' : '';
  const visible = role() === 'member' ? [$('view-party').value] : ['sender', 'receiver']; $('parties').replaceChildren(...visible.map(renderParty)); $('fee-cards').replaceChildren(...visible.map(renderFee));
  $('audit').replaceChildren(...state.audit.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  $('admin-stage').value = String(state.stage); $('result').value = state.result; $('mahr').checked = state.mahrDelivered;
  updateCalculation();
}
$('view-role').addEventListener('change', render); $('view-party').addEventListener('change', render);
$('reset').addEventListener('click', () => { state = initial(); $('paid-amount').value = '500'; $('defer').checked = false; $('payment-note').value = ''; $('stage-note').value = ''; render(); toast('أُعيدت البيانات التجريبية فقط.'); });
$('jump-fees').addEventListener('click', () => { $('admin-panel').scrollIntoView({ behavior: 'auto', block: 'start' }); $('paid-amount').focus({ preventScroll: true }); });
$('paid-amount').addEventListener('input', updateCalculation);
document.querySelectorAll('[data-amount]').forEach(button => button.addEventListener('click', () => { $('paid-amount').value = button.dataset.amount; updateCalculation(); }));
$('payment-party').addEventListener('change', () => { const party = state[$('payment-party').value]; $('paid-amount').value = String(party.paid); $('defer').checked = party.deferred; updateCalculation(); });
$('payment-form').addEventListener('submit', event => {
  event.preventDefault(); if (!admin()) return toast('الإجراء متاح للإدارة فقط في هذه المحاكاة.');
  try {
    const amount = parsePaidAmount($('paid-amount').value); const note = $('payment-note').value.trim(); const key = $('payment-party').value;
    if (!note) return toast('اكتب ملاحظة الاعتماد أو سبب التصحيح.');
    pendingPayment = { key, amount, deferred: $('defer').checked && amount < 500, note };
    const balance = feeSummary(amount); $('confirmation-body').replaceChildren();
    [name(key), `إجمالي المسدد السابق: ${money(state[key].paid)} ريال`, `الإجمالي الجديد: ${money(amount)} ريال`, `المتبقي: ${money(balance.remaining)} ريال`, pendingPayment.deferred ? 'سيُسمح ببدء التنسيق مع تأجيل رسوم البداية غير المسددة.' : 'لم يُعتمد تأجيل إضافي.'].forEach(text => { const p = document.createElement('p'); p.textContent = text; $('confirmation-body').append(p); });
    $('confirmation').showModal();
  } catch (error) { toast(error.message); }
});
$('confirmation').addEventListener('close', () => {
  if ($('confirmation').returnValue !== 'confirm' || !pendingPayment || !admin()) { pendingPayment = null; return; }
  const { key, amount, deferred, note } = pendingPayment; const previous = state[key].paid;
  state[key] = setPaidTotal(state[key], amount, deferred);
  record(`اعتماد تجريبي للإدارة: ${name(key)}؛ إجمالي سابق ${previous} ← إجمالي جديد ${amount} ريال؛ المتبقي ${feeSummary(amount).remaining} ريال. ${deferred ? 'تأجيل معتمد. ' : ''}الملاحظة: ${note}`);
  pendingPayment = null; render(); toast('تم اعتماد الإجمالي التجريبي وحساب المتبقي، دون تحصيل حقيقي.');
});
$('apply-stage').addEventListener('click', () => setStage(Number($('admin-stage').value), $('stage-note').value));
$('result').addEventListener('change', () => { if (!admin()) return; state.result = $('result').value; record('الإدارة حدّثت نتيجة المتابعة التجريبية.'); render(); });
$('mahr').addEventListener('change', () => { if (!admin()) return; state.mahrDelivered = $('mahr').checked; record(`تأكيد تسليم المهر في المحاكاة: ${state.mahrDelivered ? 'نعم' : 'لا'}. لم تُسجّل دفعة تلقائية.`); render(); });
$('close-early').addEventListener('click', () => { if (!admin()) return; if (!['no-match', 'withdrawn'].includes(state.result)) return toast('حدد عدم التوافق أو الانسحاب قبل الإغلاق المبكر.'); state.closed = true; record('إغلاق مبكر بقرار الإدارة، مع حفظ السجل المالي التجريبي.'); render(); });
$('whatsapp-preview').addEventListener('click', () => { $('whatsapp-message').textContent = 'السلام عليكم، أرغب بمتابعة طلب التوافق رقم TW-DEMO-001. أرجو مراجعة الخطوة التالية وحالة رسوم الخدمة الخاصة بي.\n\nهذه رسالة تجريبية فقط، ولن تُرسل.'; $('message-dialog').showModal(); });
render();
