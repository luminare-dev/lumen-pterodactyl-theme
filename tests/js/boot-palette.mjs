// Runs extension/public/boot.js against a minimal DOM stub and checks the palette mapping.
// Prints "ok" or the failing cases; exit code 1 on failure.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../../extension/public/boot.js'), 'utf8');
const el = () => ({ setAttribute() {}, getAttribute() { return null; }, removeAttribute() {}, style: {}, classList: { add() {} } });
const document = {
    documentElement: el(),
    head: { appendChild() {} },
    body: null,
    styleSheets: [],
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener() {},
    createElement: () => el(),
};
class MutationObserver { observe() {} }
const window = { LumenAppearance: { area: 'client', mode: { default: 'dark', allowToggle: true } }, addEventListener() {} };
window.CSSStyleSheet = function () {};
window.CSSStyleSheet.prototype.insertRule = function () { return 0; };
vm.runInNewContext(source, { window, document, MutationObserver, WeakSet, Math, parseInt, parseFloat, isNaN, String, Object, JSON });
const { convertValue, convertRuleText } = window.Lumen;

const cases = [
    ['hsla(209, 18%, 30%, var(--tw-bg-opacity))', 'color-mix(in srgb, var(--lp-grey-700) calc(var(--tw-bg-opacity) * 100%), transparent)'],
    ['rgb(51 64 77/var(--tw-bg-opacity))', 'color-mix(in srgb, var(--lp-grey-800) calc(var(--tw-bg-opacity) * 100%), transparent)'],
    ['hsl(209deg 18% 30%)', 'var(--lp-grey-700)'],
    ['rgba(59, 130, 246, 1)', 'var(--lp-accent-500)'],
    ['#fff', 'var(--lp-white)'],
    ['#131a20', 'var(--lp-black)'],
    ['rgba(239, 68, 68, 0.5)', 'color-mix(in srgb, var(--lp-danger-500) 50%, transparent)'],
    ['0 0 0 1px #10b981', '0 0 0 1px var(--lp-success-500)'],
    ['rgba(0, 0, 0, 0.45)', 'rgba(0, 0, 0, 0.45)'],
    ['url(#abc)', 'url(#abc)'],
    ['#123456', '#123456'],
];
let failed = 0;
for (const [input, expected] of cases) {
    const got = convertValue(input);
    if (got !== expected) {
        console.log(`value ${input}\n  got      ${got}\n  expected ${expected}`);
        failed++;
    }
}
const rule = '.a-sc-1{--tw-bg-opacity:1;background-color:hsla(209,20%,25%,var(--tw-bg-opacity));color:#fff;}';
const out = convertRuleText(rule);
if (!out.includes('var(--lp-grey-800)') || !out.includes('color:var(--lp-white)') || !out.startsWith('.a-sc-1{')) {
    console.log(`rule\n  got ${out}`);
    failed++;
}
console.log(failed ? `${failed} failed` : 'ok');
process.exit(failed ? 1 : 0);
