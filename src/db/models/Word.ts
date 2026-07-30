import { Model } from '@nozbe/watermelondb';
import { date, readonly, text } from '@nozbe/watermelondb/decorators';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type PracticeStatus = 'new' | 'learning' | 'mastered';

// Class/interface declaration merging: types the decorator-backed instance
// properties without emitting any class fields for Babel to mangle.
interface Word {
  word: string;
  pronunciation: string;
  audioUrl: string;
  meaning: string;
  synonym1: string;
  synonym2: string;
  antonym1: string;
  antonym2: string;
  exampleSentence: string;
  laymanExplanation: string | null;
  wordOrigin: string | null;
  /** Primary grammatical form, e.g. "adjective". */
  partOfSpeech: string;
  /** Other grammatical variants, e.g. "adverb: capriciously". */
  wordForms: string;
  difficultyLevel: DifficultyLevel;
  practiceStatus: PracticeStatus;
  readonly createdAt: Date;
}

class Word extends Model {
  static table = 'words';

  get synonyms(): string[] {
    return [this.synonym1, this.synonym2].filter(Boolean);
  }

  get antonyms(): string[] {
    return [this.antonym1, this.antonym2].filter(Boolean);
  }
}

export default Word;

// Babel's decorator transform conflicts with babel-preset-expo (SDK 57), so
// WatermelonDB's legacy decorators are applied manually instead of via @syntax.
type LegacyDecorator = (
  target: unknown,
  key: string,
  desc: PropertyDescriptor
) => PropertyDescriptor;

function applyDecorators(key: string, ...decorators: LegacyDecorator[]) {
  // `initializer: null` mimics Babel's legacy field descriptor — WatermelonDB's
  // ensureDecoratorUsedProperly requires the key to be present.
  let desc: PropertyDescriptor = {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: null,
  } as PropertyDescriptor;
  // Stacked decorators apply innermost (rightmost) first, like @a @b field.
  for (const dec of [...decorators].reverse()) {
    desc = dec(Word.prototype, key, desc) ?? desc;
  }
  delete (desc as { initializer?: unknown }).initializer;
  if (desc.get || desc.set) delete desc.writable;
  Object.defineProperty(Word.prototype, key, desc);
}

applyDecorators('word', text('word') as unknown as LegacyDecorator);
applyDecorators('pronunciation', text('pronunciation') as unknown as LegacyDecorator);
applyDecorators('audioUrl', text('audio_url') as unknown as LegacyDecorator);
applyDecorators('meaning', text('meaning') as unknown as LegacyDecorator);
applyDecorators('synonym1', text('synonym_1') as unknown as LegacyDecorator);
applyDecorators('synonym2', text('synonym_2') as unknown as LegacyDecorator);
applyDecorators('antonym1', text('antonym_1') as unknown as LegacyDecorator);
applyDecorators('antonym2', text('antonym_2') as unknown as LegacyDecorator);
applyDecorators('exampleSentence', text('example_sentence') as unknown as LegacyDecorator);
applyDecorators('laymanExplanation', text('layman_explanation') as unknown as LegacyDecorator);
applyDecorators('wordOrigin', text('word_origin') as unknown as LegacyDecorator);
applyDecorators('partOfSpeech', text('part_of_speech') as unknown as LegacyDecorator);
applyDecorators('wordForms', text('word_forms') as unknown as LegacyDecorator);
applyDecorators('difficultyLevel', text('difficulty_level') as unknown as LegacyDecorator);
applyDecorators('practiceStatus', text('practice_status') as unknown as LegacyDecorator);
applyDecorators(
  'createdAt',
  readonly as unknown as LegacyDecorator,
  date('created_at') as unknown as LegacyDecorator
);
