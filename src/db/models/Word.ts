import { Model } from '@nozbe/watermelondb';
import { date, readonly, text } from '@nozbe/watermelondb/decorators';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type PracticeStatus = 'new' | 'learning' | 'mastered';

export default class Word extends Model {
  static table = 'words';

  @text('word') word!: string;
  @text('pronunciation') pronunciation!: string;
  @text('audio_url') audioUrl!: string;
  @text('meaning') meaning!: string;
  @text('synonym_1') synonym1!: string;
  @text('synonym_2') synonym2!: string;
  @text('antonym_1') antonym1!: string;
  @text('antonym_2') antonym2!: string;
  @text('example_sentence') exampleSentence!: string;
  @text('layman_explanation') laymanExplanation!: string | null;
  @text('difficulty_level') difficultyLevel!: DifficultyLevel;
  @text('practice_status') practiceStatus!: PracticeStatus;
  @readonly @date('created_at') createdAt!: Date;

  get synonyms(): string[] {
    return [this.synonym1, this.synonym2].filter(Boolean);
  }

  get antonyms(): string[] {
    return [this.antonym1, this.antonym2].filter(Boolean);
  }
}
