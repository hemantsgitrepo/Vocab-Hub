# Vocab Hub — Application Summary

**Version** 1.0.0 · offline-first vocabulary trainer for competitive-exam aspirants · single-user, no backend, no auth, no accounts.

> This document should be kept in sync with the codebase. Whenever a feature, dependency, schema column, or external reference is added/changed/removed, update the relevant section here in the same change. See the note at the bottom of `CLAUDE.md`.

---

## 1. Technology stack

| Layer | Choice | Version |
|---|---|---|
| Framework | React Native + Expo (managed, New Architecture/bridgeless) | RN 0.86.0, Expo ~57.0.8, React 19.2.3 |
| Language | TypeScript (strict, `strictPropertyInitialization: false`) | ~6.0.3 |
| Database | WatermelonDB over SQLite (JSI adapter) | ^0.28.0 |
| Navigation | React Navigation bottom-tabs | ^7.18.14 |
| UI kit | React Native Paper (MD3) + Lucide icons + `expo-linear-gradient` + `react-native-svg` | Paper ^5.15.3, SVG 15.15.4 |
| Speech | `react-native-tts` — on-device, offline | ^4.1.1 |
| Audio SFX | `expo-audio` | ~57.0.3 |
| Background playback | `react-native-notify-kit` — foreground service + notification transport controls for Travel Mode (maintained Notifee fork; Notifee itself was archived April 2026) | ^10.5.0 |
| File I/O | `expo-file-system`, `expo-sharing`, `expo-document-picker` | ~57.x |
| Animation | React Native's built-in `Animated` API — **no `react-native-reanimated`** | — |
| Markdown | `react-native-markdown-display` — renders the in-app Terms/Privacy viewer. Requires an explicit `punycode` install: its `markdown-it@10` dependency requires that Node builtin, which RN does not ship | ^7.0.2 |

**Expo plugins:** `@morrowdigital/watermelondb-expo-plugin`, `expo-build-properties` (Android `pickFirst: **/libc++_shared.so`), `expo-sharing`, `expo-audio`, `react-native-notify-kit` (Android `foregroundService.types: ["mediaPlayback"]`).

`android/` is **gitignored and generated** — all native configuration must be expressed as Expo config plugins in `app.json`, never hand-edited into the manifest, or it is lost on the next `expo prebuild`.

Two deliberate constraints: everything runs **offline on-device** (the only network call is the dictionary lookup), and **no paid APIs or services** are used anywhere.

---

## 2. External references

| Reference | Use | Auth |
|---|---|---|
| `api.dictionaryapi.dev/api/v2/entries/en/<word>` | Primary auto-fill: definitions, phonetics, audio, examples | None — free, keyless |
| `en.wiktionary.org/w/api.php` (MediaWiki `action=parse`) | Etymology (`word_origin`), plus curated `{{syn}}`/`{{ant}}` lists | None — free, keyless |
| `api.datamuse.com/words?rel_syn=` / `rel_ant=` | Synonym/antonym backfill | None — free, keyless |
| `jobmanch.ai`, `upquarx.com` | Partner links in Settings | N/A |

That is the **complete** list of outbound URLs in `src/`. There is no analytics, telemetry, crash reporting, ads, or sync.

**Multi-source auto-fill** (`src/api/dictionary.ts`) queries all three sources in parallel with an 8s timeout each, so a slow or dead source degrades the result rather than failing the lookup. Merge priority for synonyms/antonyms is dictionary → Wiktionary → Datamuse (Datamuse results below a score of 500 are discarded as noise). Two fields have no free source and are derived locally:

- **Layman explanation** — a text heuristic over the primary definition (strips parentheticals and formal scaffolding such as "of or relating to", keeps the first clause, prefixes "In simple terms: …"). It is *not* comprehension.
- **Example sentence** — a part-of-speech-shaped template, used only when the dictionary supplies no example.

Every populated field carries a `FieldSource` (`dictionary` | `wiktionary` | `datamuse` | `generated`) which the Add Word screen renders as a pastel provenance badge, so locally-derived values are visibly distinguishable from sourced ones.

**Audio assets:** four synthesized WAVs in `assets/sfx/` (`tap` 2 KB, `error` 10.6 KB, `success` 15.9 KB, `fanfare` 34 KB) — generated in-house, no licensing.

---

## 3. Database

### `words` table — schema **v3**, 16 columns

| Column | Type | Notes |
|---|---|---|
| `word` | string | Capitalised on every save path |
| `pronunciation` | string | IPA, left un-capitalised |
| `audio_url` | string | From dictionary API |
| `meaning` | string | |
| `synonym_1`, `synonym_2` | string | Exactly 2 by design |
| `antonym_1`, `antonym_2` | string | Exactly 2 by design |
| `example_sentence` | string | |
| `layman_explanation` | string **nullable** | |
| `word_origin` | string **nullable** | Manual entry |
| `part_of_speech` | string | e.g. "adjective" |
| `word_forms` | string | e.g. "adverb: capriciously" |
| `difficulty_level` | string **indexed** | `easy` / `medium` / `hard` |
| `practice_status` | string **indexed** | `new` / `learning` / `mastered` |
| `created_at` | number **indexed, readonly** | Drives all streak/history logic |

**Migrations:** v1→v2 added `part_of_speech` + `word_forms`; v2→v3 added `word_origin`. `src/db/models/Word.ts` applies WatermelonDB's legacy decorators **manually** — Babel's decorator transform conflicts with `babel-preset-expo` on SDK 57.

### Key–value store (`local_storage`)

No extra tables; all preferences and progression live here as JSON.

| Key | Purpose |
|---|---|
| `settings.dailyGoal` | Daily word target (default **5**) |
| `settings.travelFields` | Which fields Travel Mode speaks |
| `settings.quizUseSynonyms` / `.quizUseAntonyms` | Alternate quiz prompting |
| `settings.gameSounds` | Arcade SFX toggle |
| `settings.themeMode` | `light`/`dark`/`system` (migrates legacy `settings.darkMode` boolean) |
| `settings.onboardingComplete` | First-launch carousel gate |
| `games.millionaire.bestScore`, `games.memory.bestMoves`, `games.stat.<key>` | Best scores |
| `games.celebratedUnlocks` | Which game unlocks have been celebrated |
| `streak.state` | Freeze inventory, protected days, open repair, celebrated milestones |

---

## 4. Features

**Word management** — Add with multi-source auto-fill (see §2), which badges each populated field with its origin and clears the badge once you edit it; duplicate detection is case-insensitive; delete requires confirmation. **CSV import/export** matched by *header name* (order-independent) with a downloadable template and an RFC4180 parser that handles quoted fields, embedded newlines and Excel BOM. Columns: Word, Pronunciation, Part of Speech, Word Forms, Meaning, Synonym 1/2, Antonym 1/2, Example Sentence, Word Origin, Layman Explanation, Difficulty, Audio URL.

**Travel Mode** — hands-free continuous playback. The playlist is chosen from five predefined categories (`src/lib/travelCategories.ts`), shown as a horizontal chip row with live counts: **All words**, **Recent** (added in the last 7 days), **Needs practice** (`practiceStatus !== 'mastered'`), **Mastered**, and **Challenging** (`difficultyLevel === 'hard'`) — spanning recency, progress and difficulty without a filter matrix. Individual words can still be tapped to drop them from the chosen category; the screen tracks *exclusions* rather than inclusions, so newly added words join automatically. Switching category clears those refinements and ends any running session, since a resumed position would point into the wrong list. Speaks fields in canonical order (word → meaning → synonyms → antonyms → example → layman), configurable per field; ~600 ms between fields, ~1200 ms between words (pauses apply only while the app is foregrounded — RN timers freeze when the Android activity pauses, so with the screen locked playback chains gaplessly off `tts-finish` events instead of stalling). Speed 0.8×/1×/1.25×, applied from the next segment when changed mid-playback; pitch low/mid/high; loop and skip. A failed utterance (`tts-error`, or a rejected `speak()`) skips that segment rather than stalling the playlist.

*Background playback (Android):* starting playback starts a `mediaPlayback` foreground service (`src/lib/playbackNotification.ts`) so the OS cannot freeze the JS loop or kill the process mid-session — this matters most on aggressive OEMs like Samsung. It shows an ongoing, silent (`IMPORTANCE_LOW`), `PUBLIC`-visibility notification carrying the current word and playlist position plus **Pause/Play · Next · Stop** actions, which are usable from the lock screen. Pausing keeps the notification so playback can resume from the shade; Stop, playlist end, and leaving the screen all tear the service down. `POST_NOTIFICATIONS` is requested on first play, not at launch. There is no true MediaSession widget — `AndroidStyle` has no `MEDIA` option and no RN library bridges TTS to MediaSession; that would need custom native code. Fully offline; iOS relies on the `audio` background mode declared in `app.json` instead.

**Quiz Arena** — three modes (Flashcards with self-grading, Meanings 4-way multiple choice, Fill-the-blank from the word's own example). Source window: all time / past 7 / past 30 days. Optional synonym- or antonym-prompting. Scored as a percentage, with confetti at ≥80%.

**Game Arcade** — five games unlocking progressively by word count:

| Game | Unlocks at | Mechanic |
|---|---|---|
| Vocab Millionaire | 20 | 15 questions, 100 → 1,000,000 pts; safe havens at Q5 (1,000) and Q10 (32,000); three one-shot lifelines (50:50, Hint, Clue) |
| Memory Match | 50 | 6 pairs / 12 cards, word ↔ first synonym; scored in moves (lower is better) |
| Vocab Scrabble | 60 | 5 rounds, 7-tile rack, standard letter values, DL/TL/DW/TW bonuses; only *your* words count |
| Context Crossword | 75 | Generated 7×7 grid, up to 6 crossed words, ≥4 crossings required; clues from blanked example, meaning, or antonym |
| Spelling Bee | 90 | 7-letter hive, centre letter mandatory; 4 letters = 1 pt, else length; pangram +7 |

**Streak system** — daily goal tracking with a **2-hour post-midnight grace period** applied consistently to both the streak and "Today's progress". Earns **1 freeze per 10 consecutive days**, spent automatically to protect a missed day. A break without a freeze opens a **48-hour repair challenge** (`max(10, goal × 2)` words to win the streak back). Milestone celebrations at 7/14/30/50/100.

Presentation follows progressive disclosure across two surfaces:

- **Home** — a summary streak card only (animated flame, current streak, best, freeze inventory, progress to the next free freeze). No history, keeping the Game Arcade and recent words above the fold.
- **Streak detail** (tap the card) — amber/coral hero matching the card, three stats (best streak · days completed · freezes), the monthly heatmap distinguishing hit / freeze-protected / missed / pre-history days, a "safety net" explainer for freezes and repair, plus motivation and next-action suggestions.

Both surfaces read the streak engine, so the 2am grace boundary can't make them disagree; the freeze/repair copy is generated from the engine's own constants.

*Design note:* day completion is always **derived** from `created_at`, so the streak can never drift from the collection; only non-derivable state (freezes, protected days, repair, milestones) is persisted. This is why no schema migration was needed for it.

**Onboarding & discovery** — 3-slide first-launch carousel; contextual "How it works" bottom sheets on Travel Mode, the Quiz hub and all five games; inviting empty states on Dashboard and Travel Mode; milestone unlock celebrations for games.

**Legal & Privacy** (`src/screens/legal/`) — Settings → *About & Legal* lists Terms of Service and Privacy Policy as tappable rows; either opens a full-screen viewer with a segmented Terms/Privacy toggle, themed markdown rendering (headings, lists, blockquotes, inline code, rules) and links opened through `Linking.openURL()`. Document text lives in `policies.ts` and **mirrors `docs/legal/TERMS_OF_SERVICE.md` / `PRIVACY_POLICY.md`** — Metro cannot bundle `.md` as source, so both copies must be edited together; the `.md` files stay in the repo because the Privacy Policy itself promises updates are documented there.

**Settings layout** (`src/screens/SettingsScreen.tsx`) — grouped under five uppercase section labels (Appearance · Practice · Audio · Your data · About) rather than a flat card list. Two sections collapse via `LayoutAnimation` with a rotating chevron: *Travel mode fields* opens by default so its six toggles stay readable, *About & legal* starts closed as read-once reference material. Every preference row is a full-width `Pressable` carrying `accessibilityRole="switch"` and its checked state — the `Switch` inside is inert (`pointerEvents="none"`) so assistive tech hears one control, not two. The theme picker is a `radiogroup` of `radio` options that spring into their selected state; the goal stepper labels its buttons and announces the value via a polite live region. No `setLayoutAnimationEnabledExperimental` call — it is a no-op that only warns under the New Architecture.

**Theming & UX** — 3-way theme (`light`/`dark`/`system`) with a pastel palette (light: warm cream `#FAF7F1`; dark: charcoal-slate `#14161D`). Custom `AppDialogs` layer (`confirm()` / `toast()`) fully replaces `Alert.alert`. SFX and haptics on interactive controls, toggleable in Settings.

---

## 5. Build & distribution

- **Package/bundle ID** `com.anonymous.AptitudeWords` and `app.json` slug `AptitudeWords` are intentionally *not* renamed despite the "Vocab Hub" rebrand — changing them would break native project identity.
- Release APK ≈ 92 MB, **self-signed with the debug keystore** — fine for ad-hoc sharing, **not Play Store ready** (that needs a real release keystore).
- Recipients must enable "install unknown apps". Installing over an existing copy preserves data, so onboarding won't re-appear for them.

## 6. Testing posture

No Jest or CI. Verification is manual on-device walkthrough plus direct SQLite inspection, and `adb logcat` grepped for `AudioFlinger`/`MediaSession` transitions to confirm real audio playback. The streak engine (`src/lib/streakEngine.ts`) has scenario coverage (grace period, freeze earn/spend, repair completion/expiry, idempotency, milestones, calendar classification) exercised ad hoc via a compiled script — there is no committed Jest suite in the repo yet.
