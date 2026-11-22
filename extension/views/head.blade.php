{{-- Lumen theme head, included by the client and admin wrappers before the panel's bundle. --}}
@php
    try {
        $lumen = app(\Pterodactyl\BlueprintFramework\Extensions\lumen\Head::class)->data($lumenArea ?? 'client');
    } catch (\Throwable $exception) {
        report($exception);
        $lumen = null;
    }
    $lumenJson = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES;
@endphp
@if($lumen !== null)
<meta name="lumen-theme" content="{{ $lumen['hash'] }}" data-lumen-head>
@if($lumen['fontPreload'])
<link rel="preload" href="/extensions/lumen/fonts/Sora-Variable.woff" as="font" type="font/woff" crossorigin>
@endif
<link rel="stylesheet" href="/extensions/lumen/lumen-{{ ($lumenArea ?? 'client') === 'admin' ? 'admin' : 'client' }}.css?v={{ $lumen['version'] }}" data-lumen-own>
@if($lumen['stylesheet'] !== '')
<link rel="stylesheet" href="{{ $lumen['stylesheet'] }}" data-lumen-own>
@endif
<style id="lumen-tokens">{!! $lumen['css'] !!}</style>
<script>window.LumenAppearance = {!! json_encode($lumen['client'], $lumenJson) !!};</script>
<script src="/extensions/lumen/boot.js?v={{ $lumen['version'] }}"></script>
@endif
