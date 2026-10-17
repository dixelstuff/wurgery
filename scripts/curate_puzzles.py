"""Reproduce the hand-picked starter pack. Contains answer spoilers internally."""

from dataclasses import asdict
from difflib import SequenceMatcher
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from wordfreq import zipf_frequency
from wurgery.dictionary import load_dictionary
from wurgery.engine import Sequence, excisions, find_solutions, transplants

# Editorial choices after exploring 80+ familiar starting words. Clues define
# the intended answer; other dictionary outcomes are not accepted by the game.
CHOICES = [
    ("RAINBOWS", "BRAIN", "Your body's thinking centre."),
    ("FOOTBALL", "BALLOT", "The paper you mark to cast your vote."),
    ("SAPPHIRE", "SHAPE", "A circle, a square, or a triangle."),
    ("WRESTLING", "WINGS", "What birds spread before taking off."),
    ("ADVENTURE", "NATURE", "The world of forests, rivers, and wild things."),
    ("SUNFLOWER", "OWNER", "The person something belongs to."),
    ("CARTWHEEL", "CHART", "A picture that turns numbers into a story."),
    ("PARACHUTE", "TEACH", "Help someone learn something new."),
    ("SINGULAR", "SUGAR", "A sweet addition to tea."),
    ("BOUNDARY", "AROUND", "In a circle, or somewhere nearby."),
]


def build_pack():
    dictionary = load_dictionary([ROOT / "wordlists"]).words
    puzzles = []
    for number, (source, target, clue) in enumerate(CHOICES, 1):
        # Full search ensures dictionary validity and the single-excision rule.
        solution = next(s for s in find_solutions(source, dictionary, min_length=5, min_chunk_length=2) if s.target == target)
        assert any(s.first.kind == "transplant" for s in solution.sequences)
        choices = []
        for move in transplants(source, 2):
            for cut in excisions(move.after, 2):
                if cut.after != target:
                    continue
                width = move.end - move.start
                overlap = max(0, min(move.destination + width, cut.end) - max(move.destination, cut.start))
                kept = width - overlap
                if kept:
                    choices.append(((overlap > 0, width, -kept), Sequence(move, cut), kept))
        _, witness, retained = min(choices, key=lambda choice: choice[0])
        assert witness.verify(source, target)
        puzzles.append({
            "id": f"wurgery-chunks2-{number:02}", "source": source, "target": target, "clue": clue,
            "frequency": zipf_frequency(target.lower(), "en"),
            "visual_similarity": round(SequenceMatcher(None, source, target).ratio(), 3),
            "retained_transplanted_letters": retained,
            "solution": {"transplant": asdict(witness.first), "excision": asdict(witness.second)},
        })
    return puzzles


def main():
    puzzles = build_pack()
    (ROOT / "game" / "puzzles.json").write_text(json.dumps(puzzles, indent=2) + "\n")
    print(f"Saved {len(puzzles)} verified puzzles. Answers are only in the internal puzzle data.")


if __name__ == "__main__":
    main()
