"""Validate the saved collection without printing answer spoilers."""

from difflib import SequenceMatcher
import json
from pathlib import Path

from wurgery.dictionary import load_dictionary
from wurgery.engine import Operation, Sequence

ROOT = Path(__file__).resolve().parents[1]


def test_curated_collection_is_valid_and_visually_distinct():
    puzzles = json.loads((ROOT / "game" / "puzzles.json").read_text())
    dictionary = load_dictionary([ROOT / "wordlists"]).words
    assert len(puzzles) == 30
    assert len({p['id'] for p in puzzles}) == 30
    assert len({p['source'] for p in puzzles}) == 30
    assert len({p['target'] for p in puzzles}) == 30
    for p in puzzles:
        assert 7 <= len(p['source']) <= 9
        assert 5 <= len(p['target']) <= 7
        assert p['source'] in dictionary and p['target'] in dictionary
        assert p['frequency'] >= 4
        assert SequenceMatcher(None, p['source'], p['target']).ratio() <= .7
        assert p['target'] not in p['source']
        assert p['clue'] and p['target'].lower() not in p['clue'].lower()
        sequence = Sequence(Operation(**p['solution']['transplant']), Operation(**p['solution']['excision']))
        assert sequence.first.kind == 'transplant' and sequence.second.kind == 'excision'
        assert sequence.first.end - sequence.first.start >= 2
        assert sequence.second.end - sequence.second.start >= 2
        assert sequence.verify(p['source'], p['target'])
        # Independent list deletion for the single-excision exclusion.
        for start in range(len(p['source'])):
            for width in range(1, len(p['source']) - start + 1):
                letters = list(p['source'])
                for _ in range(width):
                    letters.pop(start)
                assert ''.join(letters) != p['target']
        assert p['retained_transplanted_letters'] > 0
