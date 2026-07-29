# AptitudeWords Project Conventions

## Tech Stack & Core Libraries
- **Framework:** React Native with Expo (Managed Workflow)
- **Database:** WatermelonDB (Offline-first, reactive persistent storage)
- **TTS:** react-native-tts (Offline native text-to-speech)
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
   - Created At (timestamp), Difficulty Level, Practice Status
3. **Audio / Travel Mode:** Continuous back-to-back playback of words + meanings with pause intervals, TTS pitch/speed control, and background audio readiness.
4. **Testing Engine:** Dynamic quizzes (Flashcards, Multiple Choice, Fill-in-the-Blanks) based on user's learned vocabulary pool.

## Code Standards
- Use TypeScript for strict type checking.
- Keep UI modern, vibrant, and clean with intuitive animations. Give Claude design freedom for layout, themes, and micro-interactions.
- Do not use paid APIs or third-party paid services.