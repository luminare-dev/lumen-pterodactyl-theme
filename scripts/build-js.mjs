// Builds extension/public/js/{core,target}.js from extension/src/*.ts by removing the type
// annotations (node:module stripTypeScriptTypes, Node 22.13 or newer). No packages, no bundler:
// the browser loads the files as ES modules, the same code the parity tests run.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'extension/src');
const out = join(root, 'extension/public/js');
mkdirSync(out, { recursive: true });
for (const file of readdirSync(src).filter((f) => f.endsWith('.ts')).sort()) {
    const code = stripTypeScriptTypes(readFileSync(join(src, file), 'utf8'), { mode: 'strip' })
        .replace(/from '\.\/([\w-]+)\.ts'/g, "from './$1.js'");
    const header = `// Built from extension/src/${file} by scripts/build-js.mjs (types removed). Do not edit.\n`;
    writeFileSync(join(out, file.replace(/\.ts$/, '.js')), header + code);
    console.log(`extension/public/js/${file.replace(/\.ts$/, '.js')}`);
}
