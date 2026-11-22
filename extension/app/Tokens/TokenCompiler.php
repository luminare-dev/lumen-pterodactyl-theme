<?php

namespace Pterodactyl\BlueprintFramework\Extensions\lumen\Tokens;

/**
 * Turns a normalized token set into the CSS variables the panel reads.
 *
 * PHP twin of compile() in resources/scripts/lumen/core.ts. Only token values are printed; the
 * arithmetic stays in CSS calc() and color-mix(), so both versions give the same bytes
 * (checked by tests/parity in the overlay repository).
 */
class TokenCompiler
{
    public const ROOT_SCOPE = ':root:root:root[data-lumen]';

    private const DENSITY_FACTOR = ['compact' => '0.875', 'comfortable' => '1', 'spacious' => '1.125'];
    private const SHADOW_ALPHA = [
        'dark' => ['none' => '0', 'soft' => '0.22', 'medium' => '0.34', 'strong' => '0.5'],
        'light' => ['none' => '0', 'soft' => '0.06', 'medium' => '0.1', 'strong' => '0.16'],
    ];
    private const SHADOW_RGB = ['dark' => '0 0 0', 'light' => '15 23 42'];
    private const CONTENT_WIDTH = ['full' => 'none', 'wide' => '1440px', 'narrow' => '1200px'];
    private const RADIUS_STEPS = [
        ['xs', '0.17'], ['sm', '0.33'], ['md', '0.5'], ['lg', '0.67'], ['xl', '1'], ['2xl', '1.33'], ['3xl', '2'],
    ];
    private const TEXT_STEPS = [
        ['xs', '0.75rem'], ['sm', '0.875rem'], ['base', '1rem'], ['lg', '1.125rem'], ['xl', '1.25rem'],
        ['2xl', '1.5rem'], ['3xl', '1.875rem'], ['4xl', '2.25rem'],
    ];
    private const GREY_STEPS = [
        ['50', '3'], ['100', '8'], ['200', '18'], ['300', '30'], ['400', '45'], ['500', '58'], ['600', '70'],
        ['700', '80'], ['800', '88'], ['900', '94'], ['950', '97'],
    ];
    private const GREYS = ['zinc', 'neutral', 'gray'];
    private const STATUS = [
        ['red', 'danger'], ['green', 'success'], ['emerald', 'success'], ['yellow', 'warning'], ['amber', 'warning'],
        ['blue', 'info'],
    ];

    public static function compile(array $tokens, ?string $scope = null, bool $withCustomCss = true): string
    {
        $scope ??= self::ROOT_SCOPE;
        $block = fn (string $selector, array $lines) => $selector . " {\n    " . implode("\n    ", $lines) . "\n}\n";

        $css = '/* Lumen tokens v' . TokenSchema::VERSION . ': ' . str_replace('*/', '', $tokens['meta']['name']) . " */\n";
        $css .= $block($scope, self::shared($tokens));
        $css .= $block($scope . '[data-theme="dark"]', self::mode($tokens, 'dark'));
        $css .= $block($scope . '[data-theme="light"]', self::mode($tokens, 'light'));
        if ($withCustomCss && trim($tokens['customCss']) !== '') {
            $css .= "/* custom CSS */\n" . self::sanitizeCustomCss($tokens['customCss']) . "\n";
        }

        return $css;
    }

    /**
     * @return array<string, string>
     */
    public static function layoutAttributes(array $tokens): array
    {
        return [
            'data-lumen' => '1',
            'data-lumen-sidebar' => $tokens['layout']['sidebar'],
            'data-lumen-indicator' => $tokens['layout']['indicator'],
            'data-lumen-width' => $tokens['layout']['contentWidth'],
            'data-lumen-glow' => $tokens['layout']['backgroundGlow'] ? 'on' : 'off',
            'data-lumen-density' => $tokens['density'],
            'data-lumen-shadow' => $tokens['elevation']['shadow'],
            'data-lumen-toggle' => $tokens['mode']['allowToggle'] ? 'on' : 'off',
            'data-lumen-login' => $tokens['branding']['loginBackground'] === '' ? 'gradient' : 'image',
        ];
    }

    public static function kebab(string $key): string
    {
        return preg_replace_callback('/[A-Z]/', fn ($m) => '-' . strtolower($m[0]), $key);
    }

    public static function fontStack(string $family, string $fallback): string
    {
        $parts = array_values(array_filter(
            array_map(fn ($part) => str_replace(['"', "'"], '', trim($part)), explode(',', $family)),
            fn ($part) => $part !== '',
        ));
        $generic = '/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|-apple-system)$/';
        $quoted = array_map(fn ($part) => preg_match($generic, $part) === 1 ? $part : '"' . $part . '"', $parts);
        $quoted[] = $fallback;

        return implode(', ', $quoted);
    }

    public static function cssUrl(string $value): string
    {
        return $value === '' ? 'none' : 'url("' . $value . '")';
    }

    public static function sanitizeCustomCss(string $css): string
    {
        return preg_replace('/<!--|-->/', '', preg_replace('/<\/?\s*style/i', '', $css));
    }

    public static function number(int|float $value): string
    {
        if (is_float($value) && floor($value) === $value) {
            return (string) (int) $value;
        }

        return (string) $value;
    }

    private static function mix(string $a, string $b, string $percentOfA): string
    {
        return "color-mix(in srgb, $a $percentOfA%, $b)";
    }

    private static function v(string $key): string
    {
        return 'var(--lumen-' . self::kebab($key) . ')';
    }

    private static function mode(array $tokens, string $mode): array
    {
        $c = $tokens['color'][$mode];
        $v = fn (string $key) => self::v($key);
        $mix = fn (string $a, string $b, string $p) => self::mix($a, $b, $p);
        $lines = [];
        foreach (TokenSchema::COLOR_KEYS as $key) {
            $lines[] = '--lumen-' . self::kebab($key) . ': ' . $c[$key] . ';';
        }

        array_push(
            $lines,
            '--lumen-shadow-rgb: ' . self::SHADOW_RGB[$mode] . ';',
            '--lumen-shadow-alpha: ' . self::SHADOW_ALPHA[$mode][$tokens['elevation']['shadow']] . ';',
            '--lumen-glow: ' . $mix($v('accent'), 'transparent', $mode === 'dark' ? '16' : '10') . ';',
            '--lumen-glow-secondary: ' . $mix($v('accentSecondary'), 'transparent', $mode === 'dark' ? '12' : '8') . ';',
            '--lumen-border-color: ' . ($tokens['elevation']['borders'] ? $v('border') : 'transparent') . ';',
            '--brand-color: ' . $v('accent') . ';',
            '--panel-accent: ' . $v('accent') . ';',
            '--color-canvas: ' . $v('canvas') . ';',
            '--color-bg: ' . $v('canvas') . ';',
            '--color-bg-raised: ' . $v('surface') . ';',
            '--color-bg-lowered: ' . $v('surfaceSunken') . ';',
            '--color-primary: ' . $v('text') . ';',
            '--color-secondary: ' . $v('textMuted') . ';',
            '--color-overlay: ' . $v('text') . ';',
            '--color-accent: ' . $v('text') . ';',
            '--color-accent-foreground: ' . $v('surface') . ';',
            '--color-ring: ' . $v('focus') . ';',
            '--color-mocha-700: ' . $v('canvas') . ';',
            '--color-mocha-600: ' . $v('surfaceSunken') . ';',
            '--color-mocha-500: ' . $v('surface') . ';',
            '--color-mocha-400: ' . $v('surfaceRaised') . ';',
            '--color-mocha-300: ' . $v('border') . ';',
            '--color-mocha-200: ' . $mix($v('border'), $v('textMuted'), '65') . ';',
            '--color-mocha-100: ' . $mix($v('border'), $v('textMuted'), '35') . ';',
            '--color-mocha-50: ' . $mix($v('textMuted'), $v('border'), '85') . ';',
            '--color-cream-50: ' . $v('text') . ';',
            '--color-cream-100: ' . $v('text') . ';',
            '--color-cream-200: ' . $v('text') . ';',
            '--color-cream-300: ' . $v('text') . ';',
            '--color-cream-400: ' . $v('text') . ';',
            '--color-cream-500: ' . $mix($v('text'), $v('textMuted'), '80') . ';',
            '--color-hydro: ' . $v('accent') . ';',
        );

        $hydro = [
            ['50', $mix($v('accent'), $v('surface'), '10')],
            ['100', $mix($v('accent'), $v('surface'), '20')],
            ['200', $mix($v('accent'), $v('surface'), '35')],
            ['300', $v('accentText')],
            ['400', $v('accentText')],
            ['500', $v('accent')],
            ['600', $mix($v('accent'), $v('canvas'), '85')],
            ['700', $mix($v('accent'), $v('canvas'), '70')],
            ['800', $mix($v('accent'), $v('canvas'), '55')],
            ['900', $mix($v('accent'), $v('canvas'), '40')],
        ];
        foreach ($hydro as [$step, $value]) {
            $lines[] = "--color-hydro-$step: $value;";
        }
        $lines[] = '--color-brand: ' . $v('accent') . ';';
        foreach ($hydro as [$step, $value]) {
            $lines[] = "--color-brand-$step: $value;";
        }

        foreach (self::GREYS as $grey) {
            foreach (self::GREY_STEPS as [$step, $share]) {
                $lines[] = "--color-$grey-$step: " . $mix($v('canvas'), $v('text'), $share) . ';';
            }
        }

        foreach (self::STATUS as [$name, $key]) {
            array_push(
                $lines,
                "--color-$name-300: " . $mix($v($key), $v('text'), '80') . ';',
                "--color-$name-400: " . $v($key) . ';',
                "--color-$name-500: " . $v($key) . ';',
                "--color-$name-600: " . $mix($v($key), $v('canvas'), '85') . ';',
            );
        }

        array_push(
            $lines,
            '--shadow-xs: 0 1px 2px rgb(var(--lumen-shadow-rgb) / var(--lumen-shadow-alpha));',
            '--shadow-sm: 0 1px 3px rgb(var(--lumen-shadow-rgb) / calc(var(--lumen-shadow-alpha) * 1.2)), 0 1px 2px rgb(var(--lumen-shadow-rgb) / var(--lumen-shadow-alpha));',
            '--shadow-md: 0 6px 16px -4px rgb(var(--lumen-shadow-rgb) / calc(var(--lumen-shadow-alpha) * 1.4));',
            '--shadow-lg: 0 14px 32px -8px rgb(var(--lumen-shadow-rgb) / calc(var(--lumen-shadow-alpha) * 1.8));',
            '--shadow-xl: 0 24px 56px -12px rgb(var(--lumen-shadow-rgb) / calc(var(--lumen-shadow-alpha) * 2.2));',
            '--shadow-2xl: 0 32px 72px -16px rgb(var(--lumen-shadow-rgb) / calc(var(--lumen-shadow-alpha) * 2.6));',
        );

        return $lines;
    }

    private static function shared(array $tokens): array
    {
        $t = $tokens['typography'];
        $lines = [
            '--lumen-font-display: ' . self::fontStack($t['display'], 'ui-sans-serif, system-ui, sans-serif') . ';',
            '--lumen-font-body: ' . self::fontStack($t['body'], 'ui-sans-serif, system-ui, sans-serif') . ';',
            '--lumen-font-mono: ' . self::fontStack($t['mono'], 'monospace') . ';',
            '--lumen-heading-weight: ' . self::number($t['headingWeight']) . ';',
            '--lumen-font-scale: ' . self::number($t['scale']) . ';',
            '--font-sans: var(--lumen-font-body);',
            '--font-mono: var(--lumen-font-mono);',
            '--lumen-radius: ' . self::number($tokens['radius']['base']) . 'px;',
        ];
        foreach (self::RADIUS_STEPS as [$step, $factor]) {
            $lines[] = "--radius-$step: calc(var(--lumen-radius) * $factor);";
        }
        array_push(
            $lines,
            '--spacing: calc(' . self::number($tokens['spacing']['base']) . 'px * ' . self::DENSITY_FACTOR[$tokens['density']] . ');',
            '--lumen-density: ' . self::DENSITY_FACTOR[$tokens['density']] . ';',
        );
        foreach (self::TEXT_STEPS as [$step, $size]) {
            $lines[] = "--text-$step: calc($size * var(--lumen-font-scale));";
        }
        array_push(
            $lines,
            '--sidebar-full-width: ' . self::number($tokens['layout']['sidebarWidth']) . 'px;',
            '--lumen-content-max: ' . self::CONTENT_WIDTH[$tokens['layout']['contentWidth']] . ';',
            '--lumen-login-background: ' . self::cssUrl($tokens['branding']['loginBackground']) . ';',
        );

        return $lines;
    }
}
