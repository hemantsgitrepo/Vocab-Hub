import { addColumns, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

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
  ],
});
