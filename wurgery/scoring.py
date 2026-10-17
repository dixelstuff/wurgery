"""Familiarity is a presentation concern, never a search constraint."""

from collections.abc import Iterable
from wordfreq import zipf_frequency

from .engine import Solution


def result_rows(solutions: Iterable[Solution]) -> list[dict]:
    rows = [
        {
            "Target word": solution.target,
            "Word frequency score": zipf_frequency(solution.target.lower(), "en"),
            "Operation order": " / ".join(seq.order for seq in solution.sequences),
            "Transformation sequence": "\n".join(seq.describe() for seq in solution.sequences),
        }
        for solution in solutions
    ]
    return sorted(rows, key=lambda row: (-row["Word frequency score"], row["Target word"]))
