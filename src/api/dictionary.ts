const BASE_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en';

export interface DictionaryResult {
  pronunciation: string;
  audioUrl: string;
  meaning: string;
  example: string;
  synonyms: string[];
  antonyms: string[];
}

/** Looks a word up on the Free Dictionary API. Returns null when not found. */
export async function lookupWord(word: string): Promise<DictionaryResult | null> {
  const res = await fetch(`${BASE_URL}/${encodeURIComponent(word.trim().toLowerCase())}`);
  if (!res.ok) return null;

  const data = await res.json();
  const entry = Array.isArray(data) ? data[0] : null;
  if (!entry) return null;

  const phonetics: any[] = entry.phonetics ?? [];
  const meanings: any[] = entry.meanings ?? [];
  const definitions: any[] = meanings.flatMap((m) => m.definitions ?? []);

  const collect = (key: 'synonyms' | 'antonyms') => [
    ...new Set<string>([
      ...meanings.flatMap((m) => m[key] ?? []),
      ...definitions.flatMap((d) => d[key] ?? []),
    ]),
  ];

  return {
    pronunciation: entry.phonetic ?? phonetics.find((p) => p.text)?.text ?? '',
    audioUrl: phonetics.find((p) => p.audio)?.audio ?? '',
    meaning: definitions[0]?.definition ?? '',
    example: definitions.find((d) => d.example)?.example ?? '',
    synonyms: collect('synonyms'),
    antonyms: collect('antonyms'),
  };
}
