<?php

namespace Pterodactyl\Http\Controllers\Admin\Extensions\lumen;

use Illuminate\View\View;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\BlueprintFramework\Extensions\lumen\SafeImage;
use Pterodactyl\BlueprintFramework\Extensions\lumen\Tokens\TokenSchema;
use Pterodactyl\BlueprintFramework\Extensions\lumen\AppearanceRepository;
use Pterodactyl\BlueprintFramework\Libraries\ExtensionLibrary\Admin\BlueprintAdminLibrary as BlueprintExtensionLibrary;

/**
 * Admin → Extensions → Lumen: the customizer. Blueprint routes /admin/extensions/lumen here:
 * GET index (the page), PATCH update (save tokens), POST post (upload a logo file),
 * DELETE delete (reset to the default preset). All JSON calls use the admin session and CSRF.
 */
class lumenExtensionController extends Controller
{
    public function __construct(
        private ViewFactory $view,
        private BlueprintExtensionLibrary $blueprint,
        private AppearanceRepository $repository,
    ) {
    }

    public function index(): View
    {
        return $this->view->make('admin.extensions.lumen.index', [
            'blueprint' => $this->blueprint,
            'root' => '/admin/extensions/lumen',
            'lumenState' => $this->state(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $input = $request->input('tokens');
        if (!is_array($input)) {
            return response()->json(['errors' => ['tokens']], 422);
        }

        $result = TokenSchema::normalize($input, $this->repository->defaults());
        if ($result['errors'] !== []) {
            return response()->json(['errors' => $result['errors']], 422);
        }

        $this->repository->save($result['tokens'], $request->user()?->id);

        return response()->json($this->state());
    }

    public function post(Request $request): JsonResponse
    {
        $request->validate([
            'slot' => ['required', 'string', 'in:' . implode(',', TokenSchema::BRANDING_ASSETS)],
            'file' => ['required', 'file', 'max:' . SafeImage::MAX_KB],
        ]);

        $file = $request->file('file');
        $extension = strtolower((string) $file->getClientOriginalExtension());
        if (!in_array($extension, SafeImage::EXTENSIONS, true)) {
            return response()->json(['errors' => ['file' => 'Use a PNG, JPEG, WebP, GIF, ICO or SVG file.']], 422);
        }

        $content = (string) file_get_contents($file->getRealPath());
        if (!SafeImage::check($content, $extension)) {
            return response()->json(['errors' => ['file' => 'The file is not a valid image, or the SVG contains scripts or external links.']], 422);
        }

        $extension = $extension === 'jpeg' ? 'jpg' : $extension;
        $name = Str::kebab($request->input('slot')) . '-' . Str::lower(Str::random(16)) . '.' . $extension;
        $dir = AppearanceRepository::mediaDirectory();
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        file_put_contents($dir . '/' . $name, $content);

        return response()->json(['url' => AppearanceRepository::MEDIA_PREFIX . $name]);
    }

    public function delete(Request $request, string $target, string $id): JsonResponse
    {
        abort_unless($target === 'appearance' && $id === 'active', 404);
        $this->repository->reset();

        return response()->json($this->state());
    }

    private function state(): array
    {
        $compiled = $this->repository->compiled();
        $presets = $this->repository->presets();

        return [
            'tokens' => $compiled['tokens'],
            'defaults' => $presets['luminare'],
            'presets' => $presets,
            'saved' => $compiled['saved'],
            'updatedAt' => $compiled['updatedAt'],
            'upload' => ['maxKb' => SafeImage::MAX_KB, 'extensions' => SafeImage::EXTENSIONS],
            'endpoint' => '/admin/extensions/lumen',
            'appName' => (string) config('app.name', 'Pterodactyl'),
        ];
    }
}
