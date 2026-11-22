// Fails when a shipped preset has a contrast pair below its WCAG minimum.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastReport, normalize } from '../../extension/src/core.ts';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../extension/private/presets');
const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
const defaults = read('luminare.json');
let failed = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const { tokens, errors } = normalize(read(file), defaults);
    for (const e of errors) {
        console.log(`${file}: invalid ${e}`);
        failed++;
    }
    for (const r of contrastReport(tokens).filter((x) => !x.ok)) {
        console.log(`${file}: ${r.mode} ${r.fg} on ${r.bg} ${r.ratio.toFixed(2)} < ${r.min}`);
        failed++;
    }
}
process.exit(failed ? 1 : 0);
