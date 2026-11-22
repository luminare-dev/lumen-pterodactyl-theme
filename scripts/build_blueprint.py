#!/usr/bin/env python3
"""Package extension/ as dist/lumen.blueprint (the file `blueprint -install lumen` reads).

A .blueprint file is a zip archive with conf.yml at its root. The archive is reproducible: files
are sorted and get a fixed timestamp and mode. extension/src/ (the TypeScript sources) is left
out; run `node scripts/build-js.mjs` first, so extension/public/js/ holds the built modules.
The version in conf.yml is checked against version.txt unless --version is given.

Usage: python3 scripts/build_blueprint.py [--out dist] [--version 0.1.0]
Python standard library only.
"""

from __future__ import annotations

import argparse
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXT = ROOT / "extension"
EXCLUDE_DIRS = {"src"}
REQUIRED = [
    "conf.yml",
    "admin/view.blade.php",
    "admin/controller.php",
    "public/boot.js",
    "public/editor.js",
    "public/js/core.js",
    "public/js/target.js",
    "private/presets/luminare.json",
]
STAMP = (2026, 1, 1, 0, 0, 0)


def files() -> list[Path]:
    out = []
    for path in sorted(EXT.rglob("*")):
        rel = path.relative_to(EXT)
        if path.is_dir() or rel.parts[0] in EXCLUDE_DIRS or path.name.startswith(".") or "__pycache__" in rel.parts:
            continue
        out.append(path)
    return out


def conf_version() -> str:
    m = re.search(r'^\s*version:\s*"([^"]+)"', (EXT / "conf.yml").read_text(encoding="utf-8"), re.M)
    if not m:
        raise SystemExit("error: no info.version in extension/conf.yml")
    return m.group(1)


def build(out_dir: Path, version: str | None) -> Path:
    missing = [p for p in REQUIRED if not (EXT / p).is_file()]
    if missing:
        raise SystemExit("error: missing " + ", ".join(missing) + " (run node scripts/build-js.mjs first?)")
    conf = (EXT / "conf.yml").read_text(encoding="utf-8")
    current = conf_version()
    if version and version != current:
        conf = re.sub(r'(^\s*version:\s*")[^"]+(")', rf"\g<1>{version}\g<2>", conf, count=1, flags=re.M)
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / "lumen.blueprint"
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for path in files():
            rel = path.relative_to(EXT).as_posix()
            info = zipfile.ZipInfo(rel, STAMP)
            info.external_attr = (0o755 if path.suffix == ".sh" else 0o644) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            data = conf.encode() if rel == "conf.yml" else path.read_bytes()
            zf.writestr(info, data)
    return target


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=ROOT / "dist")
    parser.add_argument("--version", help="write this version into the packaged conf.yml")
    args = parser.parse_args(argv)
    target = build(args.out, args.version)
    print(f"{target.relative_to(ROOT) if target.is_relative_to(ROOT) else target} ({target.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
