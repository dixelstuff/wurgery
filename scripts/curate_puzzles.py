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
    ("TREASURE", "TEARS", "They can fall when you're happy or sad."),
    ("DANGEROUS", "RANGE", "The distance between the lowest and highest."),
    ("ASTRONAUT", "START", "The opposite of the finish."),
    ("CROISSANT", "SAINT", "A person celebrated for a holy life."),
    ("LANGUAGE", "ANGEL", "A heavenly messenger with wings."),
    ("MYSTERIES", "MERIT", "A quality that deserves praise or reward."),
    ("NIGHTFALL", "FIGHT", "A clash between opponents."),
    ("MOUNTAINS", "AMOUNT", "How much of something there is."),
    ("CHRISTMAS", "CRASH", "A sudden collision, or the noise it makes."),
    ("DISTANCE", "STAND", "Be on your feet."),
    ("RAINBOWS", "BRAIN", "Your built-in control centre."),
    ("FIREPLACE", "PEACE", "What a truce is meant to bring."),
    ("TANGERINE", "ENGINE", "It turns fuel into forward motion."),
    ("CLARINET", "CLEAR", "How a view looks once the mist has lifted."),
    ("PARACHUTE", "TEACH", "Help someone turn confusion into understanding."),
    ("DISCOVERY", "COVERS", "They keep a book's story under wraps."),
    ("MILESTONE", "SMILE", "A welcome you can give without saying a word."),
    ("ADVENTURE", "NATURE", "The world beyond what humans have built."),
    ("SAPPHIRE", "SHAPE", "What a silhouette reveals, even without detail."),
    ("TRUMPETS", "TRUST", "It can take years to build and seconds to lose."),
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
            "id": f"wurgery-collection3-{number:02}", "source": source, "target": target, "clue": clue,
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
