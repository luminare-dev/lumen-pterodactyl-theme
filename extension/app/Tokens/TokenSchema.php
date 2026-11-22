<?php

namespace Pterodactyl\BlueprintFramework\Extensions\lumen\Tokens;

/**
 * Checks and completes a Lumen token document (schema v1, docs/tokens.md).
 *
 * PHP twin of normalize() in resources/scripts/lumen/core.ts: missing or invalid values fall back
 * to the defaults and every replaced value is reported by its path.
 */
class TokenSchema
{
    public const VERSION = 1;

    public const COLOR_KEYS = [
        'canvas', 'surfaceSunken', 'surface', 'surfaceRaised', 'border', 'text', 'textMuted', 'accent',
        'accentSecondary', 'accentText', 'accentContrast', 'success', 'warning', 'danger', 'info', 'focus',
    ];

    public const ENUMS = [
        'defaultMode' => ['system', 'dark', 'light'],
        'density' => ['compact', 'comfortable', 'spacious'],
        'shadow' => ['none', 'soft', 'medium', 'strong'],
        'sidebar' => ['floating', 'flush'],
        'indicator' => ['pill', 'bar', 'glow'],
        'contentWidth' => ['full', 'wide', 'narrow'],
    ];

    public const RANGES = [
        'scale' => [0.85, 1.25],
        'headingWeight' => [400, 800],
        'radius' => [0, 28],
        'spacing' => [3, 6],
        'sidebarWidth' => [220, 360],
    ];

    public const LIMITS = ['productName' => 60, 'family' => 200, 'url' => 2048, 'customCss' => 20000, 'metaText' => 200];

    public const BRANDING_ASSETS = ['logoDark', 'logoLight', 'favicon', 'loginBackground'];

    private const HEX = '/^#[0-9a-fA-F]{6}$/';
    private const PLAIN = '/^[^<>]*$/';
    private const FAMILY = '/^[A-Za-z0-9 ,\'"_.-]*$/';
    private const LOCAL_URL = '/^\/(?:storage\/lumen|lumen\/brand)\/[A-Za-z0-9._-]+$/';
    private const HTTPS_URL = '/^https:\/\/[^\s"\'()\\\\<>]+$/';

    /** @var string[] */
    private array $errors = [];

    /**
     * @return array{tokens: array, errors: string[]}
     */
    public static function normalize(mixed $input, array $defaults): array
    {
        $schema = new self();
        $tokens = $schema->run($input, $defaults);

        return ['tokens' => $tokens, 'errors' => $schema->errors];
    }

    private function run(mixed $input, array $d): array
    {
        $src = self::obj($input);

        if (array_key_exists('version', $src) && $src['version'] !== self::VERSION) {
            $this->errors[] = 'version';
        }

        $meta = self::obj($src['meta'] ?? null);
        $mode = self::obj($src['mode'] ?? null);
        $color = self::obj($src['color'] ?? null);
        $typography = self::obj($src['typography'] ?? null);
        $elevation = self::obj($src['elevation'] ?? null);
        $layout = self::obj($src['layout'] ?? null);
        $branding = self::obj($src['branding'] ?? null);
        $radius = self::obj($src['radius'] ?? null);
        $spacing = self::obj($src['spacing'] ?? null);

        $colors = function (string $which) use ($color, $d): array {
            $given = self::obj($color[$which] ?? null);
            $out = [];
            foreach (self::COLOR_KEYS as $key) {
                $value = $this->str("color.$which.$key", $given, $key, $d['color'][$which][$key], 7, self::HEX);
                $out[$key] = strtoupper($value);
            }

            return $out;
        };

        $t = $d['typography'];

        return [
            'version' => self::VERSION,
            'meta' => [
                'name' => $this->str('meta.name', $meta, 'name', $d['meta']['name'], self::LIMITS['metaText'], self::PLAIN),
                'description' => $this->str('meta.description', $meta, 'description', $d['meta']['description'], self::LIMITS['metaText'], self::PLAIN),
            ],
            'mode' => [
                'default' => $this->oneOf('mode.default', $mode, 'default', $d['mode']['default'], self::ENUMS['defaultMode']),
                'allowToggle' => $this->bool('mode.allowToggle', $mode, 'allowToggle', $d['mode']['allowToggle']),
            ],
            'color' => ['dark' => $colors('dark'), 'light' => $colors('light')],
            'typography' => [
                'display' => $this->str('typography.display', $typography, 'display', $t['display'], self::LIMITS['family'], self::FAMILY),
                'body' => $this->str('typography.body', $typography, 'body', $t['body'], self::LIMITS['family'], self::FAMILY),
                'mono' => $this->str('typography.mono', $typography, 'mono', $t['mono'], self::LIMITS['family'], self::FAMILY),
                'stylesheet' => array_key_exists('stylesheet', $typography) && $typography['stylesheet'] === ''
                    ? ''
                    : $this->str('typography.stylesheet', $typography, 'stylesheet', $t['stylesheet'], self::LIMITS['url'], self::HTTPS_URL),
                'scale' => $this->num('typography.scale', $typography, 'scale', $t['scale'], self::RANGES['scale']),
                'headingWeight' => $this->num('typography.headingWeight', $typography, 'headingWeight', $t['headingWeight'], self::RANGES['headingWeight']),
            ],
            'radius' => ['base' => $this->num('radius.base', $radius, 'base', $d['radius']['base'], self::RANGES['radius'])],
            'spacing' => ['base' => $this->num('spacing.base', $spacing, 'base', $d['spacing']['base'], self::RANGES['spacing'])],
            'density' => $this->oneOf('density', $src, 'density', $d['density'], self::ENUMS['density']),
            'elevation' => [
                'shadow' => $this->oneOf('elevation.shadow', $elevation, 'shadow', $d['elevation']['shadow'], self::ENUMS['shadow']),
                'borders' => $this->bool('elevation.borders', $elevation, 'borders', $d['elevation']['borders']),
            ],
            'layout' => [
                'sidebar' => $this->oneOf('layout.sidebar', $layout, 'sidebar', $d['layout']['sidebar'], self::ENUMS['sidebar']),
                'sidebarWidth' => $this->num('layout.sidebarWidth', $layout, 'sidebarWidth', $d['layout']['sidebarWidth'], self::RANGES['sidebarWidth']),
                'indicator' => $this->oneOf('layout.indicator', $layout, 'indicator', $d['layout']['indicator'], self::ENUMS['indicator']),
                'contentWidth' => $this->oneOf('layout.contentWidth', $layout, 'contentWidth', $d['layout']['contentWidth'], self::ENUMS['contentWidth']),
                'backgroundGlow' => $this->bool('layout.backgroundGlow', $layout, 'backgroundGlow', $d['layout']['backgroundGlow']),
            ],
            'branding' => [
                'productName' => $this->str('branding.productName', $branding, 'productName', $d['branding']['productName'], self::LIMITS['productName'], self::PLAIN),
                'logoDark' => $this->url('branding.logoDark', $branding, 'logoDark', $d['branding']['logoDark']),
                'logoLight' => $this->url('branding.logoLight', $branding, 'logoLight', $d['branding']['logoLight']),
                'favicon' => $this->url('branding.favicon', $branding, 'favicon', $d['branding']['favicon']),
                'loginBackground' => $this->url('branding.loginBackground', $branding, 'loginBackground', $d['branding']['loginBackground']),
            ],
            'customCss' => $this->str('customCss', $src, 'customCss', $d['customCss'], self::LIMITS['customCss']),
        ];
    }

    private static function obj(mixed $value): array
    {
        return is_array($value) && ($value === [] || !array_is_list($value)) ? $value : [];
    }

    private function str(string $path, array $src, string $key, string $fallback, int $max, ?string $pattern = null): string
    {
        if (!array_key_exists($key, $src)) {
            return $fallback;
        }
        $value = $src[$key];
        if (!is_string($value) || mb_strlen($value) > $max || ($pattern !== null && preg_match($pattern, $value) !== 1)) {
            $this->errors[] = $path;

            return $fallback;
        }

        return trim($value);
    }

    private function num(string $path, array $src, string $key, int|float $fallback, array $range): int|float
    {
        if (!array_key_exists($key, $src)) {
            return $fallback;
        }
        $value = $src[$key];
        if ((!is_int($value) && !is_float($value)) || !is_finite((float) $value) || $value < $range[0] || $value > $range[1]) {
            $this->errors[] = $path;

            return $fallback;
        }

        return $value;
    }

    private function bool(string $path, array $src, string $key, bool $fallback): bool
    {
        if (!array_key_exists($key, $src)) {
            return $fallback;
        }
        if (!is_bool($src[$key])) {
            $this->errors[] = $path;

            return $fallback;
        }

        return $src[$key];
    }

    private function oneOf(string $path, array $src, string $key, string $fallback, array $allowed): string
    {
        if (!array_key_exists($key, $src)) {
            return $fallback;
        }
        $value = $src[$key];
        if (!is_string($value) || !in_array($value, $allowed, true)) {
            $this->errors[] = $path;

            return $fallback;
        }

        return $value;
    }

    private function url(string $path, array $src, string $key, string $fallback): string
    {
        if (!array_key_exists($key, $src)) {
            return $fallback;
        }
        $value = $src[$key];
        if ($value === '') {
            return '';
        }
        if (
            !is_string($value)
            || mb_strlen($value) > self::LIMITS['url']
            || !(preg_match(self::LOCAL_URL, $value) === 1 || preg_match(self::HTTPS_URL, $value) === 1)
        ) {
            $this->errors[] = $path;

            return $fallback;
        }

        return $value;
    }
}
