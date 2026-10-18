from pathlib import Path

from streamlit.testing.v1 import AppTest

ROOT = Path(__file__).resolve().parents[1]


def test_find_gigantic_and_change_minimum(monkeypatch):
    monkeypatch.delenv("WURGERY_WORDLIST_PATHS", raising=False)
    app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=20).run()
    assert not app.exception
    assert app.text_input[0].value == "GIGANTIC"
    assert app.number_input[0].value == 4
    app.button[0].click().run()
    assert not app.exception
    table = app.dataframe[0].value
    assert "GIANT" in set(table["Target word"])
    assert "ANTIC" not in set(table["Target word"])
    assert table["Word frequency score"].is_monotonic_decreasing
    assert table["Target word"].is_unique
    import re
    for sequence in table['Transformation sequence']:
        assert all(len(chunk) >= 2 for chunk in re.findall(r'(?:transplant|excision) "([A-Z]+)"', sequence))
    app.number_input[0].set_value(5)
    app.button[0].click().run()
    assert not app.exception
    assert all(len(word) >= 5 for word in app.dataframe[0].value["Target word"])
    app.text_input[0].set_value("BAD INPUT!")
    app.button[0].click().run()
    assert not app.exception
    assert app.error


def test_empty_results(monkeypatch):
    monkeypatch.delenv("WURGERY_WORDLIST_PATHS", raising=False)
    app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=20).run()
    app.text_input[0].set_value("AAAA")
    app.button[0].click().run()
    assert not app.exception
    assert app.info
    assert not app.dataframe
