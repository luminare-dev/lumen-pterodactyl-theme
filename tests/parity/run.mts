// Prints the same JSON as run.php, from extension/src/core.ts and target.ts.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, layoutAttributes, normalize } from '../../extension/src/core.ts';
import { brandingForClient, compilePterodactyl } from '../../extension/src/target.ts';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '../../extension/private/presets');
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const defaults = read(join(dir, 'luminare.json'));
const out: { presets: Record<string, unknown>; cases: Record<string, unknown> } = { presets: {}, cases: {} };
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const { tokens, errors } = normalize(read(join(dir, file)), defaults);
    out.presets[file.replace(/\.json$/, '')] = {
        errors,
        core: compile(tokens),
        css: compilePterodactyl(tokens),
        scoped: compilePterodactyl(tokens, { scope: '.lumen-preview', withCustomCss: false }),
        attributes: layoutAttributes(tokens),
        branding: brandingForClient(tokens),
    };
}
for (const c of read(join(here, 'cases.json'))) {
    const { tokens, errors } = normalize(c.input, defaults);
    out.cases[c.name] = { errors, css: compilePterodactyl(tokens), branding: brandingForClient(tokens) };
}
console.log(JSON.stringify(out, null, 4));
