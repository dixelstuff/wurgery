"""Pure search engine; dictionary membership never depends on frequency.

Indices are zero-based, end-exclusive. A transplant's destination is a gap
in the remainder AFTER its source chunk has been removed.
"""

from dataclasses import dataclass
from collections.abc import Iterable, Iterator
from typing import Literal

Kind = Literal["transplant", "excision"]
Order = Literal["transplant → excision", "excision → transplant"]
ORDERS: tuple[Order, ...] = ("transplant → excision", "excision → transplant")


def normalize_word(word: str) -> str:
    word = word.strip()
    if not word or not word.isalpha():
        raise ValueError("Enter a word containing letters only.")
    return word.upper()


@dataclass(frozen=True)
class Operation:
    kind: Kind
    before: str
    after: str
    start: int
    end: int
    destination: int | None = None

    @property
    def chunk(self) -> str:
        return self.before[self.start:self.end]

    def verify(self) -> bool:
        if not 0 <= self.start < self.end <= len(self.before) or self.end - self.start < 2:
            return False
        remainder = self.before[:self.start] + self.before[self.end:]
        if self.kind == "excision":
            expected = remainder
            if self.destination is not None:
                return False
        elif self.kind == "transplant":
            d = self.destination
            if d is None or not 0 <= d <= len(remainder):
                return False
            expected = remainder[:d] + self.chunk + remainder[d:]
        else:
            return False
        return self.after == expected and self.after != self.before

    def describe(self) -> str:
        action = f'{self.kind} "{self.chunk}" [{self.start}:{self.end}]'
        if self.kind == "transplant":
            action += f" to remainder gap {self.destination}"
        return f"{action} → {self.after}"


@dataclass(frozen=True)
class Sequence:
    first: Operation
    second: Operation

    @property
    def order(self) -> Order:
        return f"{self.first.kind} → {self.second.kind}"

    def verify(self, source: str, target: str) -> bool:
        return (
            {self.first.kind, self.second.kind} == {"transplant", "excision"}
            and self.first.before == source
            and self.first.after == self.second.before
            and self.second.after == target
            and self.first.verify() and self.second.verify()
            and 0 < len(target) < len(source)
        )

    def describe(self) -> str:
        return f"{self.first.before} — {self.first.describe()} — {self.second.describe()}"


@dataclass(frozen=True)
class Solution:
    target: str
    # One witness per achievable order. The target still appears only once.
    sequences: tuple[Sequence, ...]


def validate_chunk_minimum(minimum: int) -> None:
    if isinstance(minimum, bool) or not isinstance(minimum, int) or minimum < 2:
        raise ValueError("Minimum chunk length must be an integer of at least two letters.")


def excisions(word: str, min_chunk_length: int = 2) -> Iterator[Operation]:
    validate_chunk_minimum(min_chunk_length)
    for start in range(len(word)):
        for end in range(start + min_chunk_length, len(word) + 1):
            yield Operation("excision", word, word[:start] + word[end:], start, end)


def transplants(word: str, min_chunk_length: int = 2) -> Iterator[Operation]:
    validate_chunk_minimum(min_chunk_length)
    # Equal output strings share the same possible second operations, so one
    # representative is sufficient, even when repeated letters create aliases.
    seen: set[str] = set()
    for length in range(min_chunk_length, len(word) + 1):
        for start in range(len(word) - length + 1):
            end = start + length
            chunk = word[start:end]
            remainder = word[:start] + word[end:]
            for destination in range(len(remainder) + 1):
                moved = remainder[:destination] + chunk + remainder[destination:]
                if moved != word and moved not in seen:
                    seen.add(moved)
                    yield Operation("transplant", word, moved, start, end, destination)


def find_solutions(source: str, dictionary: Iterable[str], min_length: int = 4,
                   min_chunk_length: int = 2) -> list[Solution]:
    source = normalize_word(source)
    if isinstance(min_length, bool) or not isinstance(min_length, int) or min_length < 1:
        raise ValueError("Minimum target length must be a positive integer.")
    validate_chunk_minimum(min_chunk_length)
    words = {normalize_word(w) for w in dictionary}
    # Exclude even one-letter-only deletions without exposing them as options.
    excluded = {source[:start] + source[end:]
                for start in range(len(source)) for end in range(start + 1, len(source) + 1)}
    found: dict[str, dict[Order, Sequence]] = {}
    for first_generator, second_generator in (
        (transplants, excisions), (excisions, transplants),
    ):
        seen_intermediates: set[str] = set()
        for first in first_generator(source, min_chunk_length):
            if len(first.after) < min_length or first.after in seen_intermediates:
                continue
            seen_intermediates.add(first.after)
            for second in second_generator(first.after, min_chunk_length):
                target = second.after
                if len(target) < min_length or target not in words or target in excluded:
                    continue
                sequence = Sequence(first, second)
                if not sequence.verify(source, target):
                    raise RuntimeError("Search generated an invalid sequence.")
                found.setdefault(target, {}).setdefault(sequence.order, sequence)
    return [Solution(target, tuple(by_order[o] for o in ORDERS if o in by_order))
            for target, by_order in sorted(found.items())]
