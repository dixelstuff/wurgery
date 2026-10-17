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
    ("HOSPITAL", "SHOP", "A place to browse, buy, and perhaps spend too much."),
    ("WONDERFUL", "WOLF", "A wild relative of the dog, famous for its howl."),
    ("SNOWFLAKE", "FLOW", "What a river does when nothing blocks its way."),
    ("STRAWBERRY", "STAR", "A tiny-looking light with a very big place in the sky."),
    ("HEARTBEAT", "EARTH", "Our home, all eight billion of us."),
    ("TOMORROW", "MOTOR", "The machine that gets things turning."),
    ("LANDSCAPE", "PLANE", "Your ride above the clouds."),
    ("BLUEPRINT", "BELT", "It goes around your waist and keeps things up."),
    ("CHAMPION", "COIN", "Small change that jingles in your pocket."),
    ("CHAMELEON", "LEMON", "A yellow fruit with a sharp personality."),
    ("RASPBERRY", "SPRAY", "Liquid sent out as a cloud of tiny drops."),
    ("SATELLITE", "STEEL", "The tough metal in skyscrapers and kitchen knives."),
    ("BIRTHDAY", "DAIRY", "The food group that brings you milk, cheese, and yogurt."),
    ("FIREWORKS", "FORK", "The dinner-table tool with little prongs."),
    ("WILDERNESS", "NEWS", "What's happening, hot off the press."),
    ("SANDCASTLE", "SALT", "A pinch of this makes dinner taste better."),
    ("PORCELAIN", "CORN", "Golden kernels that grow together on a cob."),
    ("SILHOUETTE", "HOUSE", "Four walls, a roof, and a place to call home."),
    ("LABYRINTH", "BATH", "A warm soak at the end of a long day."),
    ("TURQUOISE", "QUOTE", "Someone else's exact words, borrowed in your writing."),
]


def build_pack():
    dictionary = load_dictionary([ROOT / "wordlists"]).words
    puzzles = []
    for number, (source, target, clue) in enumerate(CHOICES, 1):
        # Full search ensures dictionary validity and the single-excision rule.
        solution = next(s for s in find_solutions(source, dictionary) if s.target == target)
        assert any(s.first.kind == "transplant" for s in solution.sequences)
        choices = []
        for move in transplants(source):
            for cut in excisions(move.after):
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
            "id": f"wurgery-{number:02}", "source": source, "target": target, "clue": clue,
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
