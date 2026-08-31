import { addColumns, createTable, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'words',
          columns: [
            { name: 'part_of_speech', type: 'string' },
            { name: 'word_forms', type: 'string' },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'words',
          columns: [{ name: 'word_origin', type: 'string', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        createTable({
          name: 'email_queue',
          columns: [
            { name: 'to_email', type: 'string' },
            { name: 'subject', type: 'string' },
            { name: 'html', type: 'string' },
            { name: 'email_type', type: 'string', isIndexed: true },
            { name: 'status', type: 'string', isIndexed: true },
            { name: 'attempts', type: 'number' },
            { name: 'last_error', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number', isIndexed: true },
            { name: 'sent_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
