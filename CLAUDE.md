# Vocab Hub Project Conventions

## Tech Stack & Core Libraries
- **Framework:** React Native with Expo (Managed Workflow)
- **Database:** WatermelonDB (Offline-first, reactive persistent storage)
- **TTS:** react-native-tts (Offline native text-to-speech)
- **Background audio:** `react-native-notify-kit` — Android `mediaPlayback` foreground service + notification transport controls for Travel Mode (`src/lib/playbackNotification.ts`). `android/` is gitignored/generated, so native config goes in `app.json` plugins only.
- **Audio SFX:** expo-audio (native SFX playback for the Game Arcade, `src/lib/sfx.ts`)
- **APIs (all free & keyless):** Free Dictionary API (primary), Wiktionary MediaWiki `action=parse` (etymology + curated syn/ant), Datamuse (syn/ant backfill) — all in `src/api/dictionary.ts`
- **Styling & UI:** React Native Paper + Lucide Icons + Expo Linear Gradient
- **Legal docs:** `react-native-markdown-display` renders the Terms/Privacy viewer (`src/screens/legal/`). It needs the `punycode` package installed explicitly — its `markdown-it@10` dependency requires that Node builtin, which React Native does not ship.

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
3. **Audio / Travel Mode:** Continuous back-to-back playback of words + meanings with pause intervals, TTS pitch/speed control, and background audio readiness. The playlist is picked from predefined categories (`src/lib/travelCategories.ts` — All / Recent / Needs practice / Mastered / Challenging), with per-word exclusions as refinement; add a category by appending one entry to `TRAVEL_CATEGORIES`.
4. **Testing Engine:** Dynamic quizzes (Flashcards, Multiple Choice, Fill-in-the-Blanks) based on user's learned vocabulary pool.
5. **Word Management:** Delete-word with confirmation warning; CSV import/export (bulk add/backup) matched by header name, with a downloadable template.
6. **Game Arcade:** 5 vocabulary mini-games (Vocab Millionaire, Memory Match, Scrabble, Crossword, Spelling Bee — `src/screens/games/`) that unlock progressively as the user's word count grows (thresholds in `src/lib/games.ts`). Each has SFX (tap/success/error/fanfare) toggleable in Settings.
7. **Streak System:** Forgiving daily-goal streak (`src/lib/streakEngine.ts`) with a 2-hour post-midnight grace period, 1 free freeze per 10-day run, a 48-hour repair challenge on an unprotected break, and milestone celebrations at 7/14/30/50/100 days. Day completion is always derived from `created_at`; only the freeze/repair/milestone overlay is persisted (`streak.state` in `src/db/settings.ts`).
8. **Legal & Privacy:** Terms of Service and Privacy Policy viewable in-app from Settings → About & Legal (`src/screens/legal/LegalViewerScreen.tsx`). The text lives in `src/screens/legal/policies.ts` and mirrors `docs/legal/*.md` — **edit both**, as Metro cannot bundle `.md` as source.

## Code Standards
- Use TypeScript for strict type checking.
- Keep UI modern, vibrant, and clean with intuitive animations. Give Claude design freedom for layout, themes, and micro-interactions.
- Do not use paid APIs or third-party paid services.
- App display name is "Vocab Hub" (rebranded from "AptitudeWords"), but the native package/bundle ID (`com.anonymous.AptitudeWords`) and `app.json`'s `slug` (`AptitudeWords`) are intentionally unchanged, to avoid breaking the native project identity. Do not "fix" this mismatch.
- Theme is 3-way (`light`/`dark`/`system`, see `ThemeContext.tsx`), not a boolean toggle.
- Use `useAppDialogs()` (`src/ui/AppDialogs.tsx`) for confirmations and toasts instead of `Alert.alert`.

## Documentation
- `docs/OVERVIEW.md` is the canonical, detailed application summary (stack, external references, full DB schema, every feature, build/distribution notes). **Keep it in sync**: whenever a change adds/removes a dependency, a DB column or `local_storage` key, an external URL, or a user-facing feature, update the matching section of `docs/OVERVIEW.md` in that same change — don't let it drift the way this file did.