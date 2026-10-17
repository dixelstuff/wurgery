# Wurgery — Python Puzzle Explorer

An exhaustive explorer for a word puzzle mechanic, plus a playable local game
with 20 hand-picked puzzles. The explorer searches both operation orders; the
game always uses transplant first and excision second.

## Play the game — no spoilers

```sh
python3 play.py
```

Open http://127.0.0.1:8502. The game uses only Python's standard library to serve
its local HTML, CSS and JavaScript, with no build step or external services.

1. Highlight neighboring letters by dragging across them, or clicking the first
   and last letter. Drag that highlighted green chunk to a new gap.
2. The moved letters keep a green underline. Highlight a second chunk and drag
   it onto the red ✂️ excision tray. The remaining word must match the clue.
3. Reset is always available. After an incorrect cut, **Try another cut** keeps
   the transplant in place. Navigate between all 20 puzzles with the arrows or
   numbered picker. Solved progress is saved in this browser's local storage.

For an alternative to dragging, click a green insertion gap, then select the
second chunk and click the scalpel. Keyboard users can select letters with
Space/Enter, extend with Shift+Left/Right, and Tab to insertion gaps or the
scalpel. Escape clears the current selection.

The collection uses familiar answers and distinct transformations from 8–11
letter starting words, each with a short clue and a verified two-operation
witness. It never displays a suggested answer or solution before you solve it.
Any legal sequence to the intended answer is accepted. The puzzle data and
curation script contain spoilers internally; they are not needed to play.

Run the game-rule tests with `node --test tests/game-model.test.mjs` (Node 18+),
and the Python checks with `python -m pytest -q`. Browser QA uses separate
synthetic puzzles, keeping the real collection unplayed.

## Run locally

Python 3.12 or newer is recommended. From this folder:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m streamlit run app.py --server.address 127.0.0.1 --browser.gatherUsageStats false
```

Open http://localhost:8501, enter a word and click **Find Solutions**. Minimum
target length defaults to four and can be lowered to one. Results are sorted by
the English `wordfreq.zipf_frequency` score, then alphabetically for ties. A score
of zero remains in the results. The score is an estimate of familiarity rather
than a definition of validity.

Dependencies were verified with Python 3.14, Streamlit 1.66.0, wordfreq 3.1.1 and
pytest 9.1.1. Exact verified dependency versions are recorded in
`requirements-lock.txt`.

## Dictionary

The initially empty project now includes **284,019** unique alphabetic entries
from the official SCOWL / English Speller Database release `rel-2026.02.25`.
Every available size is included, together with American, British, Canadian,
Australian and unmarked spellings, and archaic/uncommon variants. Upstream
explicitly invalid spellings are excluded. Alphabetic proper names and
abbreviations remain included. See [provenance and reproduction instructions](wordlists/scowl/SOURCE.md)
and the [upstream license notices](wordlists/scowl/Copyright).

Drop additional UTF-8 word-list files or folders inside `wordlists/`. Use one
entry per line; `.txt`, `.dic`, `.list` and `.words` files are discovered
recursively. Lists are merged, uppercased and deduplicated without a length or
frequency cutoff. Surrounding whitespace and UTF-8 BOMs are handled. Any entry
containing a non-alphabetic character is rejected in full, so punctuation is
never silently removed. Unicode alphabetic entries are accepted; accents are
preserved. Case normalization uses Python's uppercase rules.

To add folders outside the project, set `WURGERY_WORDLIST_PATHS` to a list of
paths separated by your platform's path separator (`:` on macOS/Linux):

```sh
export WURGERY_WORDLIST_PATHS="/path/to/first/folder:/path/to/second.txt"
python -m streamlit run app.py --server.address 127.0.0.1
```

Additional lists supplement the bundled SCOWL file. Add/remove lists before the
next search; path, file size and modification time changes invalidate the
dictionary cache. Lists have no headers or frequency columns. Hunspell affix
flags and SCOWL database syntax must be exported to plain entries first.
The bundled list works offline; rebuilding it requires a download:

```sh
python scripts/fetch_scowl.py
```

## Exact operation rules

A transplant cuts a nonempty contiguous substring and inserts it at any gap in
the remaining string, preserving its internal order. A move is rejected if the
result equals the input, even when different letter occurrences were moved.
An excision removes a nonempty contiguous substring. Each operation acts on the
string produced by the preceding operation. Intermediate strings need not be
dictionary words, and the starting word need not be in the dictionary.

The engine enumerates both operation orders and checks every resulting string
against the complete dictionary. It then excludes **all** targets reachable by
a single excision of the original word, even if a two-operation sequence exists.
A transplant alone cannot shorten a string, so the remaining targets require
both kinds of operation under these rules.

Targets appear once. Each stores a verified witness for every achievable order,
with both shown in the same row when applicable. Equivalent intermediate strings
can be collapsed safely: their possible next operations depend only on the
string. Shorter transplanted chunks are considered first to favor readable
witnesses. Search never uses a word-frequency threshold or early result limit.
Long starting words take longer because enumeration grows polynomially (a loose
upper bound is O(n⁶) including string construction); no length cap is imposed.

Displayed `[start:end]` indices are zero-based and end-exclusive in that
operation's input. A transplant destination is a gap in the remainder **after**
removing its chunk: gap zero is before the first letter, and gap `len(remainder)`
is after the last letter.

## GIGANTIC demonstration

The default dictionary and minimum length four produce these eight targets:

| Target | Word frequency score | Order |
| --- | ---: | --- |
| ANTI | 5.01 | Transplant → excision |
| GIANT | 4.62 | Transplant → excision |
| GANG | 4.50 | Transplant → excision |
| CANT | 4.35 | Transplant → excision |
| GINA | 3.58 | Transplant → excision |
| GIGI | 3.19 | Transplant → excision |
| GANT | 2.69 | Transplant → excision |
| GING | 2.38 | Transplant → excision |

Example: `GI[G]ANTIC` → `GIANT[G]IC` → `GIANT`. Transplant the third
letter `G` to gap five in `GIANTIC`, giving `GIANTGIC`; excise its final
`GIC`. `ANTIC` is deliberately absent because removing the initial `GIG` alone
produces it. This source happens to have no qualifying dictionary targets in the
excision-first order; that order is nevertheless searched and independently
tested. Names such as GINA reflect the deliberately inclusive dictionary.

The [saved demonstration](examples/gigantic.json) contains every score and full
sequence. To reproduce it in Python:

```python
from wurgery.dictionary import load_dictionary
from wurgery.engine import find_solutions
from wurgery.scoring import result_rows

dictionary = load_dictionary(["wordlists"])
for row in result_rows(find_solutions("GIGANTIC", dictionary.words)):
    print(row)
```

## Validation

```sh
python -m pytest -q
```

The tests compare the complete results, separately for each operation order,
against an independent reference for **all 374 nonempty binary strings through
length seven and ternary strings through length four**. The reference uses
deletion masks and swaps of adjacent blocks, rather than the engine's
cut-and-insert loops. Adjacent-block swaps enumerate the same transplant
possibilities independently. Its dictionary includes every possible shorter
string, so it detects missed targets rather than checking only selected examples.

Each witness is replayed independently with list removal/insertion, checking
chunk boundaries, non-no-op operations, chaining, dictionary membership,
deduplication and exclusion of single-excision targets. Further checks cover
invalid inputs, minimum lengths, multi-file loading, obscure/variant words,
zero-frequency retention, sorted results, and Streamlit form interactions.

Code lives in `wurgery/engine.py`, `wurgery/dictionary.py`,
`wurgery/scoring.py` and `app.py`.
