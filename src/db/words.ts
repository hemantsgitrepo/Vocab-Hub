import { Q } from '@nozbe/watermelondb';
import { database, wordsCollection } from './index';
import Word, { DifficultyLevel, PracticeStatus } from './models/Word';

export interface NewWordInput {
  word: string;
  pronunciation: string;
  audioUrl?: string;
  meaning: string;
  synonyms: [string, string];
  antonyms: [string, string];
  exampleSentence: string;
  laymanExplanation?: string;
  difficultyLevel?: DifficultyLevel;
}

export function createWord(input: NewWordInput): Promise<Word> {
  return database.write(() =>
    wordsCollection.create((w) => {
      w.word = input.word.trim();
      w.pronunciation = input.pronunciation.trim();
      w.audioUrl = input.audioUrl ?? '';
      w.meaning = input.meaning.trim();
      w.synonym1 = input.synonyms[0].trim();
      w.synonym2 = input.synonyms[1].trim();
      w.antonym1 = input.antonyms[0].trim();
      w.antonym2 = input.antonyms[1].trim();
      w.exampleSentence = input.exampleSentence.trim();
      w.laymanExplanation = input.laymanExplanation?.trim() || null;
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
