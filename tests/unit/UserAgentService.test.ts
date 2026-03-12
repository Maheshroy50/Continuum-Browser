
import { UserAgentService } from '../../electron/UserAgentService';
import assert from 'assert';

console.log('Running UserAgentService Tests...');

const service = new UserAgentService();

// Test 1: Platform detection (Basic check)
console.log('Test 1: UA Generation');
const firefoxUA = service.getFirefoxUA();
const chromeUA = service.getChromeUA();

assert.ok(firefoxUA.includes('Firefox'), 'Firefox UA should contain Firefox');
assert.ok(chromeUA.includes('Chrome'), 'Chrome UA should contain Chrome');
console.log('✅ UA Generation passed');

// Test 2: Google Auth URL Detection
console.log('Test 2: Google Auth Detection');
const authUrls = [
    'https://accounts.google.com/signin',
    'https://accounts.youtube.com/login',
    'https://signin.google.com'
];
const nonAuthUrls = [
    'https://google.com',
    'https://youtube.com',
    'https://example.com'
];

authUrls.forEach(url => {
    assert.strictEqual(service.isGoogleAuthUrl(url), true, `Should detect ${url} as auth`);
});
nonAuthUrls.forEach(url => {
    assert.strictEqual(service.isGoogleAuthUrl(url), false, `Should NOT detect ${url} as auth`);
});
console.log('✅ Google Auth Detection passed');

// Test 3: Stealth Script Selection
console.log('Test 3: Stealth Script Selection');
const authScript = service.getStealthScriptForUrl('https://accounts.google.com');
assert.ok(authScript.includes('Firefox'), 'Auth script should use Firefox persona');

const normalScript = service.getStealthScriptForUrl('https://example.com');
assert.ok(normalScript.includes('Chrome'), 'Normal script should use Chrome persona');
console.log('✅ Stealth Script Selection passed');

console.log('All UserAgentService tests passed!');
