/*
 * Lumen theme for Pterodactyl: runtime script, loaded by the Blueprint wrappers on every page
 * (client area, login and admin area) before the panel's own bundle.
 *
 * - picks the mode: the user's saved choice (server), else this browser's, else the default from
 *   the tokens; with the toggle switched off, always the default;
 * - sets data-theme and the layout attributes on <html>;
 * - client area: maps the panel's fixed palette (Tailwind greys, blue, cyan, red, green, yellow,
 *   white and black) onto Lumen colour roles. The panel's styled-components write literal
 *   colours, so every rule is rewritten once when it is inserted (CSSStyleSheet.insertRule) and
 *   the static stylesheets are rewritten in place. The result reads CSS variables, so the mode
 *   switch and the admin preview change colours without touching the rules again;
 * - adds the mode toggle, the logo slots and the favicon.
 * Exposes window.Lumen for the admin editor.
 */
(function () {
    'use strict';

    var cfg = window.LumenAppearance || {};
    var root = document.documentElement;
    var MODES = ['system', 'dark', 'light'];
    var STORE = 'lumen:mode';
    var modeCfg = cfg.mode || { default: 'system', allowToggle: true };

    /* ------------------------------------------------------------------------------------- */
    /* Mode                                                                                  */
    /* ------------------------------------------------------------------------------------- */

    function stored() {
        try {
            var value = window.localStorage.getItem(STORE);
            return MODES.indexOf(value) !== -1 ? value : null;
        } catch (e) {
            return null;
        }
    }

    function store(value) {
        try {
            window.localStorage.setItem(STORE, value);
        } catch (e) {
            /* private mode: the server copy still counts */
        }
    }

    function systemDark() {
        return !window.matchMedia || window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function resolve(mode) {
        return mode === 'system' ? (systemDark() ? 'dark' : 'light') : mode;
    }

    function initialMode() {
        if (!modeCfg.allowToggle) return modeCfg.default;
        if (cfg.user && MODES.indexOf(cfg.user.mode) !== -1) return cfg.user.mode;
        return stored() || modeCfg.default;
    }

    var mode = initialMode();
    var listeners = [];

    function paint() {
        var theme = resolve(mode);
        root.setAttribute('data-theme', theme);
        root.setAttribute('data-lumen-mode', mode);
        root.style.colorScheme = theme;
        for (var i = 0; i < listeners.length; i++) listeners[i](mode, theme);
    }

    function applyAttributes(attributes) {
        Object.keys(attributes || {}).forEach(function (name) {
            root.setAttribute(name, attributes[name]);
        });
    }

    applyAttributes(cfg.attributes);
    root.setAttribute('data-lumen-area', cfg.area || 'client');
    paint();

    if (window.matchMedia) {
        var media = window.matchMedia('(prefers-color-scheme: dark)');
        var follow = function () {
            if (mode === 'system') paint();
        };
        if (media.addEventListener) media.addEventListener('change', follow);
        else if (media.addListener) media.addListener(follow);
    }

    var lastSent = cfg.user ? cfg.user.mode : null;

    function csrf() {
        var meta = document.querySelector('meta[name="csrf-token"], meta[name="_token"]');
        return meta ? meta.getAttribute('content') : '';
    }

    function persist(next) {
        if (!cfg.user || !cfg.endpoints || !cfg.endpoints.mode || next === lastSent) return;
        lastSent = next;
        try {
            window.fetch(cfg.endpoints.mode, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': csrf(),
                },
                body: JSON.stringify({ mode: next }),
            });
        } catch (e) {
            /* offline: this browser keeps the choice */
        }
    }

    function setMode(next) {
        if (MODES.indexOf(next) === -1 || !modeCfg.allowToggle) return;
        mode = next;
        store(next);
        paint();
        persist(next);
    }

    /* ------------------------------------------------------------------------------------- */
    /* Palette mapping (client area)                                                         */
    /* ------------------------------------------------------------------------------------- */

    var STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];

    // The panel's own grey ramp (tailwind.config.js), in HSL.
    var GREY_HSL = [
        [216, 33, 97], [214, 15, 91], [210, 16, 82], [211, 13, 65], [211, 10, 53],
        [211, 12, 43], [209, 14, 37], [209, 18, 30], [209, 20, 25], [210, 24, 16],
    ];
    // Tailwind palettes the panel uses (v3 for blue and cyan from its config, v2 and v3 defaults
    // for the rest, because twin.macro ships its own defaults).
    var HEX_FAMILIES = {
        accent: [
            ['eff6ff', 'dbeafe', 'bfdbfe', '93c5fd', '60a5fa', '3b82f6', '2563eb', '1d4ed8', '1e40af', '1e3a8a'],
            ['ecfeff', 'cffafe', 'a5f3fc', '67e8f9', '22d3ee', '06b6d4', '0891b2', '0e7490', '155e75', '164e63'],
        ],
        danger: [['fef2f2', 'fee2e2', 'fecaca', 'fca5a5', 'f87171', 'ef4444', 'dc2626', 'b91c1c', '991b1b', '7f1d1d']],
        success: [
            ['f0fdf4', 'dcfce7', 'bbf7d0', '86efac', '4ade80', '22c55e', '16a34a', '15803d', '166534', '14532d'],
            ['ecfdf5', 'd1fae5', 'a7f3d0', '6ee7b7', '34d399', '10b981', '059669', '047857', '065f46', '064e3b'],
        ],
        warning: [
            ['fefce8', 'fef9c3', 'fef08a', 'fde047', 'facc15', 'eab308', 'ca8a04', 'a16207', '854d0e', '713f12'],
            ['fffbeb', 'fef3c7', 'fde68a', 'fcd34d', 'fbbf24', 'f59e0b', 'd97706', 'b45309', '92400e', '78350f'],
        ],
    };

    function hslToRgb(h, s, l) {
        s /= 100;
        l /= 100;
        var k = function (n) {
            return (n + h / 30) % 12;
        };
        var a = s * Math.min(l, 1 - l);
        var f = function (n) {
            return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        };
        return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
    }

    function hexToRgb(hex) {
        if (hex.length === 3 || hex.length === 4) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        var n = parseInt(hex.slice(0, 6), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    var TABLE = [];
    GREY_HSL.forEach(function (hsl, i) {
        TABLE.push([hslToRgb(hsl[0], hsl[1], hsl[2]), 'grey-' + STEPS[i]]);
    });
    Object.keys(HEX_FAMILIES).forEach(function (family) {
        HEX_FAMILIES[family].forEach(function (ramp) {
            ramp.forEach(function (hex, i) {
                TABLE.push([hexToRgb(hex), family + '-' + STEPS[i]]);
            });
        });
    });
    TABLE.push([[255, 255, 255], 'white']);
    TABLE.push([hexToRgb('131a20'), 'black']);
    TABLE.push([hslToRgb(212, 92, 43), 'accent-600']);
    TABLE.push([hslToRgb(178, 78, 57), 'accent-400']);

    function slotFor(rgb) {
        for (var i = 0; i < TABLE.length; i++) {
            var c = TABLE[i][0];
            if (Math.abs(c[0] - rgb[0]) <= 2 && Math.abs(c[1] - rgb[1]) <= 2 && Math.abs(c[2] - rgb[2]) <= 2) {
                return TABLE[i][1];
            }
        }
        return null;
    }

    // rgb(), rgba(), hsl(), hsla() with one level of nested parentheses (var() alphas), and hex.
    var FUNC = /\b(rgba?|hsla?)\(((?:[^()]|\([^()]*\))*)\)/gi;
    var HEX = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g;
    var QUICK = /#[0-9a-fA-F]{3}|rgb|hsl/i;

    function num(part) {
        return parseFloat(part);
    }

    function wrap(slot, alpha) {
        var color = 'var(--lp-' + slot + ')';
        if (alpha === null || alpha === undefined || alpha === '' || alpha === '1' || alpha === '100%') return color;
        var trimmed = String(alpha).trim();
        if (/^[\d.]+%?$/.test(trimmed)) {
            var value = trimmed.slice(-1) === '%' ? parseFloat(trimmed) : parseFloat(trimmed) * 100;
            if (value >= 100) return color;
            return 'color-mix(in srgb, ' + color + ' ' + Math.round(value * 100) / 100 + '%, transparent)';
        }
        return 'color-mix(in srgb, ' + color + ' calc(' + trimmed + ' * 100%), transparent)';
    }

    function convertFunc(match, name, args) {
        var alpha = null;
        var body = args;
        var depth = 0;
        for (var i = 0; i < body.length; i++) {
            var ch = body[i];
            if (ch === '(') depth++;
            else if (ch === ')') depth--;
            else if (ch === '/' && depth === 0) {
                alpha = body.slice(i + 1).trim();
                body = body.slice(0, i);
                break;
            }
        }
        // A comma inside var(...) must not split the alpha; only top-level commas separate.
        var parts = [];
        var current = '';
        depth = 0;
        for (var j = 0; j < body.length; j++) {
            var c = body[j];
            if (c === '(') depth++;
            if (c === ')') depth--;
            if (depth === 0 && (c === ',' || c === ' ' || c === '\t' || c === '\n')) {
                if (current.trim()) parts.push(current.trim());
                current = '';
            } else {
                current += c;
            }
        }
        if (current.trim()) parts.push(current.trim());
        if (parts.length === 4 && alpha === null) {
            alpha = parts[3];
            parts = parts.slice(0, 3);
        }
        if (parts.length !== 3 || /var\(/.test(parts.join(''))) return match;
        var rgb;
        if (name.toLowerCase().indexOf('rgb') === 0) {
            rgb = parts.map(function (p) {
                return p.slice(-1) === '%' ? Math.round(num(p) * 2.55) : Math.round(num(p));
            });
        } else {
            rgb = hslToRgb(num(parts[0]), num(parts[1]), num(parts[2]));
        }
        if (rgb.some(isNaN)) return match;
        var slot = slotFor(rgb);
        return slot ? wrap(slot, alpha) : match;
    }

    function convertHex(match, hex) {
        var slot = slotFor(hexToRgb(hex));
        if (!slot) return match;
        var alpha = null;
        if (hex.length === 8) alpha = String(parseInt(hex.slice(6), 16) / 255);
        if (hex.length === 4) alpha = String(parseInt(hex[3] + hex[3], 16) / 255);
        return wrap(slot, alpha);
    }

    function convertValue(value) {
        if (!value || !QUICK.test(value) || value.indexOf('--lp-') !== -1 || value.indexOf('url(') !== -1) return value;
        return value.replace(FUNC, convertFunc).replace(HEX, convertHex);
    }

    function convertRuleText(text) {
        if (!QUICK.test(text)) return text;
        // Only declaration values change; selectors and at-rule preludes stay as they are.
        return text.replace(/:([^;{}]*)(?=[;}])/g, function (all, value) {
            if (value.indexOf('url(') !== -1) return all;
            return ':' + convertValue(value);
        });
    }

    var SKIP_PROPS = /^(content|grid-template-areas|font-family|--lp-|--lumen-)/;

    function convertStyle(style) {
        for (var i = 0; i < style.length; i++) {
            var prop = style[i];
            if (SKIP_PROPS.test(prop)) continue;
            var value = style.getPropertyValue(prop);
            var next = convertValue(value);
            if (next !== value) style.setProperty(prop, next, style.getPropertyPriority(prop));
        }
    }

    function convertRules(rules) {
        if (!rules) return;
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i];
            if (rule.style && QUICK.test(rule.cssText)) convertStyle(rule.style);
            if (rule.cssRules) convertRules(rule.cssRules);
        }
    }

    function ownSheet(sheet) {
        var node = sheet.ownerNode;
        return node && (node.id === 'lumen-tokens' || node.hasAttribute('data-lumen-own'));
    }

    var done = typeof WeakSet === 'function' ? new WeakSet() : null;

    function convertSheet(sheet, force) {
        if (!sheet || ownSheet(sheet)) return;
        if (done && done.has(sheet) && !force) return;
        try {
            convertRules(sheet.cssRules);
            if (done) done.add(sheet);
        } catch (e) {
            /* cross-origin stylesheet: not ours to read */
        }
    }

    function convertAll() {
        for (var i = 0; i < document.styleSheets.length; i++) convertSheet(document.styleSheets[i]);
    }

    function installPaletteMapping() {
        var proto = window.CSSStyleSheet && window.CSSStyleSheet.prototype;
        if (proto && !proto.__lumen) {
            var insert = proto.insertRule;
            proto.insertRule = function (rule, index) {
                if (typeof rule === 'string' && !ownSheet(this)) {
                    try {
                        rule = convertRuleText(rule);
                    } catch (e) {
                        /* keep the rule as it was */
                    }
                }
                return insert.call(this, rule, index);
            };
            proto.__lumen = true;
        }
        convertAll();
        var observer = new MutationObserver(function (records) {
            for (var i = 0; i < records.length; i++) {
                var target = records[i].target;
                var nodes = records[i].addedNodes;
                if (target && target.nodeName === 'STYLE') convertSheet(target.sheet, true);
                for (var j = 0; j < nodes.length; j++) {
                    var node = nodes[j];
                    if (node.nodeName === 'STYLE') convertSheet(node.sheet, true);
                    else if (node.nodeName === 'LINK' && /stylesheet/i.test(node.rel)) {
                        node.addEventListener('load', function (event) {
                            convertSheet(event.target.sheet);
                        });
                    } else if (node.nodeType === 3 && target && target.nodeName === 'STYLE') {
                        convertSheet(target.sheet, true);
                    }
                }
            }
        });
        observer.observe(document.head, { childList: true, subtree: true, characterData: true });
        window.addEventListener('load', convertAll);
    }

    /* ------------------------------------------------------------------------------------- */
    /* Branding: favicon and logo slots                                                      */
    /* ------------------------------------------------------------------------------------- */

    var branding = cfg.branding || {};

    function setFavicon() {
        if (!branding.favicon) return;
        var links = document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"]');
        for (var i = 0; i < links.length; i++) {
            if (links[i].rel === 'icon' || links[i].rel === 'shortcut icon') links[i].href = branding.favicon;
            else links[i].parentNode.removeChild(links[i]);
        }
        var icon = document.createElement('link');
        icon.rel = 'icon';
        icon.href = branding.favicon;
        document.head.appendChild(icon);
    }

    function logoNode(className) {
        var dark = branding.logoDark || branding.logoLight;
        var light = branding.logoLight || branding.logoDark;
        if (!dark) return null;
        var span = document.createElement('span');
        span.className = 'lumen-logo ' + (className || '');
        span.setAttribute('data-lumen-own', '');
        var a = document.createElement('img');
        a.src = dark;
        a.alt = '';
        a.className = 'lumen-logo-dark';
        var b = document.createElement('img');
        b.src = light;
        b.alt = '';
        b.className = 'lumen-logo-light';
        span.appendChild(a);
        span.appendChild(b);
        return span;
    }

    /* ------------------------------------------------------------------------------------- */
    /* Mode toggle                                                                           */
    /* ------------------------------------------------------------------------------------- */

    var ICONS = {
        light:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>',
        dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z"/></svg>',
        system:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="12.5" rx="2.2"/><path d="M8.5 20.5h7M12 17v3.5"/></svg>',
    };
    var LABELS = { system: 'Theme: system', dark: 'Theme: dark', light: 'Theme: light' };
    var NEXT = { system: 'light', light: 'dark', dark: 'system' };

    function toggleButton(tag) {
        var el = document.createElement(tag || 'button');
        el.className = 'lumen-mode-toggle';
        el.setAttribute('data-lumen-own', '');
        if (el.tagName === 'BUTTON') el.type = 'button';
        else el.href = '#';
        var update = function (current) {
            el.innerHTML = ICONS[current];
            el.title = LABELS[current] + ' (click to change)';
            el.setAttribute('aria-label', LABELS[current]);
        };
        update(mode);
        listeners.push(update);
        el.addEventListener('click', function (event) {
            event.preventDefault();
            setMode(NEXT[mode]);
        });
        return el;
    }

    /* ------------------------------------------------------------------------------------- */
    /* Area-specific decoration                                                              */
    /* ------------------------------------------------------------------------------------- */

    function decorateClient() {
        var nav = document.getElementById('NavigationBar');
        if (nav) {
            nav.classList.add('lumen-nav');
            var right = nav.querySelector('#NavigationDashboard');
            var bar = right ? right.parentElement : null;
            if (bar && modeCfg.allowToggle && !bar.querySelector('.lumen-mode-toggle')) {
                var account = bar.querySelector('#NavigationAccount');
                bar.insertBefore(toggleButton('button'), account || null);
            }
            var logoLink = nav.querySelector('#logo a');
            if (logoLink && !logoLink.querySelector('.lumen-logo')) {
                var logo = logoNode('lumen-nav-logo');
                if (logo) logoLink.insertBefore(logo, logoLink.firstChild);
                logoLink.classList.add('lumen-brand');
            }
        }
        // Login and other auth pages: the panel's logo image becomes the Lumen logo.
        var authLogo = document.querySelector('img[src$="/assets/svgs/pterodactyl.svg"]');
        if (authLogo && !authLogo.hasAttribute('data-lumen-done')) {
            authLogo.setAttribute('data-lumen-done', '');
            var replacement = logoNode('lumen-auth-logo');
            if (replacement) {
                authLogo.style.display = 'none';
                authLogo.parentNode.insertBefore(replacement, authLogo);
            }
            if (cfg.productName) {
                var name = document.createElement('p');
                name.className = 'lumen-auth-name';
                name.setAttribute('data-lumen-own', '');
                name.textContent = cfg.productName;
                authLogo.parentNode.insertBefore(name, authLogo.nextSibling);
            }
        }
        var auth = document.querySelector('form[class*="LoginFormContainer"], [class*="LoginFormContainer"]');
        if (auth) root.setAttribute('data-lumen-page', 'auth');
        else if (root.getAttribute('data-lumen-page') === 'auth') root.removeAttribute('data-lumen-page');
        if (modeCfg.allowToggle && auth && !document.querySelector('.lumen-mode-toggle--floating')) {
            var floating = toggleButton('button');
            floating.classList.add('lumen-mode-toggle--floating');
            document.body.appendChild(floating);
        }
    }

    function decorateAdmin() {
        var brand = document.querySelector('.main-header .logo');
        if (brand && !brand.querySelector('.lumen-logo')) {
            var logo = logoNode('lumen-admin-logo');
            if (logo) brand.insertBefore(logo, brand.firstChild);
        }
        var menu = document.querySelector('.main-header .navbar-custom-menu > .nav');
        if (menu && modeCfg.allowToggle && !menu.querySelector('.lumen-mode-toggle')) {
            var li = document.createElement('li');
            li.className = 'lumen-mode-item';
            li.setAttribute('data-lumen-own', '');
            li.appendChild(toggleButton('a'));
            menu.insertBefore(li, menu.firstChild ? menu.firstChild.nextSibling : null);
        }
    }

    function decorate() {
        if (cfg.area === 'admin') decorateAdmin();
        else decorateClient();
    }

    if (cfg.area !== 'admin') installPaletteMapping();
    setFavicon();

    var scheduled = false;
    function schedule() {
        if (scheduled) return;
        scheduled = true;
        (window.requestAnimationFrame || window.setTimeout)(function () {
            scheduled = false;
            decorate();
        });
    }

    if (document.body) {
        decorate();
        new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    }
    document.addEventListener('DOMContentLoaded', decorate);

    /* ------------------------------------------------------------------------------------- */
    /* API for the admin editor                                                              */
    /* ------------------------------------------------------------------------------------- */

    window.Lumen = {
        config: cfg,
        applyAttributes: applyAttributes,
        getMode: function () {
            return mode;
        },
        setMode: setMode,
        /** Replaces the token stylesheet of this document (live preview). */
        applyCss: function (css) {
            var el = document.getElementById('lumen-tokens');
            if (!el) {
                el = document.createElement('style');
                el.id = 'lumen-tokens';
                document.head.appendChild(el);
            }
            el.textContent = css;
        },
        /** Shows a mode for this document only (preview), without saving it. */
        previewTheme: function (theme) {
            root.setAttribute('data-theme', theme);
            root.style.colorScheme = theme;
        },
        restoreTheme: paint,
        convertValue: convertValue,
        convertRuleText: convertRuleText,
    };
})();
