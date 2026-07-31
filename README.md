# Vocab Hub

An offline-first vocabulary practice app for competitive-exam aspirants. No backend, no auth — everything runs on-device.

## Features

- **Word Library** — add words manually or auto-fill pronunciation, meaning, synonyms/antonyms, and part of speech via the free [Dictionary API](https://dictionaryapi.dev/).
- **Daily Practice Goal** — configurable target (default 5 words/day), with a streak journey view.
- **Travel Audio Mode** — continuous back-to-back TTS playback of words and meanings, with adjustable pace and pause intervals — built for hands-free listening on the go.
- **Quiz Arena** — flashcards, multiple choice ("Meanings"), and fill-in-the-blank quizzes drawn from your own learned vocabulary pool, with streak tracking, animated feedback, and a scored results summary.
- **Game Arcade** — five unlockable word games, gated by how many words you've added (see below).
- **CSV Import / Export** — bulk-add words from a spreadsheet or back up your library, with a downloadable template. See [`test-data/`](test-data/) for a ready-made 232-word seed file.
- **Light / Dark / Auto Themes** — a pastel design system for both themes (Settings → Appearance); Auto follows the OS setting live.
- **Custom dialogs & toasts** — in-app confirm dialogs and toasts replace OS alerts throughout.

## Game Arcade

Games unlock automatically as you add words — no separate action needed. Progress is shown live on locked cards, with a teaser sheet that deep-links to the Add tab.

| Game | Unlocks at | Play |
|---|---|---|
| **Vocab Millionaire** | 20 words | 15-question ladder to 1,000,000 pts, three lifelines (50:50 / Hint / Clue), safe havens at Q5 and Q10 |
| **Memory Match** | 50 words | Flip a 4×3 grid, pairing each word with its synonym/meaning |
| **Vocab Scrabble** | 60 words | Spell pool words from a 7-tile rack with letter/word bonus multipliers |
| **Context Crossword** | 75 words | A fresh mini crossword generated from 4–6 of your own words, clued from meanings/antonyms/example sentences |
| **Spelling Bee** | 90 words | Build words from a 7-letter honeycomb (one mandatory center letter); find the pangram for a big bonus |

All five games share sound effects (with a Settings toggle), haptics, best-score persistence, and confetti/celebration animations on wins.

## Tech Stack

- **Framework:** React Native + Expo (managed workflow, New Architecture, SDK 57)
- **Database:** [WatermelonDB](https://watermelondb.dev/) (offline-first, reactive SQLite storage)
- **UI:** React Native Paper (MD3) + Lucide icons + `expo-linear-gradient` + `react-native-svg`
- **Audio:** `expo-audio` — synthesized, license-free SFX (tap/success/error/fanfare)
- **TTS:** `react-native-tts` (offline, on-device speech synthesis)
- **Dictionary data:** [Free Dictionary API](https://api.dictionaryapi.dev/) (no key required)
- **Language:** TypeScript (strict mode)

## Getting Started

```bash
npm install
npx expo start
```

Then press `a` for Android or `i` for iOS, or scan the QR code with Expo Go.

### Native builds

This project uses native modules (WatermelonDB, TTS, audio, file system), so a plain Expo Go session covers most JS work, but a full native build is needed after adding new native dependencies:

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleDebug
```

## Test / Seed Data

[`test-data/vocab-hub-seed-data.csv`](test-data/vocab-hub-seed-data.csv) — 232 pre-written vocabulary words (30 easy / 80 medium / 122 hard), importable in one step via **Settings → Import & export → Import words (CSV)**. Importing the full file unlocks every Game Arcade game immediately, which is useful for QA. See [`test-data/README.md`](test-data/README.md) for details.

## Project Structure

```
src/
  api/        Dictionary API client
  db/         WatermelonDB schema, models, migrations, CSV import/export, settings storage
  lib/        Shared utilities (CSV parsing, TTS, streaks, text helpers, sound effects, game logic)
  screens/    App screens (Dashboard, Add Word, Travel Mode, Quiz, Settings)
    games/    Game Arcade screens (Millionaire, Memory Match, Scrabble, Crossword, Spelling Bee)
  ui/         Shared UI (custom confirm dialogs, toasts)
  theme.ts    Light/dark theme tokens (pastel palette)
  ThemeContext.tsx   Theme mode (light/dark/system) state
test-data/    Seed CSV for QA/testing
```

## License

MIT
