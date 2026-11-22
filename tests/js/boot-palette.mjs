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
const window = { LumenAppearance: { area: 'client', mode: { default: 'dark', allowToggle: true } }, addEventListener() {}, location: { search: '' } };
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
for (const [input, prop, expected] of [['#fff', 'background-color', 'var(--lp-white-bg)'], ['#fff', 'color', 'var(--lp-white)']]) {
    const got = convertValue(input, prop);
    if (got !== expected) {
        console.log(`${prop}: ${input} got ${got}`);
        failed++;
    }
}
for (const [prop, input, expected] of [
    ['border-radius', '0.25rem', 'var(--radius-md)'],
    ['border-top-left-radius', '.5rem', 'var(--radius-lg)'],
    ['border-radius', '9999px', '9999px'],
    ['padding-left', '1rem', 'calc(4 * var(--spacing))'],
    ['gap', '0.5rem 1.5rem', 'calc(2 * var(--spacing)) calc(6 * var(--spacing))'],
    ['font-size', '0.875rem', 'calc(0.875rem * var(--lumen-font-scale))'],
    ['font-family', '"IBM Plex Sans", Roboto, system-ui, sans-serif', 'var(--lumen-font-display)'],
    ['box-shadow', '0 1px 3px 0 rgba(0, 0, 0, 0.1)', '0 1px 3px 0 rgb(var(--lumen-shadow-rgb) / calc(0.1 * var(--lumen-shadow-alpha) * 6.67))'],
    ['margin-left', '1rem', '1rem'],
]) {
    const got = convertValue(input, prop);
    if (got !== expected) {
        console.log(`${prop}: ${input}\n  got      ${got}\n  expected ${expected}`);
        failed++;
    }
}
const hover = convertRuleText('.b:hover{background-color:#ffffff}');
if (hover !== '.b:hover{background-color:var(--lp-white-bg)}') {
    console.log(`hover rule got ${hover}`);
    failed++;
}
const rule = '.a-sc-1{--tw-bg-opacity:1;background-color:hsla(209,20%,25%,var(--tw-bg-opacity));color:#fff;}';
const out = convertRuleText(rule);
if (!out.includes('var(--lp-grey-800)') || !out.includes('color:var(--lp-white)') || !out.startsWith('.a-sc-1{')) {
    console.log(`rule\n  got ${out}`);
    failed++;
}
console.log(failed ? `${failed} failed` : 'ok');
process.exit(failed ? 1 : 0);
