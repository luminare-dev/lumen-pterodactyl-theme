// CI only: screenshots of Pterodactyl with the Lumen extension, client and admin, dark and light.
//   node ci/playwright/screenshots.mjs <base-url> <out-dir> <server-short-id>
// The theme's default mode is "system", so the browser's colour scheme picks the mode.
// node-1.example.com (the seeded node) resolves to the mock Wings daemon on this host.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [base = 'http://localhost:8080', out = 'screenshots', server = ''] = process.argv.slice(2);
const password = process.env.SEED_PASSWORD || 'lumen-ci-password';
mkdirSync(out, { recursive: true });

const s = server ? `/server/${server}` : '';
const pages = [
    ['client-dashboard', '/'],
    ['client-account', '/account'],
    ['client-account-api', '/account/api'],
    ...(server
        ? [
              ['client-console', s],
              ['client-files', `${s}/files`],
              ['client-databases', `${s}/databases`],
              ['client-schedules', `${s}/schedules`],
              ['client-users', `${s}/users`],
              ['client-backups', `${s}/backups`],
              ['client-network', `${s}/network`],
              ['client-startup', `${s}/startup`],
              ['client-settings', `${s}/settings`],
          ]
        : []),
    ['admin-overview', '/admin'],
    ['admin-settings', '/admin/settings'],
    ['admin-locations', '/admin/locations'],
    ['admin-nodes', '/admin/nodes'],
    ['admin-node', '/admin/nodes/view/1'],
    ['admin-servers', '/admin/servers'],
    ['admin-server', '/admin/servers/view/1'],
    ['admin-users', '/admin/users'],
    ['admin-user', '/admin/users/view/1'],
    ['admin-nests', '/admin/nests'],
    ['admin-extensions', '/admin/extensions'],
    ['admin-lumen', '/admin/extensions/lumen'],
];

const report = [];
const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP node-1.example.com 127.0.0.1'] });
for (const mode of ['dark', 'light']) {
    const context = await browser.newContext({ colorScheme: mode, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    const shot = async (name, { full = false } = {}) => {
        await page.waitForTimeout(1500);
        const file = join(out, `${name}-${mode}.png`);
        await page.screenshot({ path: file, fullPage: full });
        const state = await page.evaluate(() => {
            const css = getComputedStyle(document.documentElement);
            return {
                theme: document.documentElement.dataset.theme,
                lumen: document.documentElement.dataset.lumen ?? null,
                tokens: Boolean(document.getElementById('lumen-tokens')),
                canvas: css.getPropertyValue('--lumen-canvas').trim(),
                body: getComputedStyle(document.body).backgroundColor,
                toggle: Boolean(document.querySelector('.lumen-mode-toggle')),
            };
        });
        report.push({ name, mode, url: page.url(), ...state });
        console.log(`${file}  theme=${state.theme} lumen=${state.lumen} body=${state.body} toggle=${state.toggle}`);
    };

    await page.goto(`${base}/auth/login`, { waitUntil: 'networkidle' });
    await shot('login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', password);
    await Promise.all([
        page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 30000 }),
        page.press('input[name="password"]', 'Enter'),
    ]);

    for (const [name, path] of pages) {
        try {
            await page.goto(base + path, { waitUntil: 'networkidle', timeout: 30000 });
        } catch {
            // The console keeps its websocket open; take the shot anyway.
        }
        await shot(name, { full: name === 'admin-lumen' });
    }

    // The editor's draft preview in the client area (unsaved Aurora preset).
    try {
        await page.goto(`${base}/admin/extensions/lumen`, { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: /Aurora/ }).click();
        await page.waitForTimeout(500);
        await shot('admin-lumen-aurora-draft');
        const [tab] = await Promise.all([
            context.waitForEvent('page'),
            page.getByRole('button', { name: 'Open the client area with this draft' }).click(),
        ]);
        await tab.waitForLoadState('networkidle').catch(() => {});
        await tab.waitForTimeout(1500);
        await tab.screenshot({ path: join(out, `client-draft-preview-${mode}.png`) });
        await tab.close();
    } catch (e) {
        console.log(`draft preview failed: ${e}`);
    }

    if (errors.length) console.log(`page errors (${mode}):\n  ${errors.join('\n  ')}`);
    await context.close();
}

// The mode toggle stores the choice per account: switch to light in one browser context and the
// next context (another "browser") starts in light even though it prefers dark.
{
    const a = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1440, height: 900 } });
    const p = await a.newPage();
    await p.goto(`${base}/auth/login`, { waitUntil: 'networkidle' });
    await p.fill('input[name="username"]', 'admin');
    await p.fill('input[name="password"]', password);
    await Promise.all([p.waitForURL((u) => !u.pathname.startsWith('/auth')), p.press('input[name="password"]', 'Enter')]);
    await p.waitForSelector('.lumen-mode-toggle', { timeout: 15000 });
    // system -> light
    await p.click('#NavigationBar .lumen-mode-toggle');
    await p.waitForTimeout(800);
    const storage = await a.storageState();
    await a.close();
    const b = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1440, height: 900 }, storageState: { cookies: storage.cookies, origins: [] } });
    const q = await b.newPage();
    await q.goto(`${base}/`, { waitUntil: 'networkidle' });
    const theme = await q.evaluate(() => document.documentElement.dataset.theme);
    report.push({ name: 'mode-persisted', mode: 'dark-browser', theme });
    console.log(`mode saved per account: theme in a fresh browser = ${theme}`);
    await b.close();
}

await browser.close();
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
const missing = report.filter((r) => r.lumen !== undefined && (r.lumen !== '1' || !r.tokens));
const persisted = report.find((r) => r.name === 'mode-persisted');
let failed = false;
if (missing.length) {
    console.error(`Lumen head missing on: ${missing.map((r) => `${r.name}-${r.mode}`).join(', ')}`);
    failed = true;
}
if (!persisted || persisted.theme !== 'light') {
    console.error('The mode chosen with the toggle was not restored from the account.');
    failed = true;
}
process.exit(failed ? 1 : 0);
