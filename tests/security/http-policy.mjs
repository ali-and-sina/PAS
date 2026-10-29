import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContentSecurityPolicy } from '../../lib/security/csp.js';
import { hasSameOrigin } from '../../lib/security/request-origin.js';

test('production CSP restricts scripts and connections to trusted sources', () => {
  const policy = buildContentSecurityPolicy({ nonce: 'aFreshRandomNonce123', supabaseUrl: 'https://project.supabase.co/path' });
  assert.match(policy, /script-src 'self' 'nonce-aFreshRandomNonce123' 'strict-dynamic'/);
  assert.doesNotMatch(policy, /unsafe-eval/);
  assert.match(policy, /connect-src 'self' https:\/\/project.supabase.co wss:\/\/project.supabase.co;/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /form-action 'self'/);
  assert.match(policy, /upgrade-insecure-requests/);
});

test('nonce input cannot inject a policy directive', () => {
  assert.throws(() => buildContentSecurityPolicy({ nonce: "x'; script-src *", supabaseUrl: 'https://project.supabase.co' }));
});

test('development allows local HMR without weakening production script policy', () => {
  const policy = buildContentSecurityPolicy({ nonce: 'nonce', supabaseUrl: 'http://127.0.0.1:54321', development: true });
  assert.match(policy, /'unsafe-eval'/);
  assert.match(policy, /ws:\/\/127.0.0.1:54321/);
  assert.doesNotMatch(policy, /upgrade-insecure-requests/);
});

test('signout accepts only the application origin', () => {
  const request = origin => new Request('https://pas.example/auth/signout', { method: 'POST', headers: origin === undefined ? {} : { origin } });
  assert.equal(hasSameOrigin(request('https://pas.example')), true);
  for (const origin of [undefined, 'null', 'https://attacker.invalid', 'https://pas.example.attacker.invalid', 'http://pas.example', 'not a URL']) {
    assert.equal(hasSameOrigin(request(origin)), false, String(origin));
  }
});

test('signout compares the public host when Next uses an internal URL', () => {
  const request = new Request('http://localhost:3000/auth/signout', { method: 'POST', headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' } });
  assert.equal(hasSameOrigin(request), true);
  const forwarded = new Request('http://internal:3000/auth/signout', { method: 'POST', headers: { host: 'internal:3000', 'x-forwarded-host': 'pas.example', 'x-forwarded-proto': 'https', origin: 'https://pas.example' } });
  assert.equal(hasSameOrigin(forwarded), true);
  const foreign = new Request(forwarded, { headers: { ...Object.fromEntries(forwarded.headers), origin: 'https://attacker.invalid' } });
  assert.equal(hasSameOrigin(foreign), false);
});
