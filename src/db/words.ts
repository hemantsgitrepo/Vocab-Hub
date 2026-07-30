import { Q } from '@nozbe/watermelondb';
import { database, wordsCollection } from './index';
import Word, { DifficultyLevel, PracticeStatus } from './models/Word';
import { capitalizeFirst } from '../lib/text';

export interface NewWordInput {
  word: string;
  pronunciation: string;
  audioUrl?: string;
  meaning: string;
  synonyms: [string, string];
  antonyms: [string, string];
  exampleSentence: string;
  laymanExplanation?: string;
  wordOrigin?: string;
  partOfSpeech?: string;
  wordForms?: string;
  difficultyLevel?: DifficultyLevel;
}

/** Case-insensitive check so "meticulous" and "Meticulous" count as the same word. */
export async function wordExists(word: string): Promise<boolean> {
  const target = word.trim().toLowerCase();
  if (!target) return false;
  const all = await fetchAllWords();
  return all.some((w) => w.word.toLowerCase() === target);
}

export function createWord(input: NewWordInput): Promise<Word> {
  return database.write(() =>
    wordsCollection.create((w) => {
      // Capitalized here (not just in the form) so every save path is covered.
      // Pronunciation is left alone — it's IPA, e.g. /ˌsɛɹənˈdɪpɪti/.
      w.word = capitalizeFirst(input.word);
      w.pronunciation = input.pronunciation.trim();
      w.audioUrl = input.audioUrl ?? '';
      w.meaning = capitalizeFirst(input.meaning);
      w.synonym1 = capitalizeFirst(input.synonyms[0]);
      w.synonym2 = capitalizeFirst(input.synonyms[1]);
      w.antonym1 = capitalizeFirst(input.antonyms[0]);
      w.antonym2 = capitalizeFirst(input.antonyms[1]);
      w.exampleSentence = capitalizeFirst(input.exampleSentence);
      w.laymanExplanation = capitalizeFirst(input.laymanExplanation ?? '') || null;
      w.wordOrigin = capitalizeFirst(input.wordOrigin ?? '') || null;
      // Grammar labels stay lowercase, as dictionaries print them.
      w.partOfSpeech = (input.partOfSpeech ?? '').trim();
      w.wordForms = (input.wordForms ?? '').trim();
      w.difficultyLevel = input.difficultyLevel ?? 'medium';
      w.practiceStatus = 'new';
    })
  );
}

export function setPracticeStatus(word: Word, status: PracticeStatus): Promise<Word> {
  return database.write(() =>
    word.update((w) => {
      w.practiceStatus = status;
    })
  );
}

export function deleteWord(word: Word): Promise<void> {
  return database.write(() => word.destroyPermanently());
}

/** All words, newest first. Observable — screens subscribe and stay live. */
export function observeAllWords() {
  return wordsCollection.query(Q.sortBy('created_at', Q.desc)).observe();
}

/** One-shot fetch of all words, newest first. */
export function fetchAllWords(): Promise<Word[]> {
  return wordsCollection.query(Q.sortBy('created_at', Q.desc)).fetch();
}

/** Words added in the last `days` days (for "test me on the past X days"). */
export function wordsFromPastDays(days: number): Promise<Word[]> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return wordsCollection
    .query(Q.where('created_at', Q.gte(cutoff)), Q.sortBy('created_at', Q.desc))
    .fetch();
}
