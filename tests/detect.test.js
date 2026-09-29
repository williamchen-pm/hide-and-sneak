const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../extension/lib/detect.js');

const red = (t, packs) => D.redactText(t, packs).text;

test('checksums', () => {
  assert.equal(D.luhnValid('4111111111111111'), true);
  assert.equal(D.luhnValid('4111111111111112'), false);
  assert.equal(D.abaValid('021000021'), true);   // JPMorgan Chase NY (public)
  assert.equal(D.abaValid('123456789'), false);
});

test('identity: SSN', () => {
  assert.equal(red('SSN: 123-45-6789 on file'), 'SSN: [SSN] on file');
  assert.equal(red('your social security number 123456789.'), 'your social security number [SSN].');
  assert.equal(red('ref 123456789'), 'ref 123456789', 'bare 9 digits without keyword is not an SSN');
  assert.equal(red('invalid 000-12-3456'), 'invalid 000-12-3456');
  assert.equal(red('invalid 666-12-3456'), 'invalid 666-12-3456');
});

test('identity: DOB and IDs', () => {
  assert.equal(red('Date of birth: 04/12/1990'), 'Date of birth: [DATE OF BIRTH]');
  assert.equal(red('DOB 1990-04-12'), 'DOB [DATE OF BIRTH]');
  assert.equal(red('Passport number: X12345678'), 'Passport number: [ID NUMBER]');
  assert.equal(red('Meeting on 04/12/2026'), 'Meeting on 04/12/2026', 'plain dates stay');
});

test('payments: cards', () => {
  assert.equal(red('Card 4111 1111 1111 1111 exp'), 'Card [CARD #] exp');
  assert.equal(red('card 4111-1111-1111-1111'), 'card [CARD #]');
  assert.equal(red('5500005555555559'), '[CARD #]');
  assert.equal(red('amex 3782 822463 10005'), 'amex [CARD #]');
  assert.equal(red('Order #4111111111111112'), 'Order #4111111111111112', 'fails Luhn');
  assert.equal(red('USPS 9400 1000 0000 0000 0000 00'), 'USPS 9400 1000 0000 0000 0000 00', 'tracking starting with 9');
});

test('payments: bank', () => {
  assert.equal(red('Routing number: 021000021'), 'Routing number: [ROUTING #]');
  assert.equal(red('Routing number: 123456789'), 'Routing number: 123456789', 'fails ABA checksum');
  assert.equal(red('Account #: 000123456789'), 'Account #: [ACCOUNT #]');
  assert.equal(red('account ending in 4321'), 'account ending in 4321', 'last-4 stays');
  assert.equal(red('CVV: 123'), 'CVV: [CVV]');
});

test('credentials: 2FA codes', () => {
  assert.equal(red('Your verification code is 482913.'), 'Your verification code is [2FA CODE].');
  assert.equal(red('482913 is your Google verification code'), '[2FA CODE] is your Google verification code');
  assert.equal(red('Security code: 123 456'), 'Security code: [2FA CODE]');
  assert.equal(red('Zip code 27511'), 'Zip code 27511', 'zip code is not 2FA');
  assert.equal(red('Promo code 2026 applies'), 'Promo code 2026 applies');
  assert.equal(red('Area code 919'), 'Area code 919');
});

test('contact pack is off by default, on when enabled', () => {
  const t = 'Call (919) 555-1234 or visit 746 Main Street, Apt 2';
  assert.equal(red(t), t);
  assert.equal(red(t, { contact: true }), 'Call [PHONE] or visit [ADDRESS]');
});

test('job pack: salary', () => {
  assert.equal(red('Desired salary: $120,000'), 'Desired salary: [SALARY]');
  assert.equal(red('Salary range $140k - $160k'), 'Salary range [SALARY]');
  assert.equal(red('The price is $120,000'), 'The price is $120,000', 'prices without salary keywords stay');
});

test('packs can be disabled', () => {
  assert.equal(red('SSN: 123-45-6789', { identity: false }), 'SSN: 123-45-6789');
});

test('false positives: everyday numbers', () => {
  for (const t of [
    'Order #112-3456789-1234567', 'Total: $1,234.56', 'Call 1-800-555-0199 today',
    'Version 2.3.4', 'ISBN 978-0-306-40615-7', 'Flight UA 1234 departs 10:45',
    'Tracking 1Z999AA10123456784', '2026-09-29T10:00:00Z',
  ]) assert.equal(red(t), t, t);
});

test('keyword rules', () => {
  const extra = D.keywordRules(['Project Falcon']);
  assert.equal(D.redactText('Update on project falcon budget', {}, extra).text, 'Update on [PROTECTED] budget');
});

test('field classification', () => {
  const c = (m) => (D.classifyField(m) || {}).pack || null;
  assert.equal(c({ type: 'password' }), 'credentials');
  assert.equal(c({ type: 'text', autocomplete: 'cc-number' }), 'payments');
  assert.equal(c({ type: 'text', autocomplete: 'section-billing cc-csc' }), 'payments');
  assert.equal(c({ type: 'text', autocomplete: 'bday' }), 'identity');
  assert.equal(c({ type: 'text', labelText: 'Social Security Number' }), 'identity');
  assert.equal(c({ type: 'text', labelText: 'What are your salary expectations?' }), 'job');
  assert.equal(c({ type: 'radio', labelText: 'Are you Hispanic or Latino?' }), 'job');
  assert.equal(c({ type: 'select-one', labelText: 'Veteran Status' }), 'job');
  assert.equal(c({ type: 'checkbox', labelText: 'I certify that the information provided is true' }), 'job');
  assert.equal(c({ type: 'text', name: 'desiredSalary' }), 'job');
  assert.equal(c({ type: 'text', labelText: 'Card number' }), 'payments');
  // Should NOT lock
  assert.equal(c({ type: 'text', labelText: 'First name' }), null);
  assert.equal(c({ type: 'email', labelText: 'Email address' }), null);
  assert.equal(c({ type: 'text', labelText: 'Previous employer' }), null);
  assert.equal(c({ type: 'textarea', labelText: 'Why do you want to work here?' }), null);
  assert.equal(c({ type: 'hidden', name: 'ssn' }), null);
});

test('url patterns', () => {
  assert.equal(D.urlMatches('https://www.amazon.com/cpe/yourpayments/*', 'https://www.amazon.com/cpe/yourpayments/wallet?ref=x'), true);
  assert.equal(D.urlMatches('https://www.amazon.com/cpe/yourpayments/*', 'https://www.amazon.com/gp/cart'), false);
  assert.equal(D.urlMatches('*://*.mybank.com/statements*', 'https://secure.mybank.com/statements/2026'), true);
});

test('field classification: real ATS labels (Greenhouse, Lever, 2026-09-29)', () => {
  const c = (m) => (D.classifyField(m) || {}).pack || null;
  // Greenhouse EEO comboboxes
  assert.equal(c({ type: 'text', id: 'gender', labelText: 'Gender' }), 'job');
  assert.equal(c({ type: 'text', id: 'hispanic_ethnicity', labelText: 'Are you Hispanic/Latino?' }), 'job');
  assert.equal(c({ type: 'text', id: 'veteran_status', labelText: 'Veteran Status' }), 'job');
  assert.equal(c({ type: 'text', id: 'question_1', labelText: 'Agreement to Arbitrate*' }), 'job');
  // Lever demographic survey radios (question text from the enclosing li.application-question)
  assert.equal(c({ type: 'radio', labelText: 'Woman | What best describes your gender?WomanManNon-binary' }), 'job');
  assert.equal(c({ type: 'radio', labelText: 'Asian | What is your race/ethnicity?:American Indian or Alaska Native' }), 'job');
  // Ordinary Greenhouse / Lever questions stay unlocked
  for (const l of ['First Name*', 'Email*', 'Phone', 'LinkedIn Profile', 'Why Anthropic?*', 'Are you open to relocation for this role? *',
                   'Current company', 'Preferred Name | What would you like us to call you?', 'Have you ever interviewed at Anthropic before?*'])
    assert.equal(c({ type: 'text', labelText: l }), null, l);
});

test('context matching: value and label in separate elements (Gmail/Nextdoor, 2026-09-30)', () => {
  const m = (v, ctx, packs) => (D.contextMatch(v, ctx, packs) || {}).token || null;
  assert.equal(m('826774', 'Or enter this code to finish logging in to your account - it will expire in 30 minutes:'), '[2FA CODE]');
  assert.equal(m('482 913', 'Your verification code'), '[2FA CODE]');
  assert.equal(m('123-45-6789', 'Social Security Number:'), '[SSN]');
  assert.equal(m('021000021', 'Routing number'), '[ROUTING #]');
  assert.equal(m('000123456789', 'Account number:'), '[ACCOUNT #]');
  // Should NOT match
  assert.equal(m('2026', 'Copyright'), null);
  assert.equal(m('94102', 'San Francisco, CA'), null);
  assert.equal(m('826774', 'Order total'), null);
  assert.equal(m('123456789', 'Routing number'), null, 'fails ABA');
  assert.equal(m('826774', 'Or enter this code:', { credentials: false }), null, 'pack off');
});

test('context matching ignores our own placeholders', () => {
  assert.equal(D.contextMatch('94102', 'Your login code is [2FA CODE] 420 Taylor Street, San Francisco, CA'), null);
});
