// Lumen tokens for Pterodactyl: the parts of the compiled stylesheet that only this target needs.
//
// core.ts is a byte-for-byte copy of the Hydrodactyl theme's compiler (shared.lock); this file adds
// what Pterodactyl needs on top: URLs rewritten to where the Blueprint extension serves them, the
// console colours and the logo variables. app/Tokens/PterodactylTarget.php is the PHP twin;
// tests/parity checks that both print the same bytes.

import { type CompileOptions, compile, cssUrl, sanitizeCustomCss, type Tokens } from './core.ts';

/** Token URLs are portable between Lumen themes; this maps them to the extension's routes. */
export const URL_PREFIXES: [string, string][] = [
    ['/lumen/brand/', '/extensions/lumen/brand/'],
    ['/storage/lumen/', '/extensions/lumen/media/'],
];

export function resolveUrl(value: string): string {
    for (const [from, to] of URL_PREFIXES) {
        if (value.startsWith(from)) return to + value.slice(from.length);
    }
    return value;
}

export function resolveCssUrls(css: string): string {
    let out = css;
    for (const [from, to] of URL_PREFIXES) out = out.split(`url("${from}`).join(`url("${to}`);
    return out;
}

export function targetLines(tokens: Tokens): string[] {
    const dark = tokens.color.dark;
    const b = tokens.branding;
    const logoDark = b.logoDark !== '' ? b.logoDark : b.logoLight;
    const logoLight = b.logoLight !== '' ? b.logoLight : b.logoDark;
    return [
        `--lumen-console-bg: ${dark.surfaceSunken};`,
        `--lumen-console-surface: ${dark.surface};`,
        `--lumen-console-border: ${dark.border};`,
        `--lumen-console-text: ${dark.text};`,
        `--lumen-console-muted: ${dark.textMuted};`,
        `--lumen-console-accent: ${dark.accent};`,
        `--lumen-logo-dark: ${cssUrl(resolveUrl(logoDark))};`,
        `--lumen-logo-light: ${cssUrl(resolveUrl(logoLight))};`,
    ];
}

const ROOT_SCOPE = ':root:root:root[data-lumen]';

/** The full stylesheet for a Pterodactyl page (or a scoped preview). */
export function compilePterodactyl(tokens: Tokens, options: CompileOptions = {}): string {
    const scope = options.scope ?? ROOT_SCOPE;
    const core = compile(tokens, { ...options, withCustomCss: false });
    let css = `${core}${scope} {\n    ${targetLines(tokens).join('\n    ')}\n}\n`;
    if ((options.withCustomCss ?? true) && tokens.customCss.trim() !== '') {
        css += `/* custom CSS */\n${sanitizeCustomCss(tokens.customCss)}\n`;
    }
    return resolveCssUrls(css);
}

/** Branding values as the browser needs them (resolved URLs, one logo standing in for both). */
export function brandingForClient(tokens: Tokens): Record<string, string> {
    const b = tokens.branding;
    return {
        productName: b.productName,
        logoDark: resolveUrl(b.logoDark !== '' ? b.logoDark : b.logoLight),
        logoLight: resolveUrl(b.logoLight !== '' ? b.logoLight : b.logoDark),
        favicon: resolveUrl(b.favicon),
        loginBackground: resolveUrl(b.loginBackground),
    };
}
