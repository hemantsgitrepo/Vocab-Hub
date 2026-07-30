import { csvParse, csvStringify } from '../lib/csv';
import Word, { DifficultyLevel } from './models/Word';
import { createWord, fetchAllWords } from './words';

interface WordCsvFields {
  word: string;
  pronunciation: string;
  partOfSpeech: string;
  wordForms: string;
  meaning: string;
  synonym1: string;
  synonym2: string;
  antonym1: string;
  antonym2: string;
  exampleSentence: string;
  wordOrigin: string;
  laymanExplanation: string;
  difficultyLevel: string;
  audioUrl: string;
}

const WORD_CSV_COLUMNS: { header: string; key: keyof WordCsvFields }[] = [
  { header: 'Word', key: 'word' },
  { header: 'Pronunciation', key: 'pronunciation' },
  { header: 'Part of Speech', key: 'partOfSpeech' },
  { header: 'Word Forms', key: 'wordForms' },
  { header: 'Meaning', key: 'meaning' },
  { header: 'Synonym 1', key: 'synonym1' },
  { header: 'Synonym 2', key: 'synonym2' },
  { header: 'Antonym 1', key: 'antonym1' },
  { header: 'Antonym 2', key: 'antonym2' },
  { header: 'Example Sentence', key: 'exampleSentence' },
  { header: 'Word Origin', key: 'wordOrigin' },
  { header: 'Layman Explanation', key: 'laymanExplanation' },
  { header: 'Difficulty', key: 'difficultyLevel' },
  { header: 'Audio URL', key: 'audioUrl' },
];

const CSV_HEADERS = WORD_CSV_COLUMNS.map((c) => c.header);

export function wordsToCsv(words: Word[]): string {
  const rows = words.map((w) => [
    w.word,
    w.pronunciation,
    w.partOfSpeech,
    w.wordForms,
    w.meaning,
    w.synonym1,
    w.synonym2,
    w.antonym1,
    w.antonym2,
    w.exampleSentence,
    w.wordOrigin ?? '',
    w.laymanExplanation ?? '',
    w.difficultyLevel,
    w.audioUrl,
  ]);
  return csvStringify([CSV_HEADERS, ...rows]);
}

export const CSV_TEMPLATE = csvStringify([
  CSV_HEADERS,
  [
    'Meticulous',
    '/mɪˈtɪkjʊləs/',
    'adjective',
    'adverb: meticulously',
    'Characterized by very precise, conscientious attention to detail.',
    'Careful',
    'Precise',
    'Careless',
    'Sloppy',
    'She was meticulous in checking every detail of the report.',
    'From Latin meticulosus, meaning "fearful, timid".',
    'Being extremely careful and paying attention to every small detail.',
    'medium',
    '',
  ],
]);

export interface ImportError {
  /** 1-based row number as it appears in a spreadsheet (header is row 1). */
  row: number;
  word: string;
  message: string;
}

interface ParsedWordRow {
  word: string;
  pronunciation: string;
  partOfSpeech: string;
  wordForms: string;
  meaning: string;
  synonym1: string;
  synonym2: string;
  antonym1: string;
  antonym2: string;
  exampleSentence: string;
  wordOrigin: string;
  laymanExplanation: string;
  difficultyLevel: DifficultyLevel;
  audioUrl: string;
}

const DIFFICULTY_VALUES: DifficultyLevel[] = ['easy', 'medium', 'hard'];

function parseWordsCsv(
  text: string,
  existingWords: Set<string>
): { rows: ParsedWordRow[]; errors: ImportError[] } {
  const table = csvParse(text);
  if (table.length === 0) {
    return { rows: [], errors: [{ row: 0, word: '', message: 'The file is empty.' }] };
  }

  const header = table[0].map((h) => h.trim().toLowerCase());
  const indexFor = (headerName: string) => header.indexOf(headerName.toLowerCase());
  const wordIdx = indexFor('word');
  const meaningIdx = indexFor('meaning');
  if (wordIdx === -1 || meaningIdx === -1) {
    const missing = [wordIdx === -1 && 'Word', meaningIdx === -1 && 'Meaning'].filter(Boolean);
    return {
      rows: [],
      errors: [
        {
          row: 1,
          word: '',
          message: `The file is missing the required "${missing.join('" and "')}" column${missing.length > 1 ? 's' : ''}. Download the CSV template to see the expected format.`,
        },
      ],
    };
  }

  const colIndex: Record<string, number> = {};
  for (const col of WORD_CSV_COLUMNS) colIndex[col.key] = indexFor(col.header);

  const errors: ImportError[] = [];
  const rows: ParsedWordRow[] = [];
  const seenInFile = new Set<string>();

  for (let i = 1; i < table.length; i++) {
    const raw = table[i];
    const rowNum = i + 1;
    const get = (key: keyof WordCsvFields) => {
      const idx = colIndex[key];
      return idx === -1 || idx >= raw.length ? '' : raw[idx].trim();
    };

    const word = get('word');
    const meaning = get('meaning');
    const label = word || `(row ${rowNum}, blank word)`;

    if (!word) {
      errors.push({ row: rowNum, word: label, message: 'Word is required but is blank.' });
      continue;
    }
    if (!meaning) {
      errors.push({ row: rowNum, word: label, message: `"${word}" is missing a Meaning.` });
      continue;
    }

    const key = word.toLowerCase();
    if (seenInFile.has(key)) {
      errors.push({ row: rowNum, word: label, message: `"${word}" appears more than once in this file.` });
      continue;
    }
    if (existingWords.has(key)) {
      errors.push({ row: rowNum, word: label, message: `"${word}" is already in your word list.` });
      continue;
    }

    const difficultyRaw = get('difficultyLevel');
    const difficultyLevel = (difficultyRaw.toLowerCase() || 'medium') as DifficultyLevel;
    if (!DIFFICULTY_VALUES.includes(difficultyLevel)) {
      errors.push({
        row: rowNum,
        word: label,
        message: `"${word}" has an invalid Difficulty value "${difficultyRaw}" — must be easy, medium, or hard.`,
      });
      continue;
    }

    seenInFile.add(key);
    rows.push({
      word,
      meaning,
      pronunciation: get('pronunciation'),
      partOfSpeech: get('partOfSpeech'),
      wordForms: get('wordForms'),
      synonym1: get('synonym1'),
      synonym2: get('synonym2'),
      antonym1: get('antonym1'),
      antonym2: get('antonym2'),
      exampleSentence: get('exampleSentence'),
      wordOrigin: get('wordOrigin'),
      laymanExplanation: get('laymanExplanation'),
      difficultyLevel,
      audioUrl: get('audioUrl'),
    });
  }

  return { rows, errors };
}

/**
 * Validates the whole file before writing anything — a partial import would
 * leave the user unsure which rows made it in, so either every valid row is
 * imported or none are, and every problem found is reported at once so a
 * single fix-and-resubmit cycle is enough.
 */
export async function importWordsFromCsv(
  text: string
): Promise<{ imported: number; errors: ImportError[] }> {
  const existing = await fetchAllWords();
  const existingWords = new Set(existing.map((w) => w.word.toLowerCase()));
  const { rows, errors } = parseWordsCsv(text, existingWords);
  if (errors.length > 0) {
    return { imported: 0, errors };
  }
  for (const r of rows) {
    await createWord({
      word: r.word,
      pronunciation: r.pronunciation,
      audioUrl: r.audioUrl || undefined,
      meaning: r.meaning,
      synonyms: [r.synonym1, r.synonym2],
      antonyms: [r.antonym1, r.antonym2],
      exampleSentence: r.exampleSentence,
      laymanExplanation: r.laymanExplanation || undefined,
      wordOrigin: r.wordOrigin || undefined,
      partOfSpeech: r.partOfSpeech,
      wordForms: r.wordForms,
      difficultyLevel: r.difficultyLevel,
    });
  }
  return { imported: rows.length, errors: [] };
}
