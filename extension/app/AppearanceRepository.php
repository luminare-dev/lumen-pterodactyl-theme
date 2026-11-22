<?php

namespace Pterodactyl\BlueprintFramework\Extensions\lumen;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Pterodactyl\BlueprintFramework\Extensions\lumen\Tokens\TokenSchema;
use Pterodactyl\BlueprintFramework\Extensions\lumen\Tokens\TokenCompiler;
use Pterodactyl\BlueprintFramework\Extensions\lumen\Tokens\PterodactylTarget;

/**
 * Stores the active token set (table lumen_appearance, key "active") and each user's mode
 * (table lumen_user_preferences). Every read falls back to the Luminare preset, so the panel
 * keeps working when the migration has not run yet. Uploaded logos live in storage/app/lumen,
 * outside the extension folder, so updating or reinstalling the extension keeps them.
 */
class AppearanceRepository
{
    public const CACHE_KEY = 'lumen:pterodactyl:appearance:v1';
    public const MODES = ['system', 'dark', 'light'];
    public const MEDIA_PREFIX = '/storage/lumen/';

    private ?array $compiled = null;

    public static function presetDirectory(): string
    {
        return base_path('.blueprint/extensions/lumen/private/presets');
    }

    public static function mediaDirectory(): string
    {
        return storage_path('app/lumen');
    }

    public function defaults(): array
    {
        return json_decode((string) file_get_contents(self::presetDirectory() . '/luminare.json'), true);
    }

    /**
     * @return array<string, array>
     */
    public function presets(): array
    {
        $defaults = $this->defaults();
        $presets = ['luminare' => TokenSchema::normalize($defaults, $defaults)['tokens']];
        $files = glob(self::presetDirectory() . '/*.json') ?: [];
        sort($files);
        foreach ($files as $file) {
            $name = basename($file, '.json');
            if ($name !== 'luminare') {
                $presets[$name] = TokenSchema::normalize(json_decode((string) file_get_contents($file), true), $defaults)['tokens'];
            }
        }

        return $presets;
    }

    /**
     * @return array{tokens: array, css: string, attributes: array<string, string>, branding: array<string, string>, hash: string, saved: bool, updatedAt: ?string}
     */
    public function compiled(): array
    {
        if ($this->compiled !== null) {
            return $this->compiled;
        }

        $build = function (): array {
            $defaults = $this->defaults();
            $row = null;
            try {
                $row = DB::table('lumen_appearance')->where('key', 'active')->first();
            } catch (\Throwable $exception) {
                Log::debug('Lumen appearance table is not available; using the default preset.', ['error' => $exception->getMessage()]);
            }
            $stored = $row ? json_decode((string) $row->tokens, true) : $defaults;
            $tokens = TokenSchema::normalize($stored, $defaults)['tokens'];
            $css = PterodactylTarget::compile($tokens);

            return [
                'tokens' => $tokens,
                'css' => $css,
                'attributes' => TokenCompiler::layoutAttributes($tokens),
                'branding' => PterodactylTarget::branding($tokens),
                'hash' => substr(sha1($css), 0, 12),
                'saved' => $row !== null,
                'updatedAt' => $row?->updated_at,
            ];
        };

        try {
            return $this->compiled = Cache::rememberForever(self::CACHE_KEY, $build);
        } catch (\Throwable) {
            return $this->compiled = $build();
        }
    }

    public function save(array $tokens, ?int $userId = null): array
    {
        $now = now();
        DB::table('lumen_appearance')->updateOrInsert(
            ['key' => 'active'],
            ['tokens' => json_encode($tokens, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 'updated_by' => $userId, 'updated_at' => $now, 'created_at' => $now],
        );
        $this->flush();
        $this->pruneMedia($tokens);

        return $this->compiled();
    }

    public function reset(): array
    {
        DB::table('lumen_appearance')->where('key', 'active')->delete();
        $this->flush();
        $this->pruneMedia($this->defaults());

        return $this->compiled();
    }

    public function flush(): void
    {
        $this->compiled = null;
        Cache::forget(self::CACHE_KEY);
    }

    public function userMode(?int $userId): ?string
    {
        if ($userId === null) {
            return null;
        }
        try {
            $mode = DB::table('lumen_user_preferences')->where('user_id', $userId)->value('mode');
        } catch (\Throwable) {
            return null;
        }

        return in_array($mode, self::MODES, true) ? $mode : null;
    }

    public function setUserMode(int $userId, string $mode): void
    {
        $now = now();
        DB::table('lumen_user_preferences')->updateOrInsert(
            ['user_id' => $userId],
            ['mode' => $mode, 'updated_at' => $now, 'created_at' => $now],
        );
    }

    /**
     * Deletes uploaded files no token points to any more. Files younger than a day stay, so an
     * upload that is still in an unsaved editor session survives a save from another tab.
     */
    private function pruneMedia(array $tokens): void
    {
        try {
            $used = [];
            foreach (TokenSchema::BRANDING_ASSETS as $key) {
                $value = $tokens['branding'][$key] ?? '';
                if (is_string($value) && str_starts_with($value, self::MEDIA_PREFIX)) {
                    $used[] = substr($value, strlen(self::MEDIA_PREFIX));
                }
            }
            foreach (glob(self::mediaDirectory() . '/*') ?: [] as $file) {
                if (is_file($file) && !in_array(basename($file), $used, true) && filemtime($file) < time() - 86400) {
                    @unlink($file);
                }
            }
        } catch (\Throwable $exception) {
            Log::warning('Could not prune Lumen media files.', ['error' => $exception->getMessage()]);
        }
    }
}
