<?php

namespace Pterodactyl\BlueprintFramework\Extensions\lumen\Http;

use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\BlueprintFramework\Extensions\lumen\SafeImage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Pterodactyl\BlueprintFramework\Extensions\lumen\AppearanceRepository;

/**
 * Serves uploaded logos and backgrounds from storage/app/lumen. Public on purpose: the login
 * page shows them before anyone signs in.
 */
class MediaController extends Controller
{
    public function show(string $name): BinaryFileResponse
    {
        abort_unless(preg_match('/^[a-z0-9-]+\.(png|jpg|webp|gif|ico|svg)$/', $name, $match) === 1, 404);
        $path = AppearanceRepository::mediaDirectory() . '/' . $name;
        abort_unless(is_file($path), 404);

        return response()->file($path, [
            'Content-Type' => SafeImage::TYPES[$match[1]],
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            'Cache-Control' => 'public, max-age=604800',
        ]);
    }
}
