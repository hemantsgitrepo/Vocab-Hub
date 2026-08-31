import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 4,
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
        { name: 'word_origin', type: 'string', isOptional: true },
        { name: 'part_of_speech', type: 'string' },
        { name: 'word_forms', type: 'string' },
        { name: 'difficulty_level', type: 'string', isIndexed: true },
        { name: 'practice_status', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number', isIndexed: true },
      ],
    }),
    // Offline-resilient outbox for lifecycle emails (welcome, milestone,
    // streak, etc). A row is created immediately when an event fires; the
    // email service drains this table whenever the device has connectivity,
    // so nothing is lost if the user is offline at the moment of the event.
    tableSchema({
      name: 'email_queue',
      columns: [
        { name: 'to_email', type: 'string' },
        { name: 'subject', type: 'string' },
        { name: 'html', type: 'string' },
        { name: 'email_type', type: 'string', isIndexed: true },
        // 'pending' | 'sent' | 'failed' — 'failed' is only reached after
        // repeated attempts; the queue keeps retrying 'pending' rows.
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'attempts', type: 'number' },
        { name: 'last_error', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number', isIndexed: true },
        { name: 'sent_at', type: 'number', isOptional: true },
      ],
    }),
  ],
});
