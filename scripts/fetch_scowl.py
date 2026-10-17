"""Rebuild the bundled alphabetic word list from the pinned official source.

Python 3.12+; no third-party packages required. Run from any directory.
"""

import hashlib
from pathlib import Path
import shutil
import ssl
import subprocess
import sys
import tarfile
import tempfile
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
TAG = "rel-2026.02.25"
URL = f"https://github.com/en-wl/wordlist/archive/refs/tags/{TAG}.tar.gz"
SHA256 = "74e7cc3e9e03e609c1c74bb7e8862fcd988cdd64768dcbee4611581b7e633852"


def main():
    # Some macOS Python installs lack a system CA bundle. The app dependencies
    # provide certifi; use its trusted roots when available, keeping TLS verified.
    try:
        import certifi
    except ImportError:
        context = ssl.create_default_context()
    else:
        context = ssl.create_default_context(cafile=certifi.where())
    with tempfile.TemporaryDirectory(prefix="wurgery-scowl-") as directory:
        temp = Path(directory)
        archive = temp / "source.tar.gz"
        print(f"Downloading {URL}", flush=True)
        with urlopen(URL, timeout=60, context=context) as response, archive.open("wb") as output:
            shutil.copyfileobj(response, output)
        if hashlib.sha256(archive.read_bytes()).hexdigest() != SHA256:
            raise RuntimeError("SCOWL source checksum does not match the pinned release.")
        with tarfile.open(archive) as source:
            source.extractall(temp, filter="data")
        source_dir = temp / f"wordlist-{TAG}"
        subprocess.run([sys.executable, "combine.py", "create-db", "scowl.db"], cwd=source_dir, check=True)
        result = subprocess.run(
            [sys.executable, "scowl", "word-list", "95", "A,B,Z,C,D", "8", "--no-word-filter"],
            cwd=source_dir, check=True, capture_output=True, text=True, encoding="utf-8",
        )
        # All sizes/dialects, archaic/uncommon variants included. Level 9 is
        # explicitly invalid spellings upstream, rather than low frequency words.
        words = sorted({w.upper() for w in result.stdout.splitlines() if w.isalpha()})
        destination = ROOT / "wordlists" / "scowl"
        destination.mkdir(parents=True, exist_ok=True)
        (destination / "words.txt").write_text("\n".join(words) + "\n", encoding="utf-8")
        shutil.copyfile(source_dir / "Copyright", destination / "Copyright")
        print(f"Saved {len(words):,} alphabetic words to {destination / 'words.txt'}")


if __name__ == "__main__":
    main()
