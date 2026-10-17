from wurgery.engine import find_solutions
from wurgery.scoring import result_rows


def test_zero_frequency_words_retained_and_sorted(monkeypatch):
    solutions = find_solutions("ABCDE", {"BCA", "CAB"}, 1)
    assert len(solutions) == 2
    monkeypatch.setattr("wurgery.scoring.zipf_frequency", lambda word, language: {"bca": 0, "cab": 4}[word])
    rows = result_rows(solutions)
    assert [r["Target word"] for r in rows] == ["CAB", "BCA"]
    assert rows[-1]["Word frequency score"] == 0
