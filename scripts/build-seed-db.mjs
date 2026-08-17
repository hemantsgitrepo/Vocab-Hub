#!/usr/bin/env node
//
// Regenerates test-data/vocab-hub-seed.db from test-data/vocab-hub-seed-data.csv.
//
//   node scripts/build-seed-db.mjs
//
// The committed snapshot was captured from a real device, so it already matches
// what the app writes. Re-run this only when the CSV changes or a schema
// migration lands — then re-verify with ./scripts/seed-device.sh.
//
// Emits SQL and pipes it through the sqlite3 CLI, so there's no native module
// to install. Everything it writes mirrors src/db/ — see SCHEMA_VERSION below.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSV_PATH = join(REPO_ROOT, 'test-data', 'vocab-hub-seed-data.csv');
const DB_PATH = join(REPO_ROOT, 'test-data', 'vocab-hub-seed.db');

// Must track src/db/schema.ts. WatermelonDB stores it as PRAGMA user_version
// and refuses to open a database whose version it doesn't recognise.
const SCHEMA_VERSION = 3;

// Mirrors src/lib/csv.ts — a plain split(',') corrupts quoted fields.
function csvParse(text) {
  const input = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 2; } else { inQuotes = false; i++; }
      } else { field += c; i++; }
      continue;
    }
    if (c === '"') { inQuotes = true; i++; }
    else if (c === ',') { row.push(field); field = ''; i++; }
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = ''; i++;
    } else { field += c; i++; }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f !== ''));
}

// Mirrors src/lib/text.ts.
const capitalizeFirst = (s) => {
  const t = s.trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
};

// Deterministic ids keep regeneration diff-free; format matches WatermelonDB's
// 16-char alphanumeric record ids.
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
let idSeed = 0x2f6e2b1;
function nextId() {
  let out = '';
  for (let i = 0; i < 16; i++) {
    idSeed = (idSeed * 1103515245 + 12345) & 0x7fffffff;
    out += ID_ALPHABET[idSeed % ID_ALPHABET.length];
  }
  return out;
}

const sql = (v) => (v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

const table = csvParse(readFileSync(CSV_PATH, 'utf8'));
const header = table[0].map((h) => h.trim().toLowerCase());
const col = (name) => header.indexOf(name.toLowerCase());
const idx = {
  word: col('Word'), pronunciation: col('Pronunciation'), partOfSpeech: col('Part of Speech'),
  wordForms: col('Word Forms'), meaning: col('Meaning'), synonym1: col('Synonym 1'),
  synonym2: col('Synonym 2'), antonym1: col('Antonym 1'), antonym2: col('Antonym 2'),
  exampleSentence: col('Example Sentence'), wordOrigin: col('Word Origin'),
  laymanExplanation: col('Layman Explanation'), difficulty: col('Difficulty'),
  audioUrl: col('Audio URL'),
};
if (idx.word === -1 || idx.meaning === -1) {
  console.error('error: CSV is missing a required "Word" or "Meaning" column');
  process.exit(1);
}

// Spread over the last few seconds like a real import; seed-device.sh shifts
// the whole block forward to "now" at restore time anyway.
const baseTime = Date.UTC(2026, 0, 1, 0, 0, 0);
const statements = [];
const seen = new Set();
let n = 0;

for (let r = 1; r < table.length; r++) {
  const raw = table[r];
  const get = (i) => (i === -1 || i >= raw.length ? '' : raw[i].trim());
  const word = get(idx.word);
  const meaning = get(idx.meaning);
  if (!word || !meaning) continue;
  const key = word.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);

  const difficulty = (get(idx.difficulty).toLowerCase() || 'medium');
  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    console.error(`error: row ${r + 1} ("${word}") has invalid Difficulty "${difficulty}"`);
    process.exit(1);
  }
  // Column order and transforms follow createWord() in src/db/words.ts.
  const values = [
    nextId(), '', 'created',
    capitalizeFirst(word), get(idx.pronunciation), get(idx.audioUrl), capitalizeFirst(meaning),
    capitalizeFirst(get(idx.synonym1)), capitalizeFirst(get(idx.synonym2)),
    capitalizeFirst(get(idx.antonym1)), capitalizeFirst(get(idx.antonym2)),
    capitalizeFirst(get(idx.exampleSentence)),
    capitalizeFirst(get(idx.laymanExplanation)) || null,
    capitalizeFirst(get(idx.wordOrigin)) || null,
    get(idx.partOfSpeech), get(idx.wordForms), difficulty, 'new',
  ].map(sql);
  statements.push(`INSERT INTO "words" VALUES (${values.join(',')},${baseTime + n * 100}.0);`);
  n++;
}

// Both values are double-encoded on purpose: callers JSON.stringify, then
// WatermelonDB's LocalStorage.set stringifies again. See src/db/settings.ts.
const localStorage = [
  ['settings.onboardingComplete', JSON.stringify(true)],
  ['games.celebratedUnlocks', JSON.stringify(JSON.stringify(
    ['millionaire', 'memory', 'scrabble', 'crossword', 'bee']))],
];

const script = [
  'PRAGMA journal_mode=DELETE;',
  `PRAGMA user_version=${SCHEMA_VERSION};`,
  'create table if not exists "local_storage" ("key" varchar(16) primary key not null, "value" text not null);',
  'create index if not exists "local_storage_key_index" on "local_storage" ("key");',
  'create table if not exists "words" ("id" primary key, "_changed", "_status", "word", "pronunciation", "audio_url", "meaning", "synonym_1", "synonym_2", "antonym_1", "antonym_2", "example_sentence", "layman_explanation", "word_origin", "part_of_speech", "word_forms", "difficulty_level", "practice_status", "created_at");',
  'create index if not exists "words_difficulty_level" on "words" ("difficulty_level");',
  'create index if not exists "words_practice_status" on "words" ("practice_status");',
  'create index if not exists "words_created_at" on "words" ("created_at");',
  'create index if not exists "words__status" on "words" ("_status");',
  'BEGIN;',
  ...statements,
  ...localStorage.map(([k, v]) => `INSERT INTO "local_storage" VALUES (${sql(k)},${sql(v)});`),
  'COMMIT;',
  'VACUUM;',
].join('\n');

for (const suffix of ['', '-wal', '-shm']) {
  if (existsSync(DB_PATH + suffix)) rmSync(DB_PATH + suffix);
}
execFileSync('sqlite3', [DB_PATH], { input: script });

console.log(`Wrote ${DB_PATH} — ${n} words, schema v${SCHEMA_VERSION}.`);
