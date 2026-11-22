// Admin → Extensions → Lumen: the customizer.
//
// Edits the token set (docs/tokens.md) with a live preview: the admin page itself, a dark and a
// light sample of the client area, and an optional client-area tab that follows the draft. Saves
// to the server (PATCH /admin/extensions/lumen), which applies it as CSS variables on the next
// page load without a rebuild. js/core.js and js/target.js are built from src/*.ts in CI and are
// the same compiler the server runs (tests/parity).

import { COLOR_KEYS, contrastReport, ENUMS, layoutAttributes, normalize, RANGES } from './js/core.js';
import { brandingForClient, compilePterodactyl, resolveUrl } from './js/target.js';

const stateNode = document.getElementById('lumen-editor-state');
const mount = document.getElementById('lumen-editor');
const initial = JSON.parse(stateNode.textContent);

const COLOR_LABELS = {
    canvas: ['Page background', 'Behind everything'],
    surfaceSunken: ['Sunken surface', 'Navigation bars, inputs, wells'],
    surface: ['Surface', 'Cards, boxes and rows'],
    surfaceRaised: ['Raised surface', 'Hover, active items, raised controls'],
    border: ['Border', 'Card, table and input borders'],
    text: ['Text', 'Body text and headings'],
    textMuted: ['Muted text', 'Hints, labels, secondary text'],
    accent: ['Accent', 'Buttons and highlights'],
    accentSecondary: ['Accent gradient end', 'Second colour of the accent gradient'],
    accentText: ['Accent text', 'Links and accent text on surfaces'],
    accentContrast: ['Text on accent', 'Button labels'],
    success: ['Success', 'Running, saved, online'],
    warning: ['Warning', 'Starting, attention'],
    danger: ['Danger', 'Errors, delete, offline'],
    info: ['Info', 'Notes and info boxes'],
    focus: ['Focus ring', 'Keyboard focus outline'],
};

const ASSET_LABELS = {
    logoDark: ['Logo, dark mode', 'Square or wide; SVG or PNG'],
    logoLight: ['Logo, light mode', 'Falls back to the dark-mode logo'],
    favicon: ['Favicon', 'SVG, PNG or ICO'],
    loginBackground: ['Login background', 'Large image; empty for the Lumen gradient'],
};

const PRESET_ORDER = ['luminare', 'graphite', 'aurora', 'contrast'];
const PREVIEW_KEY = 'lumen:preview';

// ------------------------------------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------------------------------------

function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
        if (value === undefined || value === null || value === false) continue;
        if (key === 'class') el.className = value;
        else if (key === 'text') el.textContent = value;
        else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
        else if (key === 'value') el.value = value;
        else if (key === 'checked') el.checked = value;
        else el.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
        if (child === null || child === undefined || child === false) continue;
        el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return el;
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lumen';

function csrf() {
    const meta = document.querySelector('meta[name="_token"], meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}

async function request(method, path, body) {
    const headers = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrf() };
    let payload = body;
    if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
    }
    const response = await fetch(initial.endpoint + path, { method, headers, body: payload, credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const errors = data.errors ? Object.values(data.errors).flat().join(', ') : response.statusText;
        throw new Error(errors || `HTTP ${response.status}`);
    }
    return data;
}

function download(name, content) {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = h('a', { href: url, download: name });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toast(message, kind = 'info') {
    const node = h('div', { class: `lumen-ed-toast lumen-ed-toast--${kind}`, role: 'status' }, message);
    document.body.appendChild(node);
    setTimeout(() => node.classList.add('is-leaving'), 3600);
    setTimeout(() => node.remove(), 4200);
}

// ------------------------------------------------------------------------------------------
// State
// ------------------------------------------------------------------------------------------

const app = {
    server: initial,
    saved: clone(initial.tokens),
    draft: clone(initial.tokens),
    colorMode: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
    live: true,
    busy: false,
};

const root = document.documentElement;
const original = {
    css: document.getElementById('lumen-tokens')?.textContent ?? '',
    attributes: Object.fromEntries(root.getAttributeNames().filter((n) => n.startsWith('data-lumen')).map((n) => [n, root.getAttribute(n)])),
};

function dirty() {
    return JSON.stringify(app.draft) !== JSON.stringify(app.saved);
}

function setDraft(next, { rerender = false } = {}) {
    app.draft = next;
    update(rerender);
}

function edit(path, value) {
    const next = clone(app.draft);
    let target = next;
    for (let i = 0; i < path.length - 1; i++) target = target[path[i]];
    target[path[path.length - 1]] = value;
    setDraft(next);
}

// ------------------------------------------------------------------------------------------
// Live preview
// ------------------------------------------------------------------------------------------

function applyLive() {
    const style = document.getElementById('lumen-tokens');
    if (!style) return;
    if (app.live) {
        style.textContent = compilePterodactyl(app.draft);
        for (const [name, value] of Object.entries(layoutAttributes(app.draft))) root.setAttribute(name, value);
        window.Lumen?.previewTheme(app.colorMode);
    } else {
        style.textContent = original.css;
        for (const [name, value] of Object.entries(original.attributes)) root.setAttribute(name, value);
        window.Lumen?.restoreTheme();
    }
}

function publishPreview() {
    try {
        localStorage.setItem(
            PREVIEW_KEY,
            JSON.stringify({
                at: Date.now(),
                css: compilePterodactyl(app.draft),
                attributes: layoutAttributes(app.draft),
                branding: brandingForClient(app.draft),
                mode: app.colorMode,
            }),
        );
    } catch {
        /* storage full or blocked: the samples still show the draft */
    }
}

function renderSamples() {
    const css = compilePterodactyl(app.draft, { scope: '.lumen-preview', withCustomCss: false });
    let style = document.getElementById('lumen-preview-tokens');
    if (!style) {
        style = h('style', { id: 'lumen-preview-tokens', 'data-lumen-own': '' });
        document.head.appendChild(style);
    }
    style.textContent = css;
    for (const sample of mount.querySelectorAll('.lumen-preview')) {
        for (const [name, value] of Object.entries(layoutAttributes(app.draft))) sample.setAttribute(name, value);
    }
    const branding = brandingForClient(app.draft);
    for (const img of mount.querySelectorAll('[data-sample-logo]')) {
        const mode = img.closest('.lumen-preview').getAttribute('data-theme');
        const src = mode === 'light' ? branding.logoLight : branding.logoDark;
        img.hidden = !src;
        if (src) img.src = src;
    }
    for (const name of mount.querySelectorAll('[data-sample-name]')) {
        name.textContent = app.draft.branding.productName || initial.appName;
    }
}

// ------------------------------------------------------------------------------------------
// Controls
// ------------------------------------------------------------------------------------------

function section(title, hint, ...children) {
    return h('section', { class: 'lumen-ed-card' }, h('header', {}, h('h3', { text: title }), hint ? h('p', { text: hint }) : null), ...children);
}

function row(label, hint, control) {
    return h('div', { class: 'lumen-ed-row' }, h('div', { class: 'lumen-ed-row-label' }, h('span', { text: label }), hint ? h('small', { text: hint }) : null), h('div', { class: 'lumen-ed-row-control' }, control));
}

function segmented(path, options, labels = {}) {
    const name = path.join('.');
    const current = () => path.reduce((o, k) => o[k], app.draft);
    const wrap = h('div', { class: 'lumen-ed-segmented', role: 'radiogroup', 'aria-label': name });
    for (const option of options) {
        const button = h('button', {
            type: 'button',
            role: 'radio',
            'data-value': option,
            onclick: () => edit(path, option),
            text: labels[option] || option[0].toUpperCase() + option.slice(1),
        });
        wrap.appendChild(button);
    }
    wrap.sync = () => {
        for (const button of wrap.children) button.setAttribute('aria-checked', String(button.dataset.value === current()));
    };
    syncers.push(wrap.sync);
    return wrap;
}

function toggle(path, label) {
    const input = h('input', { type: 'checkbox', role: 'switch', 'aria-label': label, onchange: (e) => edit(path, e.target.checked) });
    syncers.push(() => {
        input.checked = path.reduce((o, k) => o[k], app.draft);
    });
    return h('label', { class: 'lumen-ed-switch' }, input, h('span', { 'aria-hidden': 'true' }));
}

function slider(path, range, step, unit = '', format = (v) => v) {
    const out = h('output', {});
    const input = h('input', {
        type: 'range',
        min: range[0],
        max: range[1],
        step,
        oninput: (e) => edit(path, Number(e.target.value)),
    });
    syncers.push(() => {
        const value = path.reduce((o, k) => o[k], app.draft);
        input.value = value;
        out.textContent = `${format(value)}${unit}`;
    });
    return h('div', { class: 'lumen-ed-slider' }, input, out);
}

function text(path, { placeholder = '', maxlength = 200, multiline = false } = {}) {
    const input = multiline
        ? h('textarea', { rows: 10, spellcheck: 'false', placeholder, maxlength })
        : h('input', { type: 'text', placeholder, maxlength, spellcheck: 'false' });
    input.addEventListener('input', () => edit(path, input.value));
    syncers.push(() => {
        const value = path.reduce((o, k) => o[k], app.draft);
        if (document.activeElement !== input) input.value = value;
    });
    return input;
}

function colorField(key) {
    const [label, hint] = COLOR_LABELS[key];
    const picker = h('input', { type: 'color', 'aria-label': `${label} colour picker` });
    const hex = h('input', { type: 'text', class: 'lumen-ed-hex', maxlength: 7, spellcheck: 'false', 'aria-label': `${label} hex value` });
    const warn = h('span', { class: 'lumen-ed-warn', hidden: true });
    picker.addEventListener('input', () => edit(['color', app.colorMode, key], picker.value.toUpperCase()));
    hex.addEventListener('input', () => {
        const value = hex.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(value)) edit(['color', app.colorMode, key], value.toUpperCase());
    });
    syncers.push(() => {
        const value = app.draft.color[app.colorMode][key];
        picker.value = value.toLowerCase();
        if (document.activeElement !== hex) hex.value = value;
        const failing = contrastReport(app.draft).filter((r) => r.mode === app.colorMode && !r.ok && (r.fg === key || r.bg === key));
        warn.hidden = failing.length === 0;
        warn.textContent = failing.length ? `${failing.length} low contrast` : '';
        warn.title = failing.map((r) => `${r.label}: ${r.ratio.toFixed(2)} (needs ${r.min})`).join('\n');
    });
    return h('div', { class: 'lumen-ed-color' }, h('div', { class: 'lumen-ed-color-label' }, h('span', { text: label }), h('small', { text: hint })), h('div', { class: 'lumen-ed-color-inputs' }, picker, hex, warn));
}

function assetField(key) {
    const [label, hint] = ASSET_LABELS[key];
    const thumb = h('div', { class: 'lumen-ed-asset-thumb' });
    const urlInput = h('input', { type: 'text', placeholder: 'https://… or upload', spellcheck: 'false', 'aria-label': `${label} URL` });
    const file = h('input', { type: 'file', accept: initial.upload.extensions.map((e) => `.${e}`).join(','), hidden: true });
    urlInput.addEventListener('change', () => edit(['branding', key], urlInput.value.trim()));
    file.addEventListener('change', async () => {
        const chosen = file.files?.[0];
        file.value = '';
        if (!chosen) return;
        if (chosen.size > initial.upload.maxKb * 1024) {
            toast(`${chosen.name} is larger than ${initial.upload.maxKb / 1024} MB.`, 'error');
            return;
        }
        const form = new FormData();
        form.append('slot', key);
        form.append('file', chosen);
        try {
            const { url } = await request('POST', '', form);
            edit(['branding', key], url);
            toast(`${label} uploaded. Save to apply it.`, 'success');
        } catch (error) {
            toast(`Upload failed: ${error.message}`, 'error');
        }
    });
    syncers.push(() => {
        const value = app.draft.branding[key];
        if (document.activeElement !== urlInput) urlInput.value = value;
        thumb.replaceChildren(value ? h('img', { src: resolveUrl(value), alt: '' }) : h('span', { text: 'None' }));
    });
    return h(
        'div',
        { class: 'lumen-ed-asset' },
        thumb,
        h('div', { class: 'lumen-ed-asset-body' }, h('span', { class: 'lumen-ed-asset-label', text: label }), h('small', { text: hint }), urlInput),
        h('div', { class: 'lumen-ed-asset-actions' }, h('button', { type: 'button', class: 'btn btn-sm btn-default', onclick: () => file.click(), text: 'Upload' }), h('button', { type: 'button', class: 'btn btn-sm btn-link', onclick: () => edit(['branding', key], ''), text: 'Clear' }), file),
    );
}

// ------------------------------------------------------------------------------------------
// Sample of the client area (scoped tokens, drawn with editor.css)
// ------------------------------------------------------------------------------------------

function sample(mode) {
    const server = (name, meta, status, label) =>
        h('div', { class: 'lp-row' }, h('span', { class: `lp-dot lp-dot--${status}` }), h('div', { class: 'lp-row-main' }, h('strong', { text: name }), h('small', { text: meta })), h('span', { class: `lp-badge lp-badge--${status}`, text: label }));
    return h(
        'div',
        { class: 'lumen-preview', 'data-theme': mode },
        h('div', { class: 'lp-canvas' },
            h('div', { class: 'lp-nav' },
                h('span', { class: 'lp-brand' }, h('img', { 'data-sample-logo': '', alt: '' }), h('span', { 'data-sample-name': '' })),
                h('span', { class: 'lp-nav-links' }, h('span', { class: 'lp-nav-link is-active', text: 'Servers' }), h('span', { class: 'lp-nav-link', text: 'Account' })),
            ),
            h('div', { class: 'lp-body' },
                h('div', { class: 'lp-rail' }, h('span', { class: 'lp-rail-item is-active', text: 'Console' }), h('span', { class: 'lp-rail-item', text: 'Files' }), h('span', { class: 'lp-rail-item', text: 'Backups' })),
                h('div', { class: 'lp-main' },
                    h('div', { class: 'lp-label', text: mode === 'dark' ? 'Dark' : 'Light' }),
                    server('Survival world', 'Paper · 4 GB · eu-central', 'success', 'Running'),
                    server('Modded SMP', 'Fabric · 8 GB · eu-central', 'warning', 'Starting'),
                    server('Lobby', 'Velocity · 1 GB · us-east', 'danger', 'Offline'),
                    h('div', { class: 'lp-console' }, h('code', { text: '[12:00:01] Done (2.4s)! For help, type "help"' }), h('code', { class: 'lp-console-muted', text: 'container@pterodactyl~ ' })),
                    h('div', { class: 'lp-actions' }, h('span', { class: 'lp-input', text: 'server.example.com' }), h('span', { class: 'lp-btn lp-btn--primary', text: 'Start' }), h('span', { class: 'lp-btn', text: 'Restart' }), h('span', { class: 'lp-btn lp-btn--danger', text: 'Stop' }), h('span', { class: 'lp-link', text: 'Open files' })),
                ),
            ),
        ),
    );
}

// ------------------------------------------------------------------------------------------
// Layout
// ------------------------------------------------------------------------------------------

let syncers = [];
const saveBar = { status: null, discard: null, save: null };
let contrastList = null;
let modeTabs = null;

function presetCards() {
    const presets = initial.presets;
    const names = [...PRESET_ORDER.filter((n) => presets[n]), ...Object.keys(presets).filter((n) => !PRESET_ORDER.includes(n))];
    return h(
        'div',
        { class: 'lumen-ed-presets' },
        names.map((name) => {
            const p = presets[name];
            const swatch = (mode) => h('span', { class: 'lumen-ed-swatch', style: `background:${p.color[mode].canvas}` }, h('i', { style: `background:${p.color[mode].surface}` }), h('i', { style: `background:${p.color[mode].accent}` }), h('i', { style: `background:${p.color[mode].text}` }));
            const card = h(
                'button',
                {
                    type: 'button',
                    class: 'lumen-ed-preset',
                    onclick: () => {
                        const next = clone(p);
                        setDraft(next);
                        toast(`${p.meta.name} loaded. Save to apply it.`);
                    },
                },
                h('span', { class: 'lumen-ed-swatches' }, swatch('dark'), swatch('light')),
                h('strong', { text: p.meta.name }),
                h('small', { text: p.meta.description }),
            );
            syncers.push(() => card.setAttribute('aria-pressed', String(JSON.stringify(p.color) === JSON.stringify(app.draft.color))));
            return card;
        }),
    );
}

function importJson() {
    const input = h('input', { type: 'file', accept: '.json,application/json' });
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
            const parsed = JSON.parse(await file.text());
            const { tokens, errors } = normalize(parsed, initial.defaults);
            setDraft(tokens);
            if (errors.length) toast(`Imported with ${errors.length} value(s) replaced by defaults: ${errors.join(', ')}`, 'warning');
            else toast(`Imported ${tokens.meta.name}. Save to apply it.`, 'success');
        } catch (error) {
            toast(`Not a token file: ${error.message}`, 'error');
        }
    });
    input.click();
}

function build() {
    syncers = [];
    const colorGrid = h('div', { class: 'lumen-ed-colors' }, COLOR_KEYS.map((key) => colorField(key)));
    modeTabs = h(
        'div',
        { class: 'lumen-ed-segmented lumen-ed-mode-tabs', role: 'tablist' },
        ['dark', 'light'].map((mode) =>
            h('button', {
                type: 'button',
                role: 'tab',
                'data-value': mode,
                onclick: () => {
                    app.colorMode = mode;
                    update();
                },
                text: mode === 'dark' ? 'Dark mode colours' : 'Light mode colours',
            }),
        ),
    );
    syncers.push(() => {
        for (const b of modeTabs.children) b.setAttribute('aria-selected', String(b.dataset.value === app.colorMode));
    });
    contrastList = h('ul', { class: 'lumen-ed-contrast' });

    const editor = h(
        'div',
        { class: 'lumen-ed-form' },
        section(
            'Presets',
            'Start from a preset, or import a token file. Token files from the Lumen theme for Hydrodactyl work here too. Nothing is saved until you press Save.',
            presetCards(),
            h('div', { class: 'lumen-ed-buttons' },
                h('button', { type: 'button', class: 'btn btn-default', onclick: importJson, text: 'Import JSON' }),
                h('button', { type: 'button', class: 'btn btn-default', onclick: () => download(`${slug(app.draft.meta.name)}.lumen.json`, `${JSON.stringify(app.draft, null, 4)}\n`), text: 'Export JSON' }),
                h('button', { type: 'button', class: 'btn btn-default', onclick: () => setDraft(clone(initial.defaults)), text: 'Load default' }),
                h('button', {
                    type: 'button',
                    class: 'btn btn-link lumen-ed-danger',
                    onclick: async () => {
                        if (!window.confirm('Delete the saved appearance and go back to the Luminare preset?')) return;
                        try {
                            const state = await request('DELETE', '/appearance/active');
                            app.saved = clone(state.tokens);
                            original.css = compilePterodactyl(state.tokens);
                            setDraft(clone(state.tokens));
                            toast('Appearance reset to the default.', 'success');
                        } catch (error) {
                            toast(`Reset failed: ${error.message}`, 'error');
                        }
                    },
                    text: 'Reset saved appearance',
                }),
            ),
            row('Preset name', 'Shown in exports', text(['meta', 'name'], { maxlength: 200 })),
            row('Description', 'Shown in exports', text(['meta', 'description'], { maxlength: 200 })),
        ),
        section(
            'Mode',
            'What people see first, and whether they may switch.',
            row('Default mode', 'System follows the device setting', segmented(['mode', 'default'], ENUMS.defaultMode)),
            row('Allow users to switch', 'Shows the toggle in the client and admin area; each choice is saved per account', toggle(['mode', 'allowToggle'], 'Allow users to switch')),
        ),
        section('Colours', 'Each mode has its own colours. Contrast is checked against WCAG 2.2 AA; failing pairs are listed under the preview.', modeTabs, colorGrid),
        section(
            'Typography',
            'Sora ships with the theme. Other fonts must be installed on the device or loaded with a font stylesheet.',
            row('Headings font', 'Comma-separated font list', text(['typography', 'display'])),
            row('Body font', '', text(['typography', 'body'])),
            row('Code font', 'Also the console input', text(['typography', 'mono'])),
            row('Font stylesheet', 'Optional https URL, for example a font service', text(['typography', 'stylesheet'], { placeholder: 'https://', maxlength: 2048 })),
            row('Text size', '', slider(['typography', 'scale'], RANGES.scale, 0.01, '%', (v) => Math.round(v * 100))),
            row('Heading weight', '', slider(['typography', 'headingWeight'], RANGES.headingWeight, 50)),
        ),
        section(
            'Shape and spacing',
            '',
            row('Corner radius', 'Cards use the full radius, buttons and inputs a fraction', slider(['radius', 'base'], RANGES.radius, 1, ' px')),
            row('Spacing unit', 'Scales every padding and gap', slider(['spacing', 'base'], RANGES.spacing, 0.5, ' px')),
            row('Density', '', segmented(['density'], ENUMS.density)),
            row('Shadows', '', segmented(['elevation', 'shadow'], ENUMS.shadow)),
            row('Borders on cards', '', toggle(['elevation', 'borders'], 'Borders on cards')),
        ),
        section(
            'Layout',
            'The admin sidebar, the server navigation (a side rail on wide screens) and the top bar.',
            row('Sidebar', 'Floating draws the sidebar and top bar as cards', segmented(['layout', 'sidebar'], ENUMS.sidebar)),
            row('Sidebar width', '', slider(['layout', 'sidebarWidth'], RANGES.sidebarWidth, 4, ' px')),
            row('Active item', '', segmented(['layout', 'indicator'], ENUMS.indicator)),
            row('Content width', '', segmented(['layout', 'contentWidth'], ENUMS.contentWidth)),
            row('Background glow', 'Soft accent light behind the page', toggle(['layout', 'backgroundGlow'], 'Background glow')),
        ),
        section(
            'Branding',
            'Replace the Luminare logos with your own, or clear a slot to keep the panel’s own. SVG files with scripts, event handlers or external references are refused.',
            row('Product name', 'Shown on the login page; empty uses the panel name', text(['branding', 'productName'], { maxlength: 60, placeholder: initial.appName })),
            h('div', { class: 'lumen-ed-assets' }, ['logoDark', 'logoLight', 'favicon', 'loginBackground'].map(assetField)),
        ),
        section('Custom CSS', 'Added after the tokens on every page. Use the --lumen-* variables so it follows both modes (docs/customize.md).', text(['customCss'], { multiline: true, maxlength: 20000, placeholder: ':root[data-lumen] .my-banner { color: var(--lumen-accent-text); }' })),
    );

    const liveToggle = h('input', {
        type: 'checkbox',
        role: 'switch',
        checked: app.live,
        'aria-label': 'Apply to this page while editing',
        onchange: (e) => {
            app.live = e.target.checked;
            applyLive();
        },
    });
    const preview = h(
        'aside',
        { class: 'lumen-ed-preview' },
        h('div', { class: 'lumen-ed-preview-head' },
            h('h3', { text: 'Preview' }),
            h('label', { class: 'lumen-ed-inline' }, h('span', { text: 'Apply to this page' }), h('span', { class: 'lumen-ed-switch' }, liveToggle, h('span', { 'aria-hidden': 'true' }))),
        ),
        sample('dark'),
        sample('light'),
        h('button', {
            type: 'button',
            class: 'btn btn-default btn-block',
            onclick: () => {
                publishPreview();
                window.open('/?lumenPreview=1', 'lumen-preview');
            },
            text: 'Open the client area with this draft',
        }),
        h('p', { class: 'lumen-ed-note', text: 'The tab follows your edits until you close it; only your browser sees the draft.' }),
        h('h4', { text: 'Contrast' }),
        contrastList,
    );

    saveBar.status = h('span', { class: 'lumen-ed-status' });
    saveBar.discard = h('button', { type: 'button', class: 'btn btn-default', onclick: () => setDraft(clone(app.saved)), text: 'Discard' });
    saveBar.save = h('button', { type: 'button', class: 'btn btn-primary', onclick: save, text: 'Save' });
    const bar = h('div', { class: 'lumen-ed-savebar' }, saveBar.status, h('span', { class: 'lumen-ed-spacer' }), saveBar.discard, saveBar.save);

    mount.replaceChildren(h('div', { class: 'lumen-ed-grid' }, editor, preview), bar);
    mount.removeAttribute('aria-busy');
}

async function save() {
    if (app.busy) return;
    app.busy = true;
    update();
    try {
        const state = await request('PATCH', '', { tokens: app.draft });
        app.saved = clone(state.tokens);
        app.draft = clone(state.tokens);
        app.server = state;
        original.css = compilePterodactyl(state.tokens);
        original.attributes = layoutAttributes(state.tokens);
        toast('Appearance saved. Every page uses it from the next load.', 'success');
    } catch (error) {
        toast(`Not saved: ${error.message}`, 'error');
    } finally {
        app.busy = false;
        update();
    }
}

function update() {
    for (const sync of syncers) sync();
    renderSamples();
    applyLive();
    publishPreview();

    const report = contrastReport(app.draft).filter((r) => !r.ok);
    contrastList.replaceChildren(
        ...(report.length
            ? report.map((r) => h('li', {}, h('span', { class: 'lumen-ed-pill', text: r.mode }), ` ${r.label}: ${r.ratio.toFixed(2)} (needs ${r.min})`))
            : [h('li', { class: 'is-ok', text: 'All colour pairs pass WCAG AA in both modes.' })]),
    );

    const isDirty = dirty();
    saveBar.status.textContent = app.busy ? 'Saving…' : isDirty ? 'Unsaved changes' : app.server.saved ? `Saved${app.server.updatedAt ? ` · ${app.server.updatedAt}` : ''}` : 'Using the default appearance';
    saveBar.save.disabled = !isDirty || app.busy;
    saveBar.discard.disabled = !isDirty || app.busy;
    mount.classList.toggle('is-dirty', isDirty);
}

window.addEventListener('beforeunload', (event) => {
    if (dirty()) {
        event.preventDefault();
        event.returnValue = '';
    }
});

build();
update();
