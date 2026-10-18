# Wurgery — Python Puzzle Explorer

An exhaustive explorer for a word puzzle mechanic, plus a playable local game
with 10 hand-picked puzzles. The explorer searches both operation orders; the
game always uses transplant first and excision second.

## Play the game — no spoilers

Play online at **https://dixelstuff.github.io/wurgery/**. GitHub Pages can serve
the `main` branch from `/` (the repository root); the root entry page opens the
game in `game/`. No build step is needed.

To run locally:

```sh
python3 play.py
```

Open http://127.0.0.1:8502. The game uses only Python's standard library to serve
its local HTML, CSS and JavaScript, with no build step or external services.

1. Highlight at least two neighboring letters by dragging across them, or
   tapping the first and last. Drag the chunk to a new position; a translucent
   preview shows exactly where it will be inserted. Or tap the chevrons to
   reposition the chunk, then tap the suturing needle to place it as one transplant.
2. Highlight a second chunk of at least two letters. Drag it onto ✂️ or tap
   the scissors to cut. The drop area extends beyond the visible tray, while
   staying below the word. The remaining word must match the clue.
3. Tap outside the letters to clear a selection. **Reset** always starts the
   whole puzzle again, including after a wrong answer. Navigate with the arrows
   or numbered picker. Solved progress is saved in this browser's local storage.

The control below the word shows a muted transplant icon, activating with
left/right chevrons when a valid chunk is selected. After the move, the same
space becomes the scissors. There is no instruction above the word and no
congratulatory message after solving. There are no
permanent transplanted-letter markers, help modal or partial resets. Keyboard
users can select with Space/Enter, extend with Shift+Left/Right, and Tab to
insertion positions or the scalpel. Escape clears the current selection.

The mobile layout takes visual inspiration from [Flipwords](https://github.com/dixelstuff/flipwords):
a centered game, lavender background, white tiles and simple pill buttons. The
main screen shows no answer length, chunk-size hints, operation log or tutorial.
There is no instructions modal.

The collection has 10 puzzles with starting words no longer than nine letters
and familiar answers of 5–7 letters, each with a short clue and a verified two-operation
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

A transplant cuts a contiguous substring of at least two letters and inserts it at any gap in
the remaining string, preserving its internal order. A move is rejected if the
result equals the input, even when different letter occurrences were moved.
An excision removes a contiguous substring of at least two letters. Each operation acts on the
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

## Original-mechanic GIGANTIC demonstration

This archived demonstration allows one-letter chunks (`min_chunk_length=1`).
The current game and explorer require at least two letters per operation.
With the original rule and minimum answer length four, these eight targets result:

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
for row in result_rows(find_solutions("GIGANTIC", dictionary.words, min_chunk_length=1)):
    print(row)
```

## Validation

```sh
python -m pytest -q
```

The tests compare the complete results, separately for each operation order,
against an independent reference, for minimum chunk sizes one and two, for **all 374 nonempty binary strings through
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
