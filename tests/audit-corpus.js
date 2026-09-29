// Coverage audit: realistic samples of sensitive data, run through the detector.
// Usage: node tests/audit-corpus.js   (prints CAUGHT / MISSED per sample)
const D = require('../extension/lib/detect.js');
const S = [
 ['Credentials','Temporary password','Your temporary password is: Xy7!qP2m'],
 ['Credentials','Password in text','Username: jdoe  Password: hunter2Blue!'],
 ['Credentials','GitHub token','ghp_16C7e42F292c6912E7710c838347Ae178B4a'],
 ['Credentials','OpenAI/Anthropic-style key','sk-proj-4f9aB2cD8eF1gH3iJ5kL7mN9pQ1rS3tU5'],
 ['Credentials','AWS access key','AKIAIOSFODNN7EXAMPLE'],
 ['Credentials','Stripe secret key','sk_live_51H8xYzAbCdEfGhIjKlMnOp'],
 ['Credentials','Google API key','AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY'],
 ['Credentials','Slack token','xoxb-123456789012-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx'],
 ['Credentials','JWT','eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'],
 ['Credentials','Private key block','-----BEGIN PRIVATE KEY-----'],
 ['Credentials','Magic login / reset link','https://example.com/reset-password?token=9f8e7d6c5b4a3210fedcba'],
 ['Credentials','Wi-Fi password','Wi-Fi password: SunnyDays2026'],
 ['Credentials','PIN','Your new PIN is 4821'],
 ['Financial','Card expiry','Exp: 04/28'],
 ['Financial','Account balance','Available balance: $12,345.67'],
 ['Financial','EIN','EIN: 12-3456789'],
 ['Financial','Gift card code + PIN','Gift card code: 6006-4912-3456-7890 PIN: 1234'],
 ['Financial','Crypto seed phrase','abandon ability able about above absent absorb abstract absurd abuse access accident'],
 ['Financial','Crypto wallet (ETH)','0x742d35Cc6634C0532925a3b844Bc454e4438f44e'],
 ['Identity','Medicare MBI','Medicare number: 1EG4-TE5-MK73'],
 ['Identity','Health insurance member ID','Member ID: XJH123456789'],
 ['Identity','Medical record number','MRN: 00482913'],
 ['Identity','UK National Insurance','NI number: QQ 12 34 56 C'],
 ['Identity','Canada SIN','SIN: 046 454 286'],
 ['Identity','VIN','VIN 1HGCM82633A004352'],
 ['Contact','Email address','jordan.rivera@example.com'],
 ['Other','Software license key','Product key: VK7JG-NPHTM-C97JM-9MPGT-3V66T'],
 ['Other','Security answer','Security answer: Maple Street'],
];
const P = { identity:true, payments:true, credentials:true, contact:true, job:true };
for (const [cat, name, t] of S) { const r = D.redactText(t, P); console.log((r.hits.length ? 'CAUGHT ' : 'MISSED ') + cat.padEnd(11) + name.padEnd(28) + ' -> ' + r.text); }
