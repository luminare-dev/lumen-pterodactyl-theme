<?php
// Prints {"presets": {name: {...}}, "cases": {name: {...}}} for the parity test (PHP side).
$root = dirname(__DIR__, 2) . '/extension';
require $root . '/app/Tokens/TokenSchema.php';
require $root . '/app/Tokens/TokenCompiler.php';
require $root . '/app/Tokens/PterodactylTarget.php';

use Pterodactyl\BlueprintFramework\Extensions\lumen\Tokens\PterodactylTarget;
use Pterodactyl\BlueprintFramework\Extensions\lumen\Tokens\TokenCompiler;
use Pterodactyl\BlueprintFramework\Extensions\lumen\Tokens\TokenSchema;

$dir = $root . '/private/presets/';
$defaults = json_decode(file_get_contents($dir . 'luminare.json'), true);
$out = ['presets' => [], 'cases' => []];
$files = glob($dir . '*.json');
sort($files);
foreach ($files as $file) {
    $result = TokenSchema::normalize(json_decode(file_get_contents($file), true), $defaults);
    $out['presets'][basename($file, '.json')] = [
        'errors' => $result['errors'],
        'core' => TokenCompiler::compile($result['tokens']),
        'css' => PterodactylTarget::compile($result['tokens']),
        'scoped' => PterodactylTarget::compile($result['tokens'], '.lumen-preview', false),
        'attributes' => TokenCompiler::layoutAttributes($result['tokens']),
        'branding' => PterodactylTarget::branding($result['tokens']),
    ];
}
foreach (json_decode(file_get_contents(__DIR__ . '/cases.json'), true) as $case) {
    $result = TokenSchema::normalize($case['input'], $defaults);
    $out['cases'][$case['name']] = [
        'errors' => $result['errors'],
        'css' => PterodactylTarget::compile($result['tokens']),
        'branding' => PterodactylTarget::branding($result['tokens']),
    ];
}
echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
