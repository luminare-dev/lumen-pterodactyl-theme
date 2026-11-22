# Installing

Lumen is a [Blueprint](https://blueprint.zip) extension: one file, `lumen.blueprint`, that
Blueprint installs into a Pterodactyl Panel. It adds its own files only and needs no frontend
rebuild, so installing takes seconds.

## Supported versions

| Component | Tested with (CI) | Supported |
|---|---|---|
| Pterodactyl Panel | v1.15.2 (tag commit `90b2aa8`, image digest in `ci/versions.env`) | v1.15.x |
| Blueprint | beta-2026-08 (commit `00de3ba`, `release.zip` sha256 in `ci/versions.env`) | beta-2026-08 and later betas that keep the extension format |
| Database | MariaDB 10.11 | MySQL 8 / MariaDB 10.3 or newer (what Pterodactyl supports) |

Blueprint is required. Lumen uses Blueprint's wrappers to add its stylesheet and script to every
page, Blueprint's router for the mode and logo endpoints, and Blueprint's admin page for the
customizer. A manual install without Blueprint would mean patching Pterodactyl's own templates
and routes, which every panel update overwrites, so there is no such path.

## Before you start: back up

Take a backup you can restore before you install, update or remove anything:

```bash
cd /var/www/pterodactyl                          # your panel directory
tar -czf ~/panel-files-$(date +%F).tar.gz --exclude=node_modules .
mysqldump --single-transaction panel > ~/panel-db-$(date +%F).sql
```

If Blueprint is not installed yet, follow
[Blueprint's installation guide](https://blueprint.zip/guides/admin/install) first (it rebuilds
the panel frontend once).

## Install

1. Download `lumen.blueprint` from the latest release, or from the `lumen-blueprint` artifact of a
   green `panel` workflow run.
2. Put it into the panel directory and install it:

   ```bash
   cd /var/www/pterodactyl
   blueprint -install lumen
   ```

Blueprint copies the files, runs the migration (tables `lumen_appearance` and
`lumen_user_preferences`) and clears the caches. Open **Admin → Extensions → Lumen** to customize.
Until you save there, the panel uses the Luminare preset.

With Blueprint's Docker image, put the file into the extensions folder you mounted
(`/blueprint_extensions`) and run `docker compose exec panel blueprint -install lumen`.

### What gets installed

| Where in the panel | What |
|---|---|
| `.blueprint/extensions/lumen/` | the extension (public files, presets, the admin page) |
| `public/extensions/lumen/` | link to the public files: stylesheets, scripts, Sora font, Luminare logos |
| `app/BlueprintFramework/Extensions/lumen/` | link to the PHP classes (token compiler, repository, controllers) |
| `resources/views/blueprint/*/wrappers/lumen.blade.php` | the head added to client and admin pages |
| `routes/blueprint/web/lumen.php` | `POST /extensions/lumen/mode`, `GET /extensions/lumen/media/{file}` |
| database | `lumen_appearance`, `lumen_user_preferences` |
| `storage/app/lumen/` | uploaded logos, favicon and login background (created on the first upload) |

## Update

Download the new `lumen.blueprint` and run `blueprint -install lumen` again. Blueprint replaces
the extension's files; the saved appearance, the users' modes and the uploads stay (they are in
the database and in `storage/app/lumen/`).

When you update Pterodactyl or Blueprint, follow their update guides; Blueprint reinstalls its
extensions. Check the client and admin area afterwards, and the
[supported versions](#supported-versions) table for what CI has tested.

## Uninstall

```bash
cd /var/www/pterodactyl
blueprint -remove lumen
```

The panel goes back to its own look immediately. Blueprint leaves the database tables and the
uploads in place, so a later install keeps your appearance. To delete them as well:

```bash
mysql panel -e 'DROP TABLE lumen_user_preferences, lumen_appearance;
  DELETE FROM migrations WHERE migration = "2026_11_22_000001_create_lumen_appearance_tables";'
rm -rf storage/app/lumen
php artisan cache:clear
```

## Troubleshooting

- **The panel looks unchanged:** check that Blueprint's extension settings (the gear on the Lumen
  page) allow the admin and dashboard wrappers, then clear the browser cache.
- **Admin pages appear after a short delay:** the admin stylesheet waits up to 0.8 s for the
  Lumen head. If the wrappers are blocked, that delay is all you see; allow them again or remove
  the extension.
- **A saved appearance seems ignored:** the compiled set is cached; run
  `php artisan cache:forget lumen:pterodactyl:appearance:v1`.
