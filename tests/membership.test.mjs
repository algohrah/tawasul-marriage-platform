import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlan, dailyRequestLimit, canUseFilter, requestDay, compareMemberPriority, FEATURED_PRICE } from '../shared/membership.js';
test('legacy memberships retain entitlement in the new two-plan catalog', () => {
  for (const plan of ['gold', 'elite', 'premium', 'custom-paid', 'featured']) assert.equal(normalizePlan(plan), 'featured');
  assert.equal(normalizePlan('free'), 'free');
  assert.equal(normalizePlan(null, true), 'featured');
  assert.equal(FEATURED_PRICE, 99);
});
test('five free / twenty featured requests', () => {
  assert.equal(dailyRequestLimit({plan:'free'}), 5);
  assert.equal(dailyRequestLimit({plan:'featured'}), 20);
});
test('exactly four free filters; every other filter requires featured', () => {
  for (const field of ['gender','country','age','city']) assert.equal(canUseFilter({plan:'free'}, field), true);
  for (const field of ['searchQuery','nationality','education','job','maritalStatus','sect','hasChildren','childrenCount','marriageType','acceptForeigner']) {
    assert.equal(canUseFilter({plan:'free'}, field), false);
    assert.equal(canUseFilter({plan:'featured'}, field), true);
  }
});
test('daily quota rolls at midnight UTC+3', () => {
  assert.equal(requestDay('2026-10-03T20:59:59Z').key, '2026-10-03');
  assert.equal(requestDay('2026-10-03T21:00:00Z').key, '2026-10-04');
});
test('featured ranks above comparable free profiles, not stronger matches', () => {
  assert.ok(compareMemberPriority({plan:'featured'}, {plan:'free'}, 80, 80) < 0);
  assert.ok(compareMemberPriority({plan:'featured'}, {plan:'free'}, 50, 90) > 0);
});
