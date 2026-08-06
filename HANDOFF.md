# Vocab Hub — Context Hand-off Summary
_Generated end of session, 2026-08-06. Paste into next session's opening message._

## 1. High-Level Project Goal & Architecture

**Vocab Hub**: offline-first vocabulary practice app for competitive-exam aspirants. React Native + Expo (managed workflow, New Architecture/bridgeless, SDK 57). No backend, no auth — single-user, fully on-device. Rebranded from "AptitudeWords" (display name only; native identifiers intentionally unchanged, see §3).

- **DB**: WatermelonDB (SQLite + JSI adapter), schema **v3**, `src/db/` — single model `Word.ts` (16 columns, legacy decorators applied manually — Babel decorator transform conflicts with `babel-preset-expo` on SDK 57)
- **Nav**: React Navigation bottom-tabs, 5 screens — Home (Dashboard), Add, Travel, Quiz, Settings (`App.tsx`, `src/screens/`)
- **UI**: React Native Paper (MD3) + Lucide icons + `expo-linear-gradient` + `react-native-svg`; pastel theme tokens in `src/theme.ts`, 3-way mode (`light`/`dark`/`system`) in `ThemeContext.tsx`
- **Animation**: React Native's built-in `Animated` API throughout — **`react-native-reanimated` deliberately NOT added**, even when a prior task's brief suggested it, to keep changes JS-only (no native rebuild required)
- **Audio**: `expo-audio` (SFX, `src/lib/sfx.ts`), `react-native-tts` (offline TTS, Travel Mode)
- **Dictionary**: multi-source, `src/api/dictionary.ts` — see §4
- **File I/O**: `expo-file-system`, `expo-sharing`, `expo-document-picker`
- **Lang**: TypeScript strict (`strictPropertyInitialization: false`)
- Package/bundle ID: `com.anonymous.AptitudeWords` (Expo default, **never renamed**, despite app being rebranded "Vocab Hub"; `app.json` `slug` also intentionally still `AptitudeWords`)

### Source tree (current)
```
src/
  api/          dictionary.ts (multi-source lookup)
  db/           schema.ts, migrations.ts, words.ts, settings.ts, csv.ts, models/Word.ts
  lib/          csv.ts, games.ts, sfx.ts, streakEngine.ts, guides.ts, tts helpers, text helpers
                (streak.ts REMOVED this session — superseded by streakEngine.ts)
  screens/      DashboardScreen, AddWordScreen, TravelModeScreen, QuizScreen,
                SettingsScreen, StreakJourneyModal, OnboardingScreen
    games/      GameArcade.tsx, VocabMillionaire.tsx, MemoryMatch.tsx,
                ScrabbleGame.tsx, CrosswordGame.tsx, SpellingBeeGame.tsx,
                Confetti.tsx, gameVisuals.ts
  ui/           AppDialogs.tsx, EmptyState.tsx, InfoSheet.tsx,
                StreakCard.tsx, StreakCalendar.tsx, StreakMilestoneModal.tsx,
                StreakRepairModal.tsx, UnlockCelebration.tsx, UnlockProvider.tsx
  theme.ts, ThemeContext.tsx, hooks.ts
docs/OVERVIEW.md   canonical application summary (NEW this session — see §7)
test-data/         vocab-hub-seed-data.csv (232 words) + README.md — QA seed set
```

## 2. Hardware Setup & Runtime Configuration

- **Host**: macOS (Darwin, Apple Silicon), Node v22.23.1, npm 10.9.8
- **Android toolchain**: `ANDROID_HOME=/Users/hemantsawant/Library/Android/sdk`, `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home` — both exported via `~/.zshrc`. **Every Bash call touching adb/gradle/java must start with `source ~/.zshrc >/dev/null 2>&1 &&`**, and add `platform-tools` to `PATH` for `adb`.
- **Devices**, both connected at session end (re-verify with `adb devices -l` — state can drift):
  - Emulator `Pixel_8`-class (`sdk_gphone64_arm64`, ARM64), serial `emulator-5554`.
  - Physical Samsung Galaxy M52, serial `RFCR9154J2E`.
- **Metro**: running on :8081 at session end (`lsof -ti :8081` → PIDs present). No log file path recorded.
- **⚠️ Both built APKs are STALE relative to code** — do not hand either out or trust on-device testing without rebuilding first:
  - `android/app/build/outputs/apk/debug/app-debug.apk` — built **Aug 6 00:43**, i.e. mid-session, **before** the dictionary multi-source upgrade and the StreakJourneyModal UI rework (calendar-in-detail-screen). It reflects an intermediate state.
  - `android/app/build/outputs/apk/release/app-release.apk` — built **Jul 31 23:25**, predates the entire streak system, dictionary upgrade, and onboarding polish from this session.
  - **Must run `./gradlew assembleDebug` (or `assembleRelease`) fresh before any further on-device verification or distribution.** JS-only changes since the last APK do NOT require `expo prebuild` — only a rebuild.
- **⚠️ Emulator app data is DIRTY test fixtures, not representative state**: `watermelon.db` was directly manipulated via `adb exec-out run-as … cat/push` during this session to seed ~55 words across Jul 28–Aug 5 with a deliberately-skipped Aug 3 (freeze-protected day), `currentStreak: 7`, `freezes: 0`, plus earlier unrelated test words for game-unlock testing. **Do not treat the emulator's current word count/streak/game-unlock state as a fresh install.** Wipe (`adb shell pm clear com.anonymous.AptitudeWords`) before any "first-launch" verification.
- No local LLM runtime, no GPU allocation, no MCP-served model — pure Claude Code + Bash/adb/gradle/sqlite3/python3 toolchain. Python3 + Pillow were used ad hoc for logo transparency work; sqlite3 CLI + Python for direct DB seeding.
- Model: session ran across Sonnet 5 and Opus 5 (user-toggled mid-session); ended on Sonnet 5.

## 3. `CLAUDE.md` & Project Rulebook State

- **Global** (`~/.claude/CLAUDE.md`): think-before-coding, simplicity-first, surgical diffs, goal-driven verification. Unchanged.
- **Project** (`AptitudeWords/CLAUDE.md`): **fully synced this session** — no known drift remaining. Current contents:
  - Tech stack line now reads "APIs (all free & keyless): Free Dictionary API (primary), Wiktionary MediaWiki `action=parse` (etymology + curated syn/ant), Datamuse (syn/ant backfill) — all in `src/api/dictionary.ts`"
  - App Requirements §7 (new): **Streak System** — forgiving daily-goal streak, 2hr grace period, 1 freeze/10 days, 48hr repair challenge, milestones 7/14/30/50/100, `src/lib/streakEngine.ts` / `streak.state` in settings.
  - New **Documentation** section: `docs/OVERVIEW.md` is canonical app summary; **must be kept in sync** whenever a dependency, DB column, `local_storage` key, external URL, or user-facing feature changes — update the matching section **in the same change**.
- **No test suite** (no Jest, no CI). Verification method throughout: manual on-device walkthrough (`adb shell screencap`), direct SQLite inspection/seeding via `adb exec-out run-as … cat`, and `adb logcat` grepped for `AudioFlinger`/`MediaSessionService` for audio confirmation.
- **Established convention this session**: for date/state-machine-heavy logic (the streak engine), write pure functions with injectable `now`, compile standalone via `npx tsc --ignoreConfig --outDir <tmp> --ignoreConfig`, and run a hand-written Node scenario-test harness BEFORE wiring into UI. This caught two real bugs (see §4) that would have shipped otherwise. These 41 tests are **not committed** — see §5.
- **Established convention**: never add `react-native-reanimated` opportunistically even when a task brief suggests it — the existing codebase is 100% built-in `Animated`, and adding it forces a native rebuild for what should be a JS-only change. Flag the tradeoff and let the user decide.

## 4. Features Implemented & Current Progress

All work is **committed** to local `main` (branch is **3 commits ahead of `origin/main`, NOT pushed** — see §5). Commits this session, most-recent first:

| Commit | Feature | Key files |
|---|---|---|
| `161e333` | **docs/OVERVIEW.md + CLAUDE.md sync** | `docs/OVERVIEW.md` (new, 135 lines — stack, external refs, full DB schema incl. `local_storage` key table, every feature, build/distribution, testing posture), `CLAUDE.md` (+API line, +Streak System line, +Documentation section) |
| `cfd0357` | **Multi-source dictionary auto-fill** | `src/api/dictionary.ts` (rewritten — Free Dictionary API + Wiktionary `action=parse` wikitext parsing + Datamuse, parallel fetch w/ 8s timeout each, `FieldSource` provenance per field), `src/screens/AddWordScreen.tsx` (pastel provenance badges per field, badge clears on manual edit, "Filling…" loading state) |
| `f82f29c` | **Forgiving streak management system** | `src/lib/streakEngine.ts` (new, 362 lines, pure engine), `src/hooks.ts` (+`useStreakManager`), `src/db/settings.ts` (+`streak.state` key), `src/ui/StreakCard.tsx` `StreakCalendar.tsx` `StreakMilestoneModal.tsx` `StreakRepairModal.tsx` (new), `src/screens/DashboardScreen.tsx` (streak card wired in, calendar/celebration/repair modals wired), `src/screens/StreakJourneyModal.tsx` (rewritten — node-path visualization removed, replaced with `StreakCalendar` + freeze/repair explainer, header re-skinned amber/coral to match Dashboard card), `src/lib/streak.ts` **deleted** (superseded) |
| `562898f` | Partner logo transparency fix (prior turn, confirmed intact) | — |
| `6e311bb` | Onboarding & discovery system (prior turn, confirmed intact) | — |

### Streak engine contract (`src/lib/streakEngine.ts`)
- **Day completion is always DERIVED** from `Word.createdAt` via `countsByDay()` — never trust a cached count. Only the non-derivable overlay is persisted: freeze inventory, protected days, open repair challenge, celebrated milestones (`StreakState` interface, JSON in `local_storage['streak.state']`, versioned).
- **Grace period**: `effectiveDay(now)` — before 2:00 AM, the previous calendar day is "today". `GRACE_HOURS = 2`. This is now used consistently by the Dashboard hero's "Today's progress" AND the streak card — previously these two would disagree between midnight and 2am.
- **Freeze**: `FREEZE_EVERY = 10`. Awarded against the **visible** (not just settled) streak via `freezeAwardedFor` idempotency guard — a bug where freezes were granted a day late (only from settled days) was caught by tests and fixed.
- **Repair**: `MIN_REPAIRABLE = 3` (shorter streaks aren't offered repair), target = `max(10, goal*2)`, window = `REPAIR_WINDOW_HOURS = 48`.
- **Milestones**: `[7, 14, 30, 50, 100]` — the StreakJourneyModal's OLD hardcoded list `[3,7,14,21,30,50,100,365]` was a drift bug (fixed by importing `MILESTONES` from the engine).
- **Key functions**: `settle()` (advance through elapsed days), `reconcile()` (settle + resolve repair — the ONLY place repair resolution happens, so display can't disagree with logic), `project()` (fold today in for display, returns `StreakView`), `pendingMilestone()`, `monthGrid()` (calendar cell classification: `met`/`protected`/`missed`/`future`/`idle`).
- **Celebration collision fix**: a bulk import can cross a game-unlock threshold AND a streak milestone simultaneously. `DashboardScreen` now checks `useUnlockCelebration()` and suppresses the streak milestone modal while a game-unlock celebration is showing, to avoid two stacked fanfares (caught live during on-device testing).

### Dictionary service contract (`src/api/dictionary.ts`)
- `lookupWord(word)` queries all 3 sources via `Promise.all` — one slow/dead source degrades, doesn't fail the lookup.
- Synonym/antonym merge priority: dictionary → Wiktionary curated `{{syn}}`/`{{ant}}` → Datamuse (score ≥500 threshold, else discarded as noise).
- Wiktionary etymology parsing (`fetchWiktionary`, `cleanWikitext`) handles: `{{bor|lbor|der|inh}}` borrowing templates, `{{m|l|cog}}` mention templates, `{{sl|calque}}` semantic-loan templates, `{{suffix|prefix|affix}}` word-formation, `{{w|Target|Label}}` wikipedia links, `{{coin}}` coinage, and structured `{{ety|en|:bor|la:term<t:gloss>|tree=1}}` trees (some entries, e.g. "candid", have ONLY this structured form with no prose — required a dedicated parser branch). Verified against live API responses for: meticulous, ephemeral, serendipity, ubiquitous, candid, gregarious, prudent, tenacious.
- Two fields always locally derived (no free source exists): `laymanExplanation` (`simplifyDefinition()` — text heuristic, NOT comprehension) and `example` fallback (`buildExample()` — part-of-speech template), used only when the dictionary supplies none.
- `FieldSource = 'dictionary' | 'wiktionary' | 'datamuse' | 'generated'` returned per-field in `DictionaryResult.sources`, consumed by `AddWordScreen` for badge rendering.

### `words` table contract (schema v3, unchanged this session, 16 data columns)
```
word, pronunciation, audio_url, meaning, synonym_1, synonym_2,
antonym_1, antonym_2, example_sentence, layman_explanation(nullable),
word_origin(nullable), part_of_speech, word_forms,
difficulty_level(indexed), practice_status(indexed), created_at(indexed, readonly)
```
No schema changes this session — all new state (streak overlay) is `local_storage` key/value, not new tables/columns.

### `local_storage` keys (full current list, see `docs/OVERVIEW.md` §3 for authoritative table)
`settings.dailyGoal`, `settings.travelFields`, `settings.quizUseSynonyms`, `settings.quizUseAntonyms`, `settings.gameSounds`, `settings.themeMode`, `settings.onboardingComplete`, `games.millionaire.bestScore`, `games.memory.bestMoves`, `games.stat.<key>`, `games.celebratedUnlocks`, **`streak.state`** (new this session).

## 5. Active State, Blockers & Open Items

- **Git**: local `main` is **3 commits AHEAD of `origin/main`, NOT PUSHED**. User explicitly said "do not build the APK yet" — push status was not addressed after that; confirm with user before pushing or building.
- **`npx tsc --noEmit`**: exit 0, clean, confirmed at session end (final check ran after all edits).
- **No committed test suite** for the streak engine. 41 zero-dependency scenario tests (grace period, freeze earn/spend, repair completion/expiry, idempotency, milestones, calendar classification) were written and ALL PASSED during development, but they live only in the ephemeral scratchpad directory (`/private/tmp/claude-501/…/scratchpad/test.js`) and **will be lost with this session**. Recommend recreating and committing as a real Jest suite (or at minimum a checked-in Node script) early next session if this logic gets touched again.
- **Both APKs are stale** — see §2. Must rebuild before any distribution or on-device demo.
- **Emulator has dirty seeded test data** — see §2. `pm clear` before trusting any "fresh install" observation.
- **No known TypeScript errors, no known crashes.** Every UI surface implemented this session was visually verified on-device via screenshot (Dashboard streak card, calendar, milestone modal, game-unlock/streak-milestone collision handling, Add Word auto-fill badges) EXCEPT:
  - **`StreakRepairModal` visual appearance is UNVERIFIED on-device.** Its logic is covered by the (now-lost) unit tests, but triggering it live requires fabricating a genuinely broken streak with no freeze, which wasn't done this session. Worth a targeted on-device check before considering the feature fully done.
  - **The StreakJourneyModal rework (calendar replacing node-path, amber/coral re-skin, freeze/repair explainer section) was implemented via scripted Python line-splice + Edit calls and passed `tsc`, but was NOT visually re-verified on-device after the edit** (session moved to commit/wrap-up immediately after). This is the highest-risk unverified surface — recommend a screenshot pass first thing next session.
- **Nothing half-written.** All edits in flight were completed to a committed, typechecked state before this hand-off.

## 6. Bootstrap Prompt for Next Session

```
Continue Vocab Hub development. Read HANDOFF.md at the project root first —
it's the full context dump from the prior session. Do not re-derive project
history; trust this document. Then read docs/OVERVIEW.md for the full
application summary (stack, external refs, DB schema, every feature) — see
§7 below.

First actions, in order:
1. `source ~/.zshrc >/dev/null 2>&1 && adb devices -l` — confirm current
   device/emulator state; serials can drift, don't trust this doc blindly.
2. `git status --short && git log --oneline -8` — confirm working tree is
   clean and top commit is 161e333. Confirm whether `origin/main` has since
   been updated (this session ended 3 commits ahead, unpushed) — ask the
   user whether to push before doing anything else if untracked ahead-state
   still exists.
3. `npx tsc --noEmit` — confirm still clean (was clean at hand-off).
4. Rebuild the debug APK before ANY on-device verification —
   `cd android && ./gradlew assembleDebug` — both existing APKs are stale
   relative to code (see §2). No `expo prebuild` needed, JS-only changes.
5. `adb shell pm clear com.anonymous.AptitudeWords` on the emulator before
   trusting any "fresh install" behavior — current app data is seeded test
   fixtures from prior-session manual DB manipulation, not representative.
6. PRIORITY VERIFICATION GAP: screenshot-check the reworked
   StreakJourneyModal (src/screens/StreakJourneyModal.tsx) on-device — it
   was edited via scripted line-splice this session and typechecked but was
   NEVER visually re-verified. Confirm the calendar renders correctly in
   place of the old node-path, the header is amber/coral (not the old
   blue/violet), and the freeze/repair explainer card reads correctly.
   Also screenshot-verify StreakRepairModal, which has never been seen
   on-device at all (requires fabricating a broken streak with 0 freezes).
7. If touching streakEngine.ts again: recreate the 41-scenario test harness
   before making changes — see HANDOFF §5 for what it covered (grace
   period, freeze earn/spend, repair completion/expiry, idempotency,
   milestones, calendar classification) and consider committing it as a
   real test file this time so it survives across sessions.

No other known bugs or blockers. Ask the user what to work on next once
the above verification pass is done.
```

## 7. `docs/OVERVIEW.md` — READ THIS

**`docs/OVERVIEW.md` exists and is current as of commit `161e333`** (this session created it). It is the canonical, detailed application summary: full tech stack table, complete external-reference list with exact URLs and what each supplies, full DB schema (`words` table + `local_storage` key table), a feature-by-feature breakdown (word management, Travel Mode, Quiz Arena, Game Arcade w/ unlock thresholds, Streak system, onboarding/discovery, theming), build/distribution notes, and testing posture. **Read it before asking the user to re-explain what the app does.** Per `CLAUDE.md`, it must be kept in sync in the same change whenever a dependency/DB column/`local_storage` key/external URL/feature changes — do not let it drift.
