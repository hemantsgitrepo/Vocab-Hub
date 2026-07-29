import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import Word from './models/Word';

const adapter = new SQLiteAdapter({
  schema,
  jsi: true,
  onSetUpError: (error) => {
    console.error('Failed to set up the database', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Word],
});

export const wordsCollection = database.get<Word>('words');
