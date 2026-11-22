<?php

namespace Pterodactyl\BlueprintFramework\Extensions\lumen;

/**
 * Data for the Lumen head (views/head.blade.php), shared by the client and admin wrappers.
 */
class Head
{
    public function __construct(private AppearanceRepository $repository)
    {
    }

    public function data(string $area): array
    {
        $compiled = $this->repository->compiled();
        $tokens = $compiled['tokens'];
        $user = auth()->user();
        $branding = $compiled['branding'];

        return [
            'css' => $compiled['css'],
            'hash' => $compiled['hash'],
            'fontPreload' => str_contains($tokens['typography']['display'] . $tokens['typography']['body'], 'Sora'),
            'stylesheet' => $tokens['typography']['stylesheet'],
            'version' => @filemtime(base_path('.blueprint/extensions/lumen/public/boot.js')) ?: 1,
            'client' => [
                'version' => $tokens['version'],
                'hash' => $compiled['hash'],
                'area' => $area,
                'mode' => $tokens['mode'],
                'user' => $user === null ? null : ['mode' => $this->repository->userMode($user->id)],
                'branding' => $branding,
                'productName' => $branding['productName'] !== '' ? $branding['productName'] : (string) config('app.name', 'Pterodactyl'),
                'attributes' => $compiled['attributes'],
                'endpoints' => ['mode' => '/extensions/lumen/mode'],
            ],
        ];
    }
}
