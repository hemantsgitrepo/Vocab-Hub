# Vocab Hub

An offline-first vocabulary practice app for competitive-exam aspirants. No backend, no auth — everything runs on-device.

## Features

- **Word Library** — add words manually or auto-fill pronunciation, meaning, synonyms/antonyms, and part of speech via the free [Dictionary API](https://dictionaryapi.dev/).
- **Daily Practice Goal** — configurable target (default 5 words/day).
- **Travel Audio Mode** — continuous back-to-back TTS playback of words and meanings, with adjustable pace and pause intervals — built for hands-free listening on the go.
- **Adaptive Quizzing** — flashcards, multiple choice, and fill-in-the-blank quizzes drawn from your own learned vocabulary pool.
- **CSV Import / Export** — bulk-add words from a spreadsheet or back up your library, with a downloadable template.
- **Light & Dark Themes** — full MD3 theming via React Native Paper.

## Tech Stack

- **Framework:** React Native + Expo (managed workflow, New Architecture)
- **Database:** [WatermelonDB](https://watermelondb.dev/) (offline-first, reactive SQLite storage)
- **UI:** React Native Paper (MD3) + Lucide icons + `expo-linear-gradient`
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

This project uses native modules (WatermelonDB, TTS, file system), so a plain Expo Go session covers most JS work, but a full native build is needed after adding new native dependencies:

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleDebug
```

## Project Structure

```
src/
  api/        Dictionary API client
  db/         WatermelonDB schema, models, migrations, CSV import/export
  lib/        Shared utilities (CSV parsing, TTS, streaks, text helpers)
  screens/    App screens (Dashboard, Add Word, Travel Mode, Quiz, Settings)
  theme.ts    Light/dark theme tokens
```

## License

MIT
