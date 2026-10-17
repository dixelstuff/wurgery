"""Oracle uses deletion masks and adjacent-block swaps, not production moves."""

from itertools import product

import pytest

from wurgery.engine import Operation, find_solutions, transplants


def reference_deletions(text):
    results = set()
    for mask in product((False, True), repeat=len(text)):
        removed = [i for i, bit in enumerate(mask) if bit]
        if removed and removed == list(range(removed[0], removed[-1] + 1)):
            results.add("".join(c for c, delete in zip(text, mask) if not delete))
    return results


def reference_moves(text):
    # Moving a block is equivalent to swapping two adjacent nonempty blocks.
    results = set()
    for a in range(len(text)):
        for b in range(a + 1, len(text)):
            for c in range(b + 1, len(text) + 1):
                changed = text[:a] + text[b:c] + text[a:b] + text[c:]
                if changed != text:
                    results.add(changed)
    return results


def reference_targets(text):
    deletion_only = reference_deletions(text)
    transplant_first = set().union(*(reference_deletions(s) for s in reference_moves(text)))
    excision_first = set().union(*(reference_moves(s) for s in deletion_only))
    return {
        "transplant → excision": transplant_first - deletion_only - {""},
        "excision → transplant": excision_first - deletion_only - {""},
    }


def independent_replay(op):
    # Mutate indexed lists to check source/destination boundaries independently.
    letters = list(op.before)
    assert 0 <= op.start < op.end <= len(letters)
    cut = []
    for _ in range(op.end - op.start):
        cut.append(letters.pop(op.start))
    if op.kind == "transplant":
        assert 0 <= op.destination <= len(letters)
        for offset, letter in enumerate(cut):
            letters.insert(op.destination + offset, letter)
    else:
        assert op.kind == "excision" and op.destination is None
    result = "".join(letters)
    assert result == op.after and result != op.before
    return result


@pytest.mark.parametrize("alphabet,max_length", [("AB", 7), ("ABC", 4)])
def test_exhaustive_completeness_and_witnesses(alphabet, max_length):
    dictionary = {"".join(chars) for n in range(1, max_length)
                  for chars in product(alphabet, repeat=n)}
    for n in range(1, max_length + 1):
        for chars in product(alphabet, repeat=n):
            source = "".join(chars)
            expected = reference_targets(source)
            solutions = find_solutions(source, dictionary, min_length=1)
            actual = {order: set() for order in expected}
            assert len({s.target for s in solutions}) == len(solutions)
            for solution in solutions:
                assert solution.target in dictionary
                assert solution.target not in reference_deletions(source)
                for seq in solution.sequences:
                    assert {seq.first.kind, seq.second.kind} == {"transplant", "excision"}
                    assert seq.first.before == source
                    assert independent_replay(seq.first) == seq.second.before
                    assert independent_replay(seq.second) == solution.target
                    actual[seq.order].add(solution.target)
            assert actual == expected, source


def test_noop_moves_with_repeated_letters_and_boundary_moves():
    assert list(transplants("AAAA")) == []
    assert {op.after for op in transplants("ABBA")} == reference_moves("ABBA")
    for word in ("ABC", "AABA", "GIGANTIC"):
        for op in transplants(word):
            assert op.verify()
            independent_replay(op)
    assert not Operation("transplant", "AAA", "AAA", 0, 1, 2).verify()
    assert not Operation("excision", "AB", "AB", 1, 1).verify()
    assert not Operation("transplant", "AB", "BA", 0, 1, 3).verify()


def test_gigantic_regression_and_minimum():
    words = {"GIANT", "ANTIC", "TANG", "GAIN", "GAIT", "ACING", "GIGANTIC", "ZZZZ"}
    solutions = find_solutions(" gigantic ", words)
    targets = {s.target for s in solutions}
    assert targets == {"GIANT"}
    assert "ANTIC" not in targets  # Remove GIG in one excision.
    assert "GIGANTIC" not in targets and "ZZZZ" not in targets
    assert all(len(s.target) >= 5 for s in find_solutions("GIGANTIC", words, 5))
    assert find_solutions("GIGANTIC", words, 9) == []


@pytest.mark.parametrize("source", ["", "a b", "ABC1", "can't"])
def test_invalid_source(source):
    with pytest.raises(ValueError):
        find_solutions(source, {"A"})


@pytest.mark.parametrize("minimum", [0, -1, 2.5, True])
def test_invalid_minimum(minimum):
    with pytest.raises(ValueError):
        find_solutions("ABC", {"A"}, minimum)
