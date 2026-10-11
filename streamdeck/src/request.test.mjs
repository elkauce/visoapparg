import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activate, parseActionUrl } from './request.mjs';
const url = `https://example.convex.site/deck/set?token=${'a'.repeat(48)}&status=status-id`;
test('only the authenticated Convex Deck endpoint is accepted', () => {
  assert.equal(parseActionUrl(url).searchParams.get('status'), 'status-id');
  for (const value of [url.replace('https:', 'http:'), url.replace('example.convex.site', 'example.com'), url.replace('/deck/set', '/other'), url.replace('token=', 'missing='), url.replace('status=status-id', 'status='), url.replace('https://', 'https://user:secret@'), url + '#fragment']) assert.throws(() => parseActionUrl(value));
});
test('one user press requires confirmed success, forbids redirects and has a timeout', async () => {
  let calls = 0;
  await activate(url, async (input, options) => { calls++; assert.equal(input.toString(), url); assert.equal(options.redirect, 'error'); assert.ok(options.signal); return { ok: true, json: async () => ({ ok: true }) }; });
  assert.equal(calls, 1);
});
test('revoked tokens, missing states, false confirmations and failed connections are not success', async () => {
  for (const status of [401, 404, 500]) await assert.rejects(activate(url, async () => ({ ok: false, status })));
  await assert.rejects(activate(url, async () => ({ ok: true, json: async () => ({ ok: false }) })));
  await assert.rejects(activate(url, async () => { throw new Error('offline'); }));
});
test('invalid settings never send a network request', async () => {
  let called = false; await assert.rejects(activate('invalid', async () => { called = true; })); assert.equal(called, false);
});
