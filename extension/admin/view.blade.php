{{--
    Admin → Extensions → Lumen: the customizer. The page is rendered by Blueprint inside the
    admin layout; public/editor.js builds the editor from the state below.
--}}
<link rel="stylesheet" href="/extensions/lumen/editor.css?v={{ @filemtime(base_path('.blueprint/extensions/lumen/public/editor.js')) ?: 1 }}" data-lumen-own>
<div id="lumen-editor" class="lumen-editor" aria-busy="true">
    <noscript>The customizer needs JavaScript.</noscript>
    <p class="lumen-ed-loading">Loading the customizer…</p>
</div>
<script type="application/json" id="lumen-editor-state">{!! json_encode($lumenState, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES) !!}</script>
<script type="module" src="/extensions/lumen/editor.js?v={{ @filemtime(base_path('.blueprint/extensions/lumen/public/editor.js')) ?: 1 }}"></script>
