<?php

namespace Pterodactyl\BlueprintFramework\Extensions\lumen\Tokens;

/**
 * PHP twin of src/target.ts: the Pterodactyl-only part of the compiled stylesheet (URLs mapped to
 * the extension's routes, console colours, logo variables). TokenCompiler.php and
 * TokenSchema.php are copies of the Hydrodactyl theme's files (shared.lock); tests/parity checks
 * that this file and target.ts print the same bytes.
 */
class PterodactylTarget
{
    public const ROOT_SCOPE = ':root:root:root[data-lumen]';

    public const URL_PREFIXES = [
        ['/lumen/brand/', '/extensions/lumen/brand/'],
        ['/storage/lumen/', '/extensions/lumen/media/'],
    ];

    public static function resolveUrl(string $value): string
    {
        foreach (self::URL_PREFIXES as [$from, $to]) {
            if (str_starts_with($value, $from)) {
                return $to . substr($value, strlen($from));
            }
        }

        return $value;
    }

    public static function resolveCssUrls(string $css): string
    {
        foreach (self::URL_PREFIXES as [$from, $to]) {
            $css = str_replace('url("' . $from, 'url("' . $to, $css);
        }

        return $css;
    }

    /**
     * @return string[]
     */
    public static function lines(array $tokens): array
    {
        $dark = $tokens['color']['dark'];
        $b = $tokens['branding'];
        $logoDark = $b['logoDark'] !== '' ? $b['logoDark'] : $b['logoLight'];
        $logoLight = $b['logoLight'] !== '' ? $b['logoLight'] : $b['logoDark'];

        return [
            '--lumen-console-bg: ' . $dark['surfaceSunken'] . ';',
            '--lumen-console-surface: ' . $dark['surface'] . ';',
            '--lumen-console-border: ' . $dark['border'] . ';',
            '--lumen-console-text: ' . $dark['text'] . ';',
            '--lumen-console-muted: ' . $dark['textMuted'] . ';',
            '--lumen-console-accent: ' . $dark['accent'] . ';',
            '--lumen-logo-dark: ' . TokenCompiler::cssUrl(self::resolveUrl($logoDark)) . ';',
            '--lumen-logo-light: ' . TokenCompiler::cssUrl(self::resolveUrl($logoLight)) . ';',
        ];
    }

    public static function compile(array $tokens, ?string $scope = null, bool $withCustomCss = true): string
    {
        $scope ??= self::ROOT_SCOPE;
        $css = TokenCompiler::compile($tokens, $scope, false);
        $css .= $scope . " {\n    " . implode("\n    ", self::lines($tokens)) . "\n}\n";
        if ($withCustomCss && trim($tokens['customCss']) !== '') {
            $css .= "/* custom CSS */\n" . TokenCompiler::sanitizeCustomCss($tokens['customCss']) . "\n";
        }

        return self::resolveCssUrls($css);
    }

    /**
     * @return array<string, string>
     */
    public static function branding(array $tokens): array
    {
        $b = $tokens['branding'];

        return [
            'productName' => $b['productName'],
            'logoDark' => self::resolveUrl($b['logoDark'] !== '' ? $b['logoDark'] : $b['logoLight']),
            'logoLight' => self::resolveUrl($b['logoLight'] !== '' ? $b['logoLight'] : $b['logoDark']),
            'favicon' => self::resolveUrl($b['favicon']),
            'loginBackground' => self::resolveUrl($b['loginBackground']),
        ];
    }
}
