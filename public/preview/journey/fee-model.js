// Preview-only calculations. Values are cumulative SAR totals, not new payments.
export const TOTAL_FEE = 2500;
export const START_FEE = 500;

export function parsePaidAmount(input) {
  const raw = String(input ?? '').trim()
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/٫/g, '.');
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error('أدخل مبلغًا من 0 إلى 2500 ريال، بحد أقصى منزلتين عشريتين.');
  }
  const [whole, fraction = ''] = raw.split('.');
  const halalas = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(halalas) || halalas > TOTAL_FEE * 100) {
    throw new Error('المبلغ يجب ألا يتجاوز إجمالي الرسوم: 2500 ريال.');
  }
  return halalas / 100;
}

export function feeSummary(input, { deferred = false, mahrDelivered = false } = {}) {
  const paid = parsePaidAmount(input);
  const remaining = (TOTAL_FEE * 100 - Math.round(paid * 100)) / 100;
  const startRemaining = Math.max(0, (START_FEE * 100 - Math.round(paid * 100)) / 100);
  return {
    paid, remaining, startRemaining,
    dueNow: mahrDelivered ? remaining : (deferred ? 0 : startRemaining),
    mayCoordinate: paid >= START_FEE || deferred,
    status: remaining === 0 ? 'مدفوعة بالكامل' : paid === 0 ? 'غير مدفوعة' : 'مدفوعة جزئيًا',
  };
}

export function setPaidTotal(party, amount, deferred = false) {
  return { ...party, paid: parsePaidAmount(amount), deferred: Boolean(deferred) };
}

export function canCoordinate(parties) {
  return parties.every(party => party.accepted && feeSummary(party.paid, party).mayCoordinate);
}

export function canChangePreview(role) { return role === 'admin'; }

export function allowedStage(stage, parties, result) {
  if (stage < 0 || stage > 4 || !Number.isInteger(stage)) return false;
  if (stage >= 1 && !parties.every(party => party.accepted)) return false;
  if (stage >= 2 && !canCoordinate(parties)) return false;
  if (stage === 4 && !result) return false;
  return true;
}
