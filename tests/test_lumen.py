"""Lumen extension checks that need only php, node and bash (no panel, no packages)."""

import json
import re
import shutil
import subprocess
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXT = ROOT / "extension"
NODE = ["node", "--experimental-strip-types", "--no-warnings"]


def run(cmd):
    return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, check=False)


def node_ok() -> bool:
    if not shutil.which("node"):
        return False
    m = re.match(r"v(\d+)\.(\d+)", run(["node", "--version"]).stdout)
    return bool(m) and (int(m.group(1)), int(m.group(2))) >= (22, 13)


HAS_NODE = node_ok()
HAS_PHP = bool(shutil.which("php"))


class Shared(unittest.TestCase):
    def test_shared_code_matches_the_lock(self):
        result = run(["python3", "scripts/check_shared.py", "verify"])
        self.assertEqual(result.returncode, 0, result.stderr)


@unittest.skipUnless(HAS_PHP and HAS_NODE, "needs php and node >= 22.13")
class Parity(unittest.TestCase):
    def test_php_and_typescript_compile_the_same_css(self):
        php = run(["php", "tests/parity/run.php"])
        node = run(NODE + ["tests/parity/run.mts"])
        self.assertEqual(php.returncode, 0, php.stderr)
        self.assertEqual(node.returncode, 0, node.stderr)
        a, b = json.loads(php.stdout), json.loads(node.stdout)
        self.assertEqual(sorted(a["presets"]), sorted(b["presets"]))
        for name in a["presets"]:
            self.assertEqual(a["presets"][name], b["presets"][name], name)
        for name in a["cases"]:
            self.assertEqual(a["cases"][name], b["cases"][name], name)

    def test_presets_are_valid_and_pass_contrast(self):
        result = run(NODE + ["tests/parity/contrast.mts"])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_markup_never_reaches_the_stylesheet(self):
        data = json.loads(run(["php", "tests/parity/run.php"]).stdout)
        for name, case in data["cases"].items():
            self.assertNotIn("</style", case["css"].lower(), name)

    def test_token_urls_map_to_the_extension(self):
        data = json.loads(run(["php", "tests/parity/run.php"]).stdout)
        css = data["presets"]["luminare"]["css"]
        self.assertIn('url("/extensions/lumen/brand/', css)
        self.assertNotIn('url("/lumen/brand/', css)


@unittest.skipUnless(HAS_NODE, "needs node >= 22.13")
class Scripts(unittest.TestCase):
    def test_palette_mapping(self):
        result = run(["node", "tests/js/boot-palette.mjs"])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_browser_scripts_parse(self):
        for path in ["extension/public/boot.js", "ci/playwright/screenshots.mjs"]:
            result = run(["node", "--check", path])
            self.assertEqual(result.returncode, 0, f"{path}: {result.stderr}")

    def test_build_and_package(self):
        out = ROOT / "dist" / "test"
        self.assertEqual(run(["node", "--no-warnings", "scripts/build-js.mjs"]).returncode, 0)
        for path in ["extension/public/js/core.js", "extension/public/js/target.js", "extension/public/editor.js"]:
            result = run(["node", "--check", path])
            self.assertEqual(result.returncode, 0, f"{path}: {result.stderr}")
        result = run(["python3", "scripts/build_blueprint.py", "--out", str(out)])
        self.assertEqual(result.returncode, 0, result.stderr)
        with zipfile.ZipFile(out / "lumen.blueprint") as zf:
            names = zf.namelist()
            self.assertIn("conf.yml", names)
            self.assertFalse(any(n.startswith("src/") for n in names))
            conf = zf.read("conf.yml").decode()
        self.assertIn('identifier: "lumen"', conf)
        self.assertIn("ignorePlaceholders", conf)
        shutil.rmtree(out)


class Files(unittest.TestCase):
    def test_php_files_parse(self):
        if not HAS_PHP:
            self.skipTest("needs php")
        for path in list(EXT.rglob("*.php")) + [ROOT / "ci" / "seed.php"]:
            result = run(["php", "-l", str(path)])
            self.assertEqual(result.returncode, 0, result.stdout)

    def test_conf_names_existing_files(self):
        conf = (EXT / "conf.yml").read_text(encoding="utf-8")
        for value in re.findall(r':\s*"([^"]+\.(?:php|css|svg))"', conf):
            self.assertTrue((EXT / value).is_file(), value)
        for value in re.findall(r'(?:directory|public|views|app|migrations):\s*"([^"]+)"', conf):
            self.assertTrue((EXT / value).is_dir(), value)

    def test_conf_version_matches_version_txt(self):
        conf = (EXT / "conf.yml").read_text(encoding="utf-8")
        version = re.search(r'version:\s*"([^"]+)"', conf).group(1)
        manifest = json.loads((ROOT / ".release-please-manifest.json").read_text() or "{}")
        expected = manifest.get(".", "0.1.0")
        self.assertEqual(version, expected if expected != "0.0.0" else version)

    def test_every_preset_names_itself(self):
        for path in (EXT / "private" / "presets").glob("*.json"):
            data = json.loads(path.read_text(encoding="utf-8"))
            self.assertTrue(data["meta"]["name"], path.name)

    def test_no_copied_theme_names(self):
        # Lumen is written from scratch; commercial themes are only a quality bar.
        for path in EXT.rglob("*"):
            if path.is_file() and path.suffix in {".js", ".css", ".php", ".ts", ".yml"}:
                text = path.read_text(encoding="utf-8", errors="replace").lower()
                for word in ("nebula", "slate theme"):
                    self.assertNotIn(word, text, f"{path}: {word}")


if __name__ == "__main__":
    unittest.main()
