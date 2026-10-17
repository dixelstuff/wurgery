from pathlib import Path

import pytest

from wurgery.dictionary import load_dictionary


def test_combine_all_lengths_variants_obscure_words_and_filter(tmp_path):
    (tmp_path / "nested").mkdir()
    (tmp_path / "a.txt").write_text("\ufeffa\nI\ncolour\ncolor\nxyst\ncat\nCAT\ncan't\nwell-being\n2\ntwo words\n", encoding="utf-8")
    second = tmp_path / "nested" / "b.words"
    second.write_text("cat\n pneumonoultramicroscopicsilicovolcanoconiosis \ncafé\n", encoding="utf-8")
    result = load_dictionary([tmp_path, second])
    assert result.words == {"A", "I", "COLOUR", "COLOR", "XYST", "CAT", "CAFÉ",
                            "PNEUMONOULTRAMICROSCOPICSILICOVOLCANOCONIOSIS"}
    assert len(result.files) == 2
    assert result.rejected_entries == 4


def test_bad_dictionary_paths(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_dictionary([tmp_path / "missing"])
    with pytest.raises(ValueError):
        load_dictionary([tmp_path])
    (tmp_path / "empty.txt").write_text("123\n")
    with pytest.raises(ValueError):
        load_dictionary([tmp_path])
