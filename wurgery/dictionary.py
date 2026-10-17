"""Combine plain text word lists, one entry per line, without frequency filtering."""

from dataclasses import dataclass
from pathlib import Path
from collections.abc import Iterable

SUFFIXES = {".txt", ".dic", ".list", ".words"}


@dataclass(frozen=True)
class Dictionary:
    words: frozenset[str]
    files: tuple[Path, ...]
    rejected_entries: int


def discover_files(paths: Iterable[str | Path]) -> tuple[Path, ...]:
    files: set[Path] = set()
    for item in paths:
        path = Path(item).expanduser().resolve()
        if not path.exists():
            raise FileNotFoundError(f"Dictionary path does not exist: {path}")
        if path.is_dir():
            files.update(p for p in path.rglob("*") if p.is_file() and p.suffix.lower() in SUFFIXES)
        elif path.is_file():
            files.add(path)
    return tuple(sorted(files))


def load_dictionary(paths: Iterable[str | Path]) -> Dictionary:
    files = discover_files(paths)
    if not files:
        raise ValueError("No word lists found. Add one-entry-per-line .txt files to wordlists/.")
    words: set[str] = set()
    rejected = 0
    for path in files:
        with path.open(encoding="utf-8-sig") as stream:
            for line in stream:
                entry = line.strip()
                if entry and entry.isalpha():
                    words.add(entry.upper())
                elif entry:
                    rejected += 1
    if not words:
        raise ValueError("The word lists contain no alphabetic entries.")
    return Dictionary(frozenset(words), files, rejected)
