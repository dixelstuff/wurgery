# Bundled SCOWL / English Speller Database

Official source: https://github.com/en-wl/wordlist

Release: `rel-2026.02.25`, commit `7e99edab8e32f9f9ea2b15f249ca8d4d67237410`.
The source project now calls SCOWL the English Speller Database (ESDB).

Archive: https://github.com/en-wl/wordlist/archive/refs/tags/rel-2026.02.25.tar.gz

Archive SHA-256: `74e7cc3e9e03e609c1c74bb7e8862fcd988cdd64768dcbee4611581b7e633852`.

Extraction commands, run inside that source release:

```sh
python3 combine.py create-db scowl.db
python3 scowl word-list 95 A,B,Z,C,D 8 --no-word-filter
```

This selects every available size (35 through 95), all dialects including
unmarked spellings, and all variants through level 8 (including archaic and
uncommon variants). Level 9 is explicitly labelled invalid/misspelled upstream
and is excluded for that reason. No wordfreq or frequency cutoff is applied.
Upstream currently has size-95 metadata but it adds no words to this export.

The raw export has 354,119 entries. Keep only entries for which Python
`str.isalpha()` is true, uppercase, deduplicate and sort. No transliteration,
accent removal or punctuation stripping is performed. The result contains
284,019 unique entries, with lengths 1–58. Alphabetic names, abbreviations and
single-letter entries are retained along with other words; dictionary membership
is deliberately broad. English word validity means membership in these lists,
not a separate linguistic judgement.

`words.txt` SHA-256:
`09b218dcb9a35c1bd472960cf0db8af29826526f7771ac021b396619b9bae839`.

The unmodified upstream copyright and license notices are in `Copyright` beside
the word list. Only word-list extensions are loaded by the app, so these notices
and this document are not interpreted as dictionary entries.

To reproduce the export, run `python scripts/fetch_scowl.py` from the project
root (Python 3.12+). The normal app uses the bundled list without a download.
