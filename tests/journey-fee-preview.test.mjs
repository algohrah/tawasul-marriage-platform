import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePaidAmount, feeSummary, setPaidTotal, canCoordinate, canChangePreview, allowedStage } from '../public/preview/journey/fee-model.js';
for (const [paid, remaining] of [[0,2500],[100,2400],[250,2250],[500,2000],[750,1750],[1750,750],[2499,1],[2500,0],[2499.99,0.01],[0.01,2499.99]]) {
  test(`cumulative ${paid} SAR leaves ${remaining}`, () => assert.equal(feeSummary(paid).remaining, remaining));
}
test('accepts Arabic and Persian numerals, including halalas', () => {
  assert.equal(parsePaidAmount('٢٥٠٠'),2500); assert.equal(parsePaidAmount('۲۵۰'),250); assert.equal(parsePaidAmount('١٢٥٫٥٠'),125.5);
});
test('invalid amounts are rejected instead of clamped or treated as zero', () => {
  for (const input of ['', ' ', '-1', '2500.01', '2501', 'NaN', 'Infinity', '1e3', '1,000', 'abc', '2.555', null, undefined, true]) assert.throws(() => parsePaidAmount(input));
});
test('repeated save replaces cumulative amount, never adds it twice', () => {
  let party = setPaidTotal({paid:0,accepted:true,source:'matchmaker'},250);
  party = setPaidTotal(party,250); assert.equal(party.paid,250); assert.equal(feeSummary(party.paid).remaining,2250);
  party = setPaidTotal(party,2500); assert.equal(feeSummary(party.paid).remaining,0);
});
test('fractional arithmetic always uses halalas', () => {
  for (let paid=0;paid<=250000;paid+=137) { const summary=feeSummary((paid/100).toFixed(2)); assert.equal(Math.round(summary.paid*100)+Math.round(summary.remaining*100),250000); }
});
test('remaining balance differs from due now before mahr', () => {
  assert.equal(feeSummary(250).dueNow,250); assert.equal(feeSummary(500).dueNow,0); assert.equal(feeSummary(250,{deferred:true}).dueNow,0);
  assert.equal(feeSummary(250,{mahrDelivered:true}).dueNow,2250);
});
test('no payment is not paid, including when deferred', () => {
  assert.equal(feeSummary(0,{deferred:true}).status,'غير مدفوعة'); assert.equal(feeSummary(250).status,'مدفوعة جزئيًا'); assert.equal(feeSummary(2500).status,'مدفوعة بالكامل');
});
test('source does not change fees or stages', () => {
  for (const source of ['registered','matchmaker','admin','imported']) {
    const party={source,paid:250,accepted:true,deferred:true}; assert.equal(feeSummary(party.paid,party).remaining,2250); assert.equal(canCoordinate([party,party]),true);
  }
});
test('coordination needs actual acceptance and either minimum payment or explicit deferral', () => {
  const accepted={paid:500,accepted:true,deferred:false}; assert.ok(canCoordinate([accepted,accepted]));
  assert.equal(canCoordinate([accepted,{...accepted,accepted:false}]),false);
  assert.equal(canCoordinate([accepted,{...accepted,paid:0}]),false);
  assert.ok(canCoordinate([accepted,{...accepted,paid:0,deferred:true}]));
});
test('paying full balance does not imply acceptance, marriage, or closure', () => {
  const party={paid:2500,accepted:false,deferred:false}; assert.equal(allowedStage(4,[party,party],''),false); assert.equal(feeSummary(party.paid).remaining,0);
});
test('admin preview controls are unavailable to member or moderator simulation', () => {
  assert.equal(canChangePreview('admin'),true); for(const role of ['member','moderator','']) assert.equal(canChangePreview(role),false);
});
test('production API, gateway and main website are untouched by isolated preview', () => {
  const html=readFileSync(new URL('../public/preview/journey/index.html',import.meta.url),'utf8');
  const js=readFileSync(new URL('../public/preview/journey/journey-preview.js',import.meta.url),'utf8');
  for (const forbidden of ['fetch(', 'supabase', 'localStorage', 'sessionStorage', 'wa.me']) assert.ok(!js.includes(forbidden));
  assert.ok(html.includes('noindex,nofollow'));
  const workflow=readFileSync(new URL('../.github/workflows/journey-fee-preview.yml',import.meta.url),'utf8');
  assert.ok(workflow.includes('destination_dir: previews/journey-fees')); assert.ok(workflow.includes('keep_files: true')); assert.ok(!workflow.includes('branches: [main]'));
});
