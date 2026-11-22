# Customizing

Everything is in **Admin → Extensions → Lumen**. Changes are stored in the database and applied
as CSS variables on the next page load. Nothing is rebuilt.

## The customizer

- **Presets:** Luminare (default), Graphite (neutral, no Luminare logos), Aurora and High contrast.
  A preset replaces the whole draft; nothing is saved until you press **Save**.
- **Import / Export JSON:** a `.lumen.json` file is the full token set ([tokens.md](tokens.md)).
  The same files work in the Lumen theme for Hydrodactyl. Import checks every value and lists
  the ones it replaced. **Load default** puts the Luminare preset in the draft; **Reset saved
  appearance** deletes the saved set on the server.
- **Live preview:**
  - the admin page you are on shows the draft while you edit (switch it off with
    **Apply to this page**), in the mode whose colours you are editing;
  - two samples show the client area in dark and light mode side by side;
  - **Open the client area with this draft** opens the real client area in a new tab with the
    unsaved draft. The tab follows further edits. Only your browser sees it.
- **Mode:** the default mode (system, dark or light) and whether users may switch. The toggle
  sits in the client navigation bar, on the login page and in the admin header. A user's choice
  is stored per account (table `lumen_user_preferences`) and follows them to other browsers.
  With switching off, everyone gets the default and the toggles are hidden.
- **Colours:** one palette per mode, with a colour picker and a hex field per role. Pairs below
  WCAG 2.2 AA are flagged next to the colour and listed under the preview.
- **Typography:** heading, body and code fonts, an optional font stylesheet URL, text size,
  heading weight.
- **Shape and spacing:** corner radius, spacing unit, density, shadow strength, card borders.
- **Layout:** sidebar style (floating card or flush) and width, active-item style (pill, bar,
  glow), content width and background glow. The sidebar settings apply to the admin sidebar and
  to the server navigation, which becomes a side rail on screens 1280 px and wider.
- **Branding:** product name (login page), logo for dark and light mode, favicon, login
  background. Upload PNG, JPEG, WebP, GIF, ICO or SVG up to 4 MB, or paste an https URL.
- **Custom CSS:** added after the tokens on every page.

## Uploads and SVG safety

Uploads are stored in `storage/app/lumen/` and served from `/extensions/lumen/media/<file>`.

- The file type is checked by content: raster files must decode as images, ICO files need the ICO
  header.
- SVG files are refused, not cleaned, when they contain scripts, `foreignObject`, event handlers,
  `<use>`, animations, entity or doctype declarations, `@import`, or any link or `url()` that
  does not point inside the file.
- The media route sends `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline';
  sandbox` and `X-Content-Type-Options: nosniff`, so even an SVG opened directly cannot run code.
- Files no saved token uses any more are deleted a day after the next save.

## How the theme reaches every page

Pterodactyl's client area is a React app whose components write fixed colours. Lumen's script
(`/extensions/lumen/boot.js`, loaded before the panel's bundle) rewrites each style rule once when
it is added: the panel's greys, blue, cyan, red, green, yellow, white and black become the colour
roles of the tokens, its radii the token radius, its padding the spacing unit and its fonts the
token fonts. The rewritten rules read CSS variables, so switching the mode or previewing a draft
changes the whole page at once. `lumen-client.css` adds the layout: the glass navigation bar, the
server side rail, cards, forms, the console frame, the file list and the login page.

The admin area is server-rendered AdminLTE; `lumen-admin.css` restyles it with the same variables.

## Replacing the Luminare branding

The default preset shows the Luminare mark and favicon. To use your own: upload your logos and
favicon in **Branding**, or apply the **Graphite** preset (no logos: the panel's own name and
favicon come back) and adjust the colours. The Luminare files themselves are not licensed for other
use (see NOTICE).

## Custom CSS tips

Use the variables, so your rules follow both modes and later token changes:

```css
:root[data-lumen] .my-banner {
    border: 1px solid var(--lumen-border);
    background: var(--lumen-surface-raised);
    color: var(--lumen-text);
}
:root[data-lumen][data-theme="light"] .my-banner { box-shadow: var(--shadow-md); }
```

`--lumen-<role>` exists for every colour role, plus `--lumen-gradient`, `--lumen-font-display`,
`--lumen-font-body`, `--lumen-font-mono`, `--lumen-radius`, `--radius-sm` … `--radius-3xl`,
`--spacing` and `--shadow-sm` … `--shadow-2xl`. `data-lumen-area` on `<html>` is `client` or
`admin`.

## Without the customizer

The saved set is one row in `lumen_appearance` (`key = 'active'`, column `tokens` holds the
JSON). After changing it by hand, clear the cache entry:
`php artisan cache:forget lumen:pterodactyl:appearance:v1`.
