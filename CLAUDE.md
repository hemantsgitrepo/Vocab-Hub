# Vocab Hub Project Conventions

## Tech Stack & Core Libraries
- **Framework:** React Native with Expo (Managed Workflow)
- **Database:** WatermelonDB (Offline-first, reactive persistent storage)
- **TTS:** react-native-tts (Offline native text-to-speech)
- **Audio SFX:** expo-audio (native SFX playback for the Game Arcade, `src/lib/sfx.ts`)
- **API:** Free Dictionary API (https://api.dictionaryapi.dev/api/v2/entries/en/<word>)
- **Styling & UI:** React Native Paper + Lucide Icons + Expo Linear Gradient

## App Requirements
1. **Daily Practice Goal:** Default is 5 words/day, but MUST be user-configurable in settings.
2. **Word Data Schema:**
   - Word, Pronunciation, Audio URL
   - Primary Meaning
   - Exactly 2 Synonyms, Exactly 2 Antonyms
   - Contextual Example Sentence
   - Layman's Terms Explanation (Optional string)
   - Word Origin (Optional string)
   - Part of Speech, Word Forms (grammatical variants)
   - Created At (timestamp), Difficulty Level, Practice Status
3. **Audio / Travel Mode:** Continuous back-to-back playback of words + meanings with pause intervals, TTS pitch/speed control, and background audio readiness.
4. **Testing Engine:** Dynamic quizzes (Flashcards, Multiple Choice, Fill-in-the-Blanks) based on user's learned vocabulary pool.
5. **Word Management:** Delete-word with confirmation warning; CSV import/export (bulk add/backup) matched by header name, with a downloadable template.
6. **Game Arcade:** 5 vocabulary mini-games (Vocab Millionaire, Memory Match, Scrabble, Crossword, Spelling Bee — `src/screens/games/`) that unlock progressively as the user's word count grows (thresholds in `src/lib/games.ts`). Each has SFX (tap/success/error/fanfare) toggleable in Settings.

## Code Standards
- Use TypeScript for strict type checking.
- Keep UI modern, vibrant, and clean with intuitive animations. Give Claude design freedom for layout, themes, and micro-interactions.
- Do not use paid APIs or third-party paid services.
- App display name is "Vocab Hub" (rebranded from "AptitudeWords"), but the native package/bundle ID (`com.anonymous.AptitudeWords`) and `app.json`'s `slug` (`AptitudeWords`) are intentionally unchanged, to avoid breaking the native project identity. Do not "fix" this mismatch.
- Theme is 3-way (`light`/`dark`/`system`, see `ThemeContext.tsx`), not a boolean toggle.
- Use `useAppDialogs()` (`src/ui/AppDialogs.tsx`) for confirmations and toasts instead of `Alert.alert`.