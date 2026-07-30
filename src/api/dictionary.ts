const BASE_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en';

export interface DictionaryResult {
  pronunciation: string;
  audioUrl: string;
  meaning: string;
  example: string;
  synonyms: string[];
  antonyms: string[];
  partOfSpeech: string;
  wordForms: string;
}

async function fetchEntry(word: string): Promise<any | null> {
  try {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(word.trim().toLowerCase())}`);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? (data[0] ?? null) : null;
  } catch {
    return null;
  }
}

function partsOfSpeech(entry: any): string[] {
  return [
    ...new Set<string>(
      (entry.meanings ?? [])
        .map((m: any) => m.partOfSpeech)
        .filter((p: unknown): p is string => typeof p === 'string' && p.length > 0)
    ),
  ];
}

/**
 * Candidate derived spellings using common English suffix rules. The dictionary
 * API has no "related forms" endpoint, so each candidate is looked up and only
 * the ones that turn out to be real words are kept.
 */
function derivedCandidates(word: string): string[] {
  const w = word.trim().toLowerCase();
  const out = new Set<string>();
  const add = (s: string) => {
    if (s.length > 3 && s !== w) out.add(s);
  };
  const stem = w.replace(/e$/, '');

  if (w.endsWith('ic')) add(`${w}ally`);
  else if (w.endsWith('y')) add(`${w.slice(0, -1)}ily`);
  else if (w.endsWith('le')) add(`${w.slice(0, -1)}y`);
  else add(`${w}ly`);

  add(`${w}ness`);
  add(`${stem}ion`);
  add(`${w}ment`);
  add(`${stem}ity`);
  add(`${stem}ance`);
  add(`${stem}er`);

  return [...out].slice(0, 8);
}

/** Looks up derived forms in parallel, returning e.g. "adverb: meticulously". */
async function fetchWordForms(word: string): Promise<string> {
  const found = await Promise.all(
    derivedCandidates(word).map(async (candidate) => {
      const entry = await fetchEntry(candidate);
      if (!entry) return null;
      const parts = partsOfSpeech(entry);
      return parts.length ? `${parts[0]}: ${candidate}` : null;
    })
  );
  return found.filter((f): f is string => f !== null).join(' · ');
}

/** Looks a word up on the Free Dictionary API. Returns null when not found. */
export async function lookupWord(word: string): Promise<DictionaryResult | null> {
  const entry = await fetchEntry(word);
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

  // Every part of speech, not just the first — the API's ordering is unreliable
  // (it lists "beautiful" as noun before adjective).
  const parts = partsOfSpeech(entry);

  return {
    pronunciation: entry.phonetic ?? phonetics.find((p) => p.text)?.text ?? '',
    audioUrl: phonetics.find((p) => p.audio)?.audio ?? '',
    meaning: definitions[0]?.definition ?? '',
    example: definitions.find((d) => d.example)?.example ?? '',
    synonyms: collect('synonyms'),
    antonyms: collect('antonyms'),
    partOfSpeech: parts.join(', '),
    wordForms: await fetchWordForms(word),
  };
}
