# Vocab Hub — Seed / Test Data

`vocab-hub-seed-data.csv` — 232 vocabulary words for populating a test device or
emulator without adding words by hand.

| Difficulty | Words |
|---|---|
| easy | 30 |
| medium | 80 |
| hard | 122 |

## How to import

1. Launch the app → **Settings** → **Import & export** → **Import words (CSV)**.
2. Pick `vocab-hub-seed-data.csv`.
3. Import is all-or-nothing: if every row is valid, all 232 words are added; if
   any row fails validation (blank word/meaning, duplicate, bad `Difficulty`
   value), nothing is written and the app lists every failing row.

This same file is what **Settings → Download CSV template** produces the header
row for — the column order matters for the template but import itself matches
columns by header name, so re-ordered columns still work.

## Why 232 words

The Game Arcade unlocks at 20 / 50 / 60 / 75 / 90 words added (see the main
[README](../README.md#game-arcade)). Importing this file in one shot unlocks
every game immediately, which is useful for QA — otherwise reaching the
90-word Spelling Bee threshold means adding 90 words by hand first.

## Columns

Same 14 columns the app itself exports/imports (`src/db/csv.ts`):

```
Word, Pronunciation, Part of Speech, Word Forms, Meaning, Synonym 1, Synonym 2,
Antonym 1, Antonym 2, Example Sentence, Word Origin, Layman Explanation,
Difficulty, Audio URL
```

Only `Word` and `Meaning` are required; every other column may be blank.
