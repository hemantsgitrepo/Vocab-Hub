import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'words',
      columns: [
        { name: 'word', type: 'string' },
        { name: 'pronunciation', type: 'string' },
        { name: 'audio_url', type: 'string' },
        { name: 'meaning', type: 'string' },
        { name: 'synonym_1', type: 'string' },
        { name: 'synonym_2', type: 'string' },
        { name: 'antonym_1', type: 'string' },
        { name: 'antonym_2', type: 'string' },
        { name: 'example_sentence', type: 'string' },
        { name: 'layman_explanation', type: 'string', isOptional: true },
        { name: 'part_of_speech', type: 'string' },
        { name: 'word_forms', type: 'string' },
        { name: 'difficulty_level', type: 'string', isIndexed: true },
        { name: 'practice_status', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number', isIndexed: true },
      ],
    }),
  ],
});
