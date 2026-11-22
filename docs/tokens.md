# Token schema

Lumen themes share one token schema, version 1: the Pterodactyl theme reads the same JSON files
as the [Lumen theme for Hydrodactyl](https://github.com/luminare-dev/lumen-hydrodactyl-theme),
whose [docs/tokens.md](https://github.com/luminare-dev/lumen-hydrodactyl-theme/blob/main/docs/tokens.md)
is the full reference (every key, its range and the colour roles with their contrast checks).

The normalizer and compiler are the same code: `extension/src/core.ts`,
`extension/app/Tokens/TokenSchema.php` and `extension/app/Tokens/TokenCompiler.php` are copies of
the Hydrodactyl theme's files at the commit in `shared.lock` (the PHP copies differ only in their
namespace). `python3 scripts/check_shared.py` checks the copies offline;
`python3 scripts/check_shared.py fetch` also checks the lock against the source repository (CI
does both). The presets in `extension/private/presets/` are shared the same way.

## What the Pterodactyl theme adds

`extension/src/target.ts` and its PHP twin `extension/app/Tokens/PterodactylTarget.php`
(`tests/parity` checks that both print the same bytes) add, after the shared output:

| Variable | From |
|---|---|
| `--lumen-console-bg`, `-surface`, `-border`, `-text`, `-muted`, `-accent` | the dark palette (`surfaceSunken`, `surface`, `border`, `text`, `textMuted`, `accent`): the console stays dark in both modes, because the terminal draws light text |
| `--lumen-logo-dark`, `--lumen-logo-light` | `branding.logoDark` / `logoLight`, one standing in for the other |

URLs are portable between themes and mapped when the stylesheet is built:

| In the token file | Served by this extension |
|---|---|
| `/lumen/brand/<file>` (shipped files) | `/extensions/lumen/brand/<file>` |
| `/storage/lumen/<file>` (uploads) | `/extensions/lumen/media/<file>` |

An upload made on one panel is a file on that panel, so an exported token file keeps the path but
the other panel needs the file too; re-upload it there or use an https URL.

## Pterodactyl palette mapping

`boot.js` maps the panel's fixed colours to these slots (defined in `public/lumen-client.css`):

| Panel colour | Slot | Role |
|---|---|---|
| grey 50, 100 | `--lp-grey-50/100` | text |
| grey 200 | `--lp-grey-200` | text mixed with muted text |
| grey 300, 400 | `--lp-grey-300/400` | muted text |
| grey 500 | `--lp-grey-500` | border mixed with muted text |
| grey 600 / 700 / 800 / 900 | `--lp-grey-600` … | raised surface / surface / page background / sunken surface |
| blue, cyan, primary | `--lp-accent-*` | accent; 50 is the text on the accent |
| red / green / yellow | `--lp-danger-*` / `--lp-success-*` / `--lp-warning-*` | status; 50 is the text on a solid status colour |
| white | `--lp-white` (text) or `--lp-white-bg` (backgrounds) | text / surface |
| black `#131a20` | `--lp-black` | console background |

Light and dark use the same mapping: roles, not colours, so the panel's dark design turns into a
light one when the light palette is active.
