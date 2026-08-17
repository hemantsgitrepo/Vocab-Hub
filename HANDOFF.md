# Vocab Hub — Context Hand-off Summary
_Generated end of session, 2026-08-06. Paste into next session's opening message. Supersedes the prior HANDOFF.md (committed as 73d58e6) — that document's content is now stale; only this one is authoritative._

## 1. High-Level Project Goal & Architecture

**Vocab Hub**: offline-first vocabulary practice app for competitive-exam aspirants. React Native + Expo (managed workflow, New Architecture/bridgeless, SDK 57). No backend, no auth — single-user, fully on-device. Rebranded from "AptitudeWords" (display name only; native identifiers intentionally unchanged, see §3).

- **DB**: WatermelonDB (SQLite + JSI adapter), schema **v3**, `src/db/` — single model `Word.ts` (16 columns, legacy decorators applied manually — Babel decorator transform conflicts with `babel-preset-expo` on SDK 57)
- **Nav**: React Navigation bottom-tabs, 5 screens — Home (Dashboard), Add, Travel, Quiz, Settings (`App.tsx`, `src/screens/`)
- **UI**: React Native Paper (MD3) + Lucide icons + `expo-linear-gradient` + `react-native-svg`; pastel theme tokens in `src/theme.ts`, 3-way mode (`light`/`dark`/`system`) in `ThemeContext.tsx`
- **Animation**: React Native's built-in `Animated` API + `LayoutAnimation` throughout — **`react-native-reanimated` deliberately NOT added**, a standing project convention across multiple sessions, to keep changes JS-only (no native rebuild required)
- **Audio**: `expo-audio` (SFX, `src/lib/sfx.ts`), `react-native-tts` (offline TTS, Travel Mode), `react-native-notify-kit` (Android `mediaPlayback` foreground service for background Travel Mode playback, `src/lib/playbackNotification.ts`)
- **Dictionary**: multi-source, `src/api/dictionary.ts` — Free Dictionary API + Wiktionary + Datamuse, unchanged this session
- **Markdown**: `react-native-markdown-display` (Terms/Privacy viewer, `src/screens/legal/`) — requires the standalone `punycode` npm package installed explicitly; its `markdown-it@10` dependency imports the Node builtin `punycode`, which RN does not ship, and the bundle fails to resolve without the shim
- **File I/O**: `expo-file-system`, `expo-sharing`, `expo-document-picker`
- **Lang**: TypeScript strict (`strictPropertyInitialization: false`)
- Package/bundle ID: `com.anonymous.AptitudeWords` (Expo default, **never renamed**, despite app being rebranded "Vocab Hub"; `app.json` `slug` also intentionally still `AptitudeWords`)

### Source tree (current)
```
src/
  api/          dictionary.ts (multi-source lookup)
  db/           schema.ts, migrations.ts, words.ts, settings.ts, csv.ts, models/Word.ts
  lib/          csv.ts, games.ts, sfx.ts, streakEngine.ts, guides.ts, tts.ts, text.ts,
                playbackNotification.ts, travelCategories.ts (NEW this session)
  screens/      DashboardScreen, AddWordScreen, TravelModeScreen, QuizScreen,
                SettingsScreen (restructured this session), StreakJourneyModal, OnboardingScreen
    games/      GameArcade.tsx, VocabMillionaire.tsx, MemoryMatch.tsx,
                ScrabbleGame.tsx, CrosswordGame.tsx, SpellingBeeGame.tsx,
                Confetti.tsx, gameVisuals.ts
    legal/      LegalViewerScreen.tsx, policies.ts (NEW this session)
  ui/           AppDialogs.tsx, EmptyState.tsx, InfoSheet.tsx,
                StreakCard.tsx, StreakCalendar.tsx, StreakMilestoneModal.tsx,
                StreakRepairModal.tsx, UnlockCelebration.tsx, UnlockProvider.tsx
  theme.ts, ThemeContext.tsx, hooks.ts
docs/
  OVERVIEW.md   canonical application summary — kept in sync every session
  legal/        TERMS_OF_SERVICE.md, PRIVACY_POLICY.md (NEW this session — shipped copy mirrored into policies.ts)
test-data/      vocab-hub-seed-data.csv (232 words) + README.md — QA seed set
```

## 2. Hardware Setup & Runtime Configuration

- **Host**: macOS (Darwin, Apple Silicon), Node v22.23.1, npm 10.9.8
- **Android toolchain**: `ANDROID_HOME=/Users/hemantsawant/Library/Android/sdk`, `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home` — both exported via `~/.zshrc`. **Every Bash call touching adb/gradle/java must start with `source ~/.zshrc >/dev/null 2>&1 &&`**, and add `platform-tools` to `PATH` for `adb`.
- **Devices at session end** (re-verify with `adb devices -l` — state drifts constantly across this project's sessions):
  - Emulator `Pixel_8`-class (`sdk_gphone64_arm64`, ARM64), serial `emulator-5554` — connected, `device` state.
  - Physical Samsung Galaxy M52, serial `RFCR9154J2E` — **NOT connected at session end** (was connected and actively used earlier this session; disconnected at some point, likely USB unplug). Reconnect and re-run `adb -s RFCR9154J2E reverse tcp:8081 tcp:8081` before any physical-device work.
- **Metro**: running (`expo start --port 8081`, PIDs 52926/62139 confirmed alive at session end). `adb reverse tcp:8081 tcp:8081` **drops on USB reconnect/reauthorization** — this bit us twice this session (once on the emulator becoming `unauthorized`, once on the phone showing "Cannot connect to Expo CLI" after a reconnect). Always re-run `adb -s <serial> reverse tcp:8081 tcp:8081` immediately after any device reconnects, before assuming a stale-bundle error is a real bug.
- **⚠️ Learned this session — do not repeat the mistake**: for a **debug** Expo build, JS is served **live from Metro**, not bundled into the APK. "Rebuild the APK" is only necessary for **native** changes (new native module, `app.json` plugin change, etc.). For JS-only changes, a debug APK is never "stale" as long as Metro is running and `adb reverse` is set for that device — a cold app relaunch (`am force-stop` + relaunch) is sufficient. The prior session's HANDOFF.md incorrectly treated the debug APK as needing a rebuild after JS changes; that guidance was wrong and cost real time this session.
- **Debug APK**: `android/app/build/outputs/apk/debug/app-debug.apk`, built **Aug 6 11:45** — native side is current (no native/plugin changes since; `react-native-notify-kit` and its `app.json` plugin were added mid-session and this APK already reflects that). Safe to reuse as-is; only rebuild if a native dependency or `app.json` plugin changes.
- **Release APK**: does not currently exist at `android/app/build/outputs/apk/release/` — build fresh with `./gradlew assembleRelease` if a release build is needed.
- **⚠️ Emulator app data is DIRTY test fixtures from prior sessions**, most recently overwritten this session via direct SQLite manipulation (`adb exec-out run-as … cat`/push) to fabricate a broken-streak scenario for `StreakRepairModal` testing (5-day streak broken by a missed day, 0 freezes, open repair challenge). **Do not treat the emulator's current word count/streak state as representative.** Wipe with `adb shell pm clear com.anonymous.AptitudeWords` before any "fresh install" verification.
- **Physical phone has real user data** (421 words, 208 mastered at last check) — **never seed/clear this device**, it is the user's actual collection.
- **Direct SQLite manipulation gotcha (learned this session, be careful reusing this technique)**: WatermelonDB's `local_storage` table stores string values **double JSON-encoded** — the adapter's own `.set()` call does an additional `JSON.stringify` on top of whatever string the caller already serialized (compare to `games.celebratedUnlocks` in the DB: `"[\"millionaire\",\"memory\"]"` — outer quotes are real column content, not display artifacts). A single-encoded write is silently ignored by `getStreakStateRaw()`'s `JSON.parse` (throws internally, caught, falls back to a fresh/bootstrap state) with **no error surfaced**. Also: the DB file must be pulled/pushed **together with its `-wal`/`-shm` files** (or checkpointed first via `PRAGMA wal_checkpoint(TRUNCATE)`) or writes silently vanish. And critically: **the app process must be truly killed (`am force-stop`) before pushing a modified DB file, and again immediately before relaunch** — an already-running process keeps its old in-memory state and overwrites your edit on its next background write, even though the file on disk was correctly staged.
- No local LLM runtime, no GPU allocation, no MCP-served model — pure Claude Code + Bash/adb/gradle/sqlite3/python3 toolchain.
- Model: session ran across Haiku 4.5, Sonnet 5, and Opus 5 (user-toggled multiple times mid-session); ended on Sonnet 5.

## 3. `CLAUDE.md` & Project Rulebook State

- **Global** (`~/.claude/CLAUDE.md`): think-before-coding, simplicity-first, surgical diffs, goal-driven verification. Unchanged.
- **Project** (`AptitudeWords/CLAUDE.md`): synced through commit `3a11be5`; **the Settings restructure (commit `bf8fbb3`) was NOT synced into CLAUDE.md** — only `docs/OVERVIEW.md` was updated for that change. This is a known, deliberate gap (Settings layout is implementation detail, not a new user-facing app requirement in the §"App Requirements" sense) — but verify this judgment still holds before adding more Settings changes; if Settings organization becomes a documented requirement, add it to CLAUDE.md then.
- Current CLAUDE.md tech-stack bullets include: `react-native-notify-kit` background-audio line, `react-native-markdown-display` + `punycode` legal-docs line. App Requirements §3 (Travel Mode) now documents `src/lib/travelCategories.ts` categories.
- **No test suite** (no Jest, no CI), unchanged. Verification method throughout this session: manual on-device walkthrough via `adb shell screencap`/`input tap`/`input swipe`, direct SQLite inspection/seeding, `adb logcat` grepped for JS errors/bundling failures.
- **Established conventions, reconfirmed/extended this session**:
  - Never add `react-native-reanimated` — built-in `Animated`/`LayoutAnimation` only.
  - `setLayoutAnimationEnabledExperimental` is a **no-op that only emits a runtime warning** under the New Architecture (bridgeless RN) — do not call it; layout animations are already enabled. This was added then removed after a live device warning surfaced it.
  - When wrapping a `Switch` in a full-row `Pressable` for a larger tap target, mark the inner `Switch` `pointerEvents="none"` and put the `accessibilityRole="switch"` + `accessibilityState={{checked}}` on the **Pressable**, not the Switch — otherwise a screen reader announces two overlapping controls.
  - `Vibration.vibrate(10)`-style short haptic pulses are the established micro-interaction convention across this codebase (Quiz, Streak modals, and now Settings) — no `expo-haptics` dependency exists or should be added; `Vibration` from `react-native` is the pattern.
  - Direct git commits: only ever create when the user explicitly asks, and confirm push separately from commit — this was followed correctly throughout (multiple distinct approve-then-push exchanges this session).
- **No test suite** for the streak engine survives from two sessions ago — still not committed as real Jest tests. Not touched this session; still an open item if streak logic changes again.

## 4. Features Implemented & Current Progress

All work is **committed AND pushed** to `origin/main` (verified clean at session end: `git status` empty, 0 commits ahead/behind origin as tracked in this session's own pushes). Commits this session, most-recent first (HEAD = `73d58e6`):

| Commit | Feature | Key files |
|---|---|---|
| `73d58e6` | Prior-session HANDOFF.md snapshot committed (housekeeping, per explicit user request "commit everything") | `HANDOFF.md` |
| `bf8fbb3` | **Settings screen UX restructure** | `src/screens/SettingsScreen.tsx` (rewritten — 5 uppercase section labels: Appearance/Practice/Audio/Your data/About; 2 collapsible `CollapsibleCard` sections with `LayoutAnimation` + rotating chevron — Travel fields open-by-default, About closed-by-default; new `SwitchRow`/`ThemeOption`/`SectionLabel` components; full-row pressable switches; radiogroup theme picker with spring animation; accessible goal stepper with live region; merged 3 trailing cards into 1; cut onboarding-duplicate marketing copy), `docs/OVERVIEW.md` (+Settings layout paragraph) |
| `3a11be5` | **Travel Mode predefined categories** (replaces free-form word picking) | `src/lib/travelCategories.ts` (new — 5 categories: All words / Recent [7-day] / Needs practice / Mastered / Challenging, each a single predicate), `src/screens/TravelModeScreen.tsx` (rewritten — horizontal chip row with live counts, exclusion-based refinement instead of inclusion-based selection, fade+lift animation on category switch, empty-category states), `src/lib/guides.ts` (Travel Mode help steps updated), `CLAUDE.md` + `docs/OVERVIEW.md` synced |
| `d08b9c5` | **In-app Terms of Service / Privacy Policy viewer** | `src/screens/legal/LegalViewerScreen.tsx` (new — full-screen modal, segmented Terms/Privacy toggle, themed markdown via `react-native-markdown-display`), `src/screens/legal/policies.ts` (new — shipped doc text, mirrors `docs/legal/*.md`), `docs/legal/TERMS_OF_SERVICE.md` + `PRIVACY_POLICY.md` (new), `src/screens/SettingsScreen.tsx` (+About & Legal card), `package.json` (+`react-native-markdown-display`, +`punycode`) |
| `c080aa2` | **Travel Mode UI overlap fix + background playback** | `src/screens/TravelModeScreen.tsx` (Speed/Pitch stacked into labeled rows instead of side-by-side overflow; screen-lock playback fix via `AppState`-aware wait/flush instead of frozen `setTimeout`; `tts-error` handling; mid-playback rate/pitch apply; accessibility labels), `src/lib/playbackNotification.ts` (new — `mediaPlayback` foreground service, notification transport controls), `app.json` (+`react-native-notify-kit` plugin), `index.ts` (+`initPlaybackNotification()`) |

### Travel Mode category contract (`src/lib/travelCategories.ts`)
- 5 categories, each a `{key, label, Icon, emptyHint, match: (w, now) => boolean}` — adding one is a single array entry, no screen changes needed.
- `all` / `recent` (createdAt within last `RECENT_DAYS=7`, midnight-aligned cutoff) / `practice` (`practiceStatus !== 'mastered'`) / `mastered` (`practiceStatus === 'mastered'`) / `hard` (`difficultyLevel === 'hard'`).
- Screen tracks **exclusions**, not inclusions (`excluded: Set<string>`) — words added later join a category automatically. Switching category clears exclusions and ends any running playback session (a resumed position would otherwise index into the wrong list).
- `categoryCounts()` computes live badge counts; verified against real phone data mid-session (421 total, 213 needs-practice + 208 mastered = exact partition, 252 challenging).

### Settings screen contract (`src/screens/SettingsScreen.tsx`)
- Section order: Appearance (theme radiogroup) → Practice (Daily goal stepper, Quiz prompts) → Audio (Travel mode fields [collapsible, default open], Game Arcade sound) → Your data (Import/Export) → About (About & legal [collapsible, default closed] — merges Terms/Privacy rows + partner logos).
- `CollapsibleCard` component: `LayoutAnimation.configureNext` on toggle + `Animated` chevron rotation (220ms). No native module dependency.
- `SwitchRow` component: the reusable full-row-pressable pattern — reuse this for any future toggle rather than a bare `<Switch>`.
- Measured scroll-depth reduction: 3 swipes → 2 swipes to reach the bottom on the physical device (scripted screenshot-diff measurement, not eyeballed).

### `words` table contract (schema v3, unchanged this session, 16 data columns)
```
word, pronunciation, audio_url, meaning, synonym_1, synonym_2,
antonym_1, antonym_2, example_sentence, layman_explanation(nullable),
word_origin(nullable), part_of_speech, word_forms,
difficulty_level(indexed), practice_status(indexed), created_at(indexed, readonly)
```
No schema changes this session.

### `local_storage` keys (unchanged this session — see `docs/OVERVIEW.md` §3 for the authoritative table)
`settings.dailyGoal`, `settings.travelFields`, `settings.quizUseSynonyms`, `settings.quizUseAntonyms`, `settings.gameSounds`, `settings.themeMode`, `settings.onboardingComplete`, `games.millionaire.bestScore`, `games.memory.bestMoves`, `games.stat.<key>`, `games.celebratedUnlocks`, `streak.state`. **Reminder: all string values in this table are double-JSON-encoded by WatermelonDB's own adapter** — see §2 gotcha above if manipulating any of these via raw SQL again.

## 5. Active State, Blockers & Open Items

- **Git**: `main` is clean and fully pushed to `origin/main` (`https://github.com/hemantsgitrepo/Vocab-Hub.git`). No uncommitted changes, no unpushed commits.
- **`npx tsc --noEmit`**: exit 0, clean, confirmed at session end.
- **Physical device (`RFCR9154J2E`) is disconnected** — was connected and used for the majority of this session's on-device verification, then dropped. Reconnect via USB and re-run `adb reverse tcp:8081 tcp:8081` before trusting any physical-device testing next session.
- **Both Settings and Travel Mode changes were visually verified on-device this session** (light + dark theme, category switching, playback under a filtered queue, collapsible expand/collapse, full-row tap targets) — high confidence, no known visual regressions.
- **Two content-accuracy issues flagged but NOT fixed** (legal text describes non-existent features — this is a compliance/wording issue, not a code bug, deliberately left for the user's judgment call):
  1. Privacy Policy §2C describes an email-notification feature (Hostinger SMTP) that does not exist anywhere in the codebase.
  2. Privacy Policy §3A promises a "Clear Local Storage" button under Settings that does not exist — worth adding now that Settings was just restructured, or the policy text should be corrected. **Not actioned; awaiting user decision.**
  3. (Minor) Privacy §2A mentions "XP levels" — no such system exists (only streaks/scores/game milestones). Terms §2 says "spaced repetition quizzes" — Quiz Arena is time-windowed (all-time/7-day/30-day), not spaced-repetition.
- **No committed test suite anywhere** (streak engine or otherwise) — same standing gap as prior sessions.
- **`ponytail` Claude Code plugin**: confirmed **disabled** (`enabledPlugins: {"ponytail@ponytail": false}` in `~/.claude/settings.json`, empty `hooks: {}`) — not relevant to app code, purely a tooling/environment question the user asked mid-session. A stale `~/.claude/.ponytail-active` marker file (content: `full`) exists and is inconsistent with the disabled state but is not read by anything active; user did not request it be deleted.
- **Nothing half-written.** All edits in flight were completed to a committed, typechecked, on-device-verified state before this hand-off. The very last user request ("run the app on the emulator") was **superseded** by this hand-off request before being acted on — no emulator launch is in progress.

## 6. Bootstrap Prompt for Next Session

```
Continue Vocab Hub development. Read HANDOFF.md at the project root first —
it is the full context dump from the prior session and supersedes any
earlier version. Do not re-derive project history; trust this document.
Then read docs/OVERVIEW.md for the full application summary (stack,
external refs, DB schema, every feature) — see §7 below.

First actions, in order:
1. `source ~/.zshrc >/dev/null 2>&1 && adb devices -l` — confirm current
   device/emulator state. The physical Galaxy M52 (RFCR9154J2E) was
   disconnected at hand-off; the emulator (emulator-5554) was connected.
   Both drift session to session — do not trust this doc blindly.
2. If testing on any device: `adb -s <serial> reverse tcp:8081 tcp:8081`
   — this drops on reconnect/reauthorization and caused two "Cannot
   connect to Expo CLI" false-alarm debugging detours last session.
3. `git status --short && git log --oneline -5` — confirm working tree is
   clean and top commit is 73d58e6. Confirm origin/main is still in sync
   (was pushed and verified clean at hand-off).
4. `npx tsc --noEmit` — confirm still clean (was clean at hand-off).
5. Debug APK at android/app/build/outputs/apk/debug/app-debug.apk is
   native-current as of Aug 6 11:45 — for JS-only changes, do NOT rebuild;
   Metro serves JS live to a debug build. Only rebuild if a native
   dependency or app.json plugin changes. A cold relaunch
   (`am force-stop` + relaunch) is sufficient to pick up JS changes.
6. Two open Settings/legal-content items are flagged in HANDOFF §5 —
   ask the user whether to act on the Privacy Policy content-accuracy
   gaps (missing "Clear Local Storage" button vs. policy text promising
   one; described-but-nonexistent email notifications) before touching
   anything there.

Ask the user what to work on next once the above verification pass is done.
```

## 7. `docs/OVERVIEW.md` — READ THIS

**`docs/OVERVIEW.md` exists and is current as of commit `bf8fbb3`** (this session's last doc sync). It is the canonical, detailed application summary: full tech stack table, complete external-reference list, full DB schema, a feature-by-feature breakdown (word management, Travel Mode incl. categories, Quiz Arena, Game Arcade, Streak system, onboarding, Legal & Privacy viewer, Settings layout, theming), build/distribution notes, and testing posture. **Read it before asking the user to re-explain what the app does.** Per `CLAUDE.md`, it must be kept in sync in the same change whenever a dependency/DB column/`local_storage` key/external URL/feature changes — this was followed correctly for every commit this session except the Settings restructure's `CLAUDE.md` sync (see §3 note — a deliberate, documented gap, not an oversight to blindly "fix").
