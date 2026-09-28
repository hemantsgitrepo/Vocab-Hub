# Vocab Hub — Seed / Test Data

232 vocabulary words for populating a test device or emulator without adding
words by hand, in two forms:

| File | Use |
|---|---|
| `vocab-hub-seed.db` | Pre-built SQLite snapshot — restore it in one command (fastest) |
| `vocab-hub-seed-data.csv` | Raw word list — import through the UI to exercise the import path itself |

| Difficulty | Words |
|---|---|
| easy | 30 |
| medium | 80 |
| hard | 122 |

## Fastest: restore the database snapshot

```bash
./scripts/seed-device.sh                    # default device
./scripts/seed-device.sh -s emulator-5554   # pick one
```

This replaces the app's database outright: 232 words, all five arcade games
unlocked, onboarding already dismissed, no unlock-celebration modals queued.

Two things worth knowing:

- **Debug builds only.** Writing into `/data/data/<pkg>/` goes through `run-as`,
  which the OS refuses for a non-debuggable (release) package. Install the debug
  APK first: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
  (installing over a release build keeps existing data — same debug keystore).
- **Timestamps are re-stamped by default.** Day completion is derived from
  `created_at`, so a snapshot restored weeks after capture would otherwise read
  as "0 words today, streak 0". The script shifts the whole set forward so the
  newest word lands at "now", preserving relative order. Pass
  `--keep-timestamps` to restore the captured dates verbatim.

To regenerate the snapshot after editing the CSV or after a schema migration
bumps the version past v3:

```bash
node scripts/build-seed-db.mjs
```

Its output has been verified byte-identical to a database written by the app
itself, across every column of all 232 rows.

## Alternative: import the CSV

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
