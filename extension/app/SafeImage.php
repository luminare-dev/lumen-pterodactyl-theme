<?php

namespace Pterodactyl\BlueprintFramework\Extensions\lumen;

/**
 * Upload checks for logos, favicons and login backgrounds. SVG files are refused (not cleaned)
 * when they could run code or load anything; raster files must decode as images. The media
 * route also serves SVG with a CSP that blocks scripts, as a second line.
 */
class SafeImage
{
    public const MAX_KB = 4096;
    public const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'ico', 'svg'];
    public const TYPES = [
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'webp' => 'image/webp',
        'gif' => 'image/gif',
        'ico' => 'image/x-icon',
        'svg' => 'image/svg+xml',
    ];

    public static function check(string $content, string $extension): bool
    {
        if ($extension === 'svg') {
            if (!preg_match('/<svg[\s>]/i', $content)) {
                return false;
            }
            $blocked = '/<\s*(script|foreignObject|iframe|embed|object|handler|animate|set|use)\b|\bon[a-z]+\s*=|javascript:|data:|(?:xlink:)?href\s*=\s*["\']?\s*(?!#)|<!ENTITY|<!DOCTYPE|@import|url\s*\(\s*["\']?\s*(?!#)/i';

            return preg_match($blocked, $content) !== 1;
        }

        if ($extension === 'ico') {
            return strlen($content) > 6 && str_starts_with($content, "\x00\x00\x01\x00");
        }

        return @getimagesizefromstring($content) !== false;
    }
}
