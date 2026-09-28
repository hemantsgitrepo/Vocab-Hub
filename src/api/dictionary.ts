// ---------------------------------------------------------------------------
// Multi-source word lookup, three free tiers plus one paid last resort:
//
//   1. Free Dictionary API  — definitions, phonetics, audio, examples
//   2. Wiktionary (MediaWiki) — etymology, plus curated {{syn}}/{{ant}} lists
//   3. Datamuse             — synonym/antonym backfill
//   4. lookup-word-llm (Supabase Edge Function -> OpenRouter) — ONLY when
//      tiers 1-2 together found nothing. Paid, so it's the last thing tried,
//      not a parallel source; see supabase/functions/lookup-word-llm for why
//      it's built to decline rather than guess.
//
// Tiers 1-3 are queried in parallel and merged by priority, so one slow or
// dead service degrades the result instead of failing the lookup. Anything
// still missing is derived locally (layman explanation, example sentence).
// ---------------------------------------------------------------------------
import { supabase } from '../lib/supabaseClient';

const BASE_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const WIKTIONARY_URL = 'https://en.wiktionary.org/w/api.php';
const DATAMUSE_URL = 'https://api.datamuse.com/words';

/** Wikimedia asks API clients to identify themselves. */
const UA = 'VocabHub/1.0 (offline vocabulary trainer; educational use)';

/** Datamuse scores below this are near-noise (e.g. "unfastidious", score 12). */
const MIN_DATAMUSE_SCORE = 500;

// Lowered from 8s: a source that's actually dead was making every lookup
// wait the full 8 seconds before falling back. 5s still gives a slow mobile
// connection room, without stalling the UI as long on a hung request.
const TIMEOUT_MS = 5000;

// Per-word results cache (session-lifetime, in memory). Re-adding a word you
// just looked up -- or re-opening the Add Word screen on the same word after
// backing out -- was re-querying all three APIs from scratch every time.
const cache = new Map<string, DictionaryResult>();

/** Where a field's value came from — drives the "auto-filled" badges in the UI.
 *  'llm' is flagged distinctly in the UI (see AddWordScreen's SOURCE_LABEL) —
 *  it's a paid, model-generated fallback and worth a second look, unlike the
 *  other three which are real reference sources. */
export type FieldSource = 'dictionary' | 'wiktionary' | 'datamuse' | 'generated' | 'llm';

export interface DictionaryResult {
  pronunciation: string;
  audioUrl: string;
  meaning: string;
  example: string;
  synonyms: string[];
  antonyms: string[];
  partOfSpeech: string;
  wordForms: string;
  wordOrigin: string;
  laymanExplanation: string;
  /** Populated fields mapped to the source that supplied them. */
  sources: Partial<Record<keyof Omit<DictionaryResult, 'sources'>, FieldSource>>;
}

/** fetch with a timeout, so one hanging source can't stall the whole lookup. */
async function getJson(url: string, headers?: Record<string, string>): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // offline, timeout, 404, malformed JSON — all non-fatal
  } finally {
    clearTimeout(timer);
  }
}

// ----- 1. Free Dictionary API ----------------------------------------------

async function fetchEntry(word: string): Promise<any | null> {
  const data = await getJson(`${BASE_URL}/${encodeURIComponent(word.trim().toLowerCase())}`);
  return Array.isArray(data) ? (data[0] ?? null) : null;
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

  // Capped at 5 (was 8): each candidate is a full network round-trip, and
  // this list was the single biggest contributor to a slow lookup.
  return [...out].slice(0, 5);
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

// ----- 2. Wiktionary --------------------------------------------------------

const LANGUAGES: Record<string, string> = {
  'la-med': 'Medieval Latin', 'la-lat': 'Late Latin', 'la-new': 'New Latin',
  'la-vul': 'Vulgar Latin', 'la-ecc': 'Ecclesiastical Latin',
  la: 'Latin', grc: 'Ancient Greek', el: 'Greek', fr: 'French', enm: 'Middle English',
  ang: 'Old English', ofs: 'Old Frisian', gem: 'Proto-Germanic', 'gem-pro': 'Proto-Germanic',
  ine: 'Proto-Indo-European', 'ine-pro': 'Proto-Indo-European', de: 'German', nl: 'Dutch',
  it: 'Italian', es: 'Spanish', pt: 'Portuguese', ar: 'Arabic', he: 'Hebrew', sa: 'Sanskrit',
  fro: 'Old French', frm: 'Middle French', non: 'Old Norse', gd: 'Scottish Gaelic',
  ga: 'Irish', cy: 'Welsh', ru: 'Russian', ja: 'Japanese', zh: 'Chinese', hi: 'Hindi',
  fa: 'Persian', tr: 'Turkish', en: 'English',
};

const langName = (code: string) => LANGUAGES[code] ?? '';

/** Splits `{{a|b|c}}` inner text into its pipe-separated parts. */
function templateParts(inner: string): string[] {
  return inner.split('|').map((s) => s.trim());
}

/**
 * Turns Wiktionary markup into readable prose. Handles the borrowing/mention
 * templates that carry the actual etymological content and strips the rest.
 */
function cleanWikitext(raw: string): string {
  let s = raw;

  // Structured etymology trees, e.g. {{ety|en|:bor|la:candidus<t:white>|tree=1}}.
  // Some entries carry ONLY this template and no prose, so it has to be read
  // rather than stripped. Params look like `lang:term<t:gloss>`.
  s = s.replace(/\{\{ety\|([^{}]*(?:<[^{}]*>)?[^{}]*)\}\}/gi, (_m, inner) => {
    const steps: string[] = [];
    for (const part of templateParts(String(inner)).slice(1)) {
      if (!part || part.includes('=') || part.startsWith(':')) continue;
      const m = /^([a-z][a-z-]*):([^<|]+)(?:<t:([^>]*)>)?/i.exec(part);
      if (!m) continue;
      const lang = langName(m[1]);
      const gloss = (m[3] ?? '').trim();
      steps.push(`${lang ? `${lang} ` : ''}${m[2].trim()}${gloss ? ` (${gloss})` : ''}`.trim());
    }
    return steps.length ? `From ${steps.join(', from ')}.` : '';
  });

  // Derivation/borrowing templates: {{bor|en|la|term|alt|gloss}} and friends.
  s = s.replace(/\{\{(bor\+?|lbor|der|inh|uder|bor|slbor)\|([^{}]*)\}\}/gi, (_m, _t, inner) => {
    const p = templateParts(inner);
    const lang = langName(p[1] ?? '');
    const term = p[2] ?? '';
    const gloss = (p.find((x) => x.startsWith('t=')) ?? '').replace(/^t=/, '') || p[4] || '';
    if (!term) return lang;
    return `${lang} ${term}${gloss ? ` (${gloss})` : ''}`.trim();
  });

  // Mention/link templates: {{m|la|metus||fear}}, {{l|en|word}}, {{cog|de|Wort}}
  s = s.replace(/\{\{(m|l|cog|ncog|noncog)\|([^{}]*)\}\}/gi, (_m, _t, inner) => {
    const p = templateParts(inner);
    const term = p[1] ?? '';
    const gloss = p[3] || (p.find((x) => x.startsWith('t=')) ?? '').replace(/^t=/, '') || '';
    return `${term}${gloss ? ` (${gloss})` : ''}`.trim();
  });

  // Semantic-loan / calque style templates: keep the language + term.
  s = s.replace(/\{\{(sl|calque|cal|clq)\|([^{}]*)\}\}/gi, (_m, _t, inner) => {
    const p = templateParts(inner);
    return `${langName(p[1] ?? '')} ${p[2] ?? ''}`.trim();
  });

  // Word-formation: {{suffix|en|ubiquity|ous}} -> "ubiquity + -ous"
  s = s.replace(/\{\{(suffix|prefix|affix|compound|con)\|([^{}]*)\}\}/gi, (_m, kind, inner) => {
    const p = templateParts(inner)
      .slice(1)
      .filter((x) => x && !x.includes('='));
    if (!p.length) return '';
    const k = String(kind).toLowerCase();
    const parts = p.map((part, i) => {
      if (k === 'suffix' && i === p.length - 1 && !part.startsWith('-')) return `-${part}`;
      if (k === 'prefix' && i === 0 && !part.endsWith('-')) return `${part}-`;
      return part;
    });
    return parts.join(' + ');
  });

  // Wikipedia links: {{w|Target|Label}} -> Label (falls back to Target)
  s = s.replace(/\{\{w\|([^{}]*)\}\}/gi, (_m, inner) => {
    const p = templateParts(inner).filter((x) => x && !x.includes('='));
    return p[1] || p[0] || '';
  });

  // Coinage: {{coin|en|Horace Walpole|...}} -> "coined by Horace Walpole"
  s = s.replace(/\{\{(coin|coinage)\|([^{}]*)\}\}/gi, (_m, _t, inner) => {
    const p = templateParts(inner).filter((x) => x && !x.includes('='));
    return p[1] ? `coined by ${p[1]}` : '';
  });

  s = s.replace(/\{\{[^{}]*\}\}/g, ''); // drop any remaining templates
  s = s.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2'); // [[target|label]] -> label
  s = s.replace(/\[\[([^\]]*)\]\]/g, '$1'); // [[link]] -> link
  s = s.replace(/'''?/g, ''); // bold/italic markup
  s = s.replace(/<ref[^>]*>.*?<\/ref>/gis, '').replace(/<[^>]+>/g, '');

  // Repair the connective prose left behind by stripped templates, e.g. an
  // unknown language code turning "from {{der|…}}" into "from , from".
  s = s.replace(/\(\s*\)/g, '');
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/\s+([,.;:)])/g, '$1');
  s = s.replace(/([(])\s+/g, '$1');
  // Only "from"/"via" are stripped when orphaned — "of," legitimately appears
  // inside glosses such as "(of, for, or during the day)".
  s = s.replace(/\b(from|via)\s*([,.;])/gi, '');
  s = s.replace(/,\s*(?=[,.;])/g, '');
  s = s.replace(/\b(from)\s+\1\b/gi, '$1');
  s = s.replace(/^[\s,.;:+]+/, '');
  // A stripped cross-reference can leave a dangling "…, see." / "Compare."
  s = s.replace(/[,;]?\s*\b(see|compare|cf)\b\s*\.?\s*$/i, '');
  s = s.replace(/[ \t]{2,}/g, ' ');
  s = s.replace(/\.{2,}/g, '.'); // stripped templates can double up the full stop
  s = s.replace(/\s*([.,])\s*$/, '$1');
  s = s.trim();
  // Sentence-case the start and anything following a full stop.
  s = s.replace(/(^|[.!?]\s+)([a-z])/g, (_m, pre, ch) => pre + ch.toUpperCase());
  return s;
}

/** Narrows wikitext to the ==English== section; other languages are irrelevant. */
function englishSection(wikitext: string): string {
  const start = wikitext.search(/^==\s*English\s*==\s*$/m);
  if (start < 0) return wikitext;
  const rest = wikitext.slice(start + 1);
  const next = rest.search(/^==\s*[^=].*==\s*$/m);
  return next < 0 ? rest : rest.slice(0, next);
}

const POS_HEADING_RE =
  /^=+\s*(Noun|Verb|Adjective|Adverb|Pronoun|Preposition|Conjunction|Interjection|Determiner|Numeral)\s*(?:\s*\d+)?\s*=+\s*$/m;

export interface WiktionaryResult {
  origin: string;
  synonyms: string[];
  antonyms: string[];
  /** Populated only so lookupWord() can fall back entirely to Wiktionary
   *  when the primary Dictionary API is unreachable (it does happen — see
   *  the 522 outage this was added for). */
  meaning: string;
  partOfSpeech: string;
  pronunciation: string;
}

/** First definition line ("# ...", not "#:" / "#*") under a part-of-speech heading. */
function firstDefinition(section: string): { meaning: string; partOfSpeech: string } {
  const at = section.search(POS_HEADING_RE);
  if (at < 0) return { meaning: '', partOfSpeech: '' };
  const headingMatch = POS_HEADING_RE.exec(section.slice(at));
  const partOfSpeech = (headingMatch?.[1] ?? '').toLowerCase();

  const after = section.slice(at).replace(POS_HEADING_RE, '');
  const end = after.search(/^=+[^=]+=+\s*$/m);
  const body = end < 0 ? after : after.slice(0, end);

  const defLine = body
    .split('\n')
    .find((line) => /^#(?![:*#])\s*/.test(line.trim()));
  if (!defLine) return { meaning: '', partOfSpeech };

  const meaning = cleanWikitext(defLine.replace(/^#\s*/, ''));
  return { meaning, partOfSpeech };
}

/** First IPA pronunciation, e.g. {{IPA|en|/mɪˈtɪkjɪlɪs/|...}} -> /mɪˈtɪkjɪlɪs/. */
function firstIpa(section: string): string {
  const m = /\{\{IPA\|en\|([^}]*)\}\}/i.exec(section);
  if (!m) return '';
  const slashForm = templateParts(m[1]).find((p) => /^\/.*\/$/.test(p));
  return slashForm ?? '';
}

/**
 * Pulls the etymology paragraph plus any curated {{syn}}/{{ant}} lists.
 * Wiktionary's antonyms are noticeably better than Datamuse's — for
 * "meticulous", Datamuse has none and Wiktionary has three.
 */
export async function fetchWiktionary(word: string): Promise<WiktionaryResult | null> {
  const url =
    `${WIKTIONARY_URL}?action=parse&page=${encodeURIComponent(word.trim().toLowerCase())}` +
    `&prop=wikitext&format=json&formatversion=2&redirects=1&origin=*`;
  const data = await getJson(url, { 'Api-User-Agent': UA, 'User-Agent': UA });
  const wikitext: string | undefined =
    typeof data?.parse?.wikitext === 'string' ? data.parse.wikitext : data?.parse?.wikitext?.['*'];
  if (!wikitext) return null;

  const section = englishSection(wikitext);

  // Heading is usually ===Etymology===, sometimes ===Etymology 1===.
  const headingRe = /^=+\s*Etymology(?:\s*\d+)?\s*=+\s*$/m;
  let origin = '';
  const at = section.search(headingRe);
  if (at >= 0) {
    const after = section.slice(at).replace(headingRe, '');
    const end = after.search(/^=+[^=]+=+\s*$/m); // next heading of any level
    const body = (end < 0 ? after : after.slice(0, end)).trim();
    // First non-empty paragraph is the etymology proper.
    const para = body.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p.length > 0) ?? '';
    origin = cleanWikitext(para).replace(/\s*\n\s*/g, ' ').trim();
    if (origin.length > 320) origin = `${origin.slice(0, 317).trimEnd()}…`;
  }

  const listFrom = (tag: 'syn' | 'ant'): string[] => {
    const out: string[] = [];
    const re = new RegExp(`\\{\\{${tag}\\|en\\|([^{}]*)\\}\\}`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(section)) !== null) {
      for (const part of templateParts(m[1])) {
        // Skip Thesaurus: pointers and named params like q1=, alt=.
        if (!part || part.includes('=') || /^Thesaurus:/i.test(part)) continue;
        out.push(part);
      }
    }
    return out;
  };

  const { meaning, partOfSpeech } = firstDefinition(section);
  const pronunciation = firstIpa(section);

  return {
    origin,
    synonyms: listFrom('syn'),
    antonyms: listFrom('ant'),
    meaning,
    partOfSpeech,
    pronunciation,
  };
}

// ----- 3. Datamuse ----------------------------------------------------------

async function fetchDatamuse(rel: 'rel_syn' | 'rel_ant', word: string): Promise<string[]> {
  const data = await getJson(
    `${DATAMUSE_URL}?${rel}=${encodeURIComponent(word.trim().toLowerCase())}&max=10`
  );
  if (!Array.isArray(data)) return [];
  return data
    .filter((d: any) => typeof d?.word === 'string' && (d.score ?? 0) >= MIN_DATAMUSE_SCORE)
    .map((d: any) => d.word as string);
}

// ----- Local derivation -----------------------------------------------------

/** Dictionary phrasing → everyday phrasing. Order matters; longest first. */
const PLAIN_PHRASES: [RegExp, string][] = [
  [/^of or relating to\s+/i, 'about '],
  [/^of or pertaining to\s+/i, 'about '],
  [/^relating to\s+/i, 'about '],
  [/^pertaining to\s+/i, 'about '],
  [/^characterized by\s+/i, 'having '],
  [/^having the quality of\s+/i, 'being '],
  [/^tending to\s+/i, 'likely to '],
  [/^the act of\s+/i, 'when someone is '],
  [/^the state of being\s+/i, 'being '],
  [/^the quality of being\s+/i, 'being '],
  [/^a person who\s+/i, 'someone who '],
  [/^one who\s+/i, 'someone who '],
  [/^denoting\s+/i, 'meaning '],
  [/^designating\s+/i, 'meaning '],
  [/\bin a\s+(\w+)\s+manner\b/i, 'in a $1 way'],
  [/\butilize[sd]?\b/gi, 'use'],
  [/\bnumerous\b/gi, 'many'],
  [/\bendeavou?r\b/gi, 'effort'],
];

/**
 * A plain-language paraphrase of the definition. This is a text heuristic, not
 * comprehension — it trims the formal dictionary scaffolding and keeps the
 * first clause, which is where the plain meaning usually lives.
 */
export function simplifyDefinition(definition: string, word: string): string {
  let s = (definition ?? '').trim();
  if (!s) return '';

  s = s.replace(/\([^)]*\)/g, ' '); // drop parentheticals — usually usage notes
  s = s.split(/(?<=[.!?])\s+/)[0]; // first sentence only
  s = s.replace(/[;:]\s.*$/, ''); // drop trailing qualifier clauses
  s = s.replace(/\s+/g, ' ').trim().replace(/[.,;:]+$/, '');
  if (!s) return '';

  for (const [re, to] of PLAIN_PHRASES) s = s.replace(re, to);

  s = s.charAt(0).toLowerCase() + s.slice(1);
  if (s.length > 180) s = `${s.slice(0, 177).trimEnd()}…`;
  const subject = word.trim().toLowerCase();
  return `In simple terms: ${subject} means ${s}.`.replace(/\s+/g, ' ');
}

/** Article that reads correctly before `word`. */
const article = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a');

/**
 * A usable example when the dictionary supplies none. Shaped by part of speech
 * so the sentence stays grammatical.
 */
export function buildExample(word: string, partOfSpeech: string): string {
  const w = word.trim().toLowerCase();
  const pos = (partOfSpeech || '').split(',')[0].trim().toLowerCase();
  switch (pos) {
    case 'adjective':
      return `Her ${w} approach to the work impressed everyone on the team.`;
    case 'adverb':
      return `She reviewed the report ${w} before sending it out.`;
    case 'verb':
      return `They decided to ${w} the plan before the deadline.`;
    case 'noun':
      return `The ${w} in her work was impossible to miss.`;
    default:
      return `It was ${article(w)} ${w} moment worth remembering.`;
  }
}

// ----- 4. LLM fallback (paid, last resort) ----------------------------------

interface LlmLookupResponse {
  found: boolean;
  meaning?: string;
  partOfSpeech?: string;
  synonyms?: string[];
  antonyms?: string[];
  example?: string;
  wordOrigin?: string;
  laymanExplanation?: string;
}

/**
 * Calls the lookup-word-llm Edge Function — never OpenRouter directly, so the
 * API key never has to exist in this app bundle. Only worth trying once the
 * three free sources have already come up empty; see that function's own
 * comment for why it's built to say "not found" rather than invent an entry.
 */
async function fetchLlmFallback(word: string): Promise<LlmLookupResponse | null> {
  try {
    const { data, error } = await supabase.functions.invoke('lookup-word-llm', {
      body: { word },
    });
    if (error) return null;
    return (data as LlmLookupResponse) ?? null;
  } catch {
    return null; // offline, function down, whatever — degrade to "not found"
  }
}

function llmOnlyResult(term: string, llm: LlmLookupResponse): DictionaryResult {
  const synonyms = dedupe(llm.synonyms ?? [], term).slice(0, 2);
  const antonyms = dedupe(llm.antonyms ?? [], term).slice(0, 2);
  const meaning = llm.meaning ?? '';
  const partOfSpeech = llm.partOfSpeech ?? '';
  const example = llm.example || (meaning ? buildExample(term, partOfSpeech) : '');
  const laymanExplanation = llm.laymanExplanation || simplifyDefinition(meaning, term);

  const sources: DictionaryResult['sources'] = {};
  if (meaning) sources.meaning = 'llm';
  if (partOfSpeech) sources.partOfSpeech = 'llm';
  if (synonyms.length) sources.synonyms = 'llm';
  if (antonyms.length) sources.antonyms = 'llm';
  if (example) sources.example = llm.example ? 'llm' : 'generated';
  if (llm.wordOrigin) sources.wordOrigin = 'llm';
  if (laymanExplanation) sources.laymanExplanation = llm.laymanExplanation ? 'llm' : 'generated';

  return {
    // No pronunciation/audio at this tier — an LLM-guessed IPA transcription
    // is a real risk of teaching a wrong pronunciation, worse than showing none.
    pronunciation: '',
    audioUrl: '',
    meaning,
    example,
    synonyms,
    antonyms,
    partOfSpeech,
    wordForms: '',
    wordOrigin: llm.wordOrigin ?? '',
    laymanExplanation,
    sources,
  };
}

// ----- Orchestration --------------------------------------------------------

/** Trims, de-duplicates, drops the headword itself and rejects long phrases. */
const dedupe = (list: string[], exclude: string) => {
  const seen = new Set<string>([exclude.trim().toLowerCase()]);
  const out: string[] = [];
  for (const raw of list) {
    const v = (raw ?? '').trim();
    const k = v.toLowerCase();
    if (!v || seen.has(k)) continue;
    if (v.split(/\s+/).length > 3) continue; // whole phrases don't fit the field
    seen.add(k);
    out.push(v);
  }
  return out;
};

/** Builds a full result from Wiktionary + Datamuse alone, for when the
 *  primary Dictionary API is unreachable. */
function wiktionaryOnlyResult(
  term: string,
  wikt: WiktionaryResult,
  dmSyn: string[],
  dmAnt: string[],
  wordForms: string
): DictionaryResult {
  const synonyms = dedupe([...wikt.synonyms, ...dmSyn], term).slice(0, 2);
  const antonyms = dedupe([...wikt.antonyms, ...dmAnt], term).slice(0, 2);
  const partOfSpeech = wikt.partOfSpeech;
  const example = buildExample(term, partOfSpeech);
  const laymanExplanation = simplifyDefinition(wikt.meaning, term);

  const sources: DictionaryResult['sources'] = {
    meaning: 'wiktionary',
    example: 'generated',
    laymanExplanation: 'generated',
  };
  if (synonyms.length) sources.synonyms = wikt.synonyms.length ? 'wiktionary' : 'datamuse';
  if (antonyms.length) sources.antonyms = wikt.antonyms.length ? 'wiktionary' : 'datamuse';
  if (wikt.origin) sources.wordOrigin = 'wiktionary';
  if (wikt.pronunciation) sources.pronunciation = 'wiktionary';
  if (partOfSpeech) sources.partOfSpeech = 'wiktionary';
  if (wordForms) sources.wordForms = 'dictionary';

  const result: DictionaryResult = {
    pronunciation: wikt.pronunciation,
    audioUrl: '', // Wiktionary's audio files need Commons URL resolution -- not worth it as a fallback
    meaning: wikt.meaning,
    example,
    synonyms,
    antonyms,
    partOfSpeech,
    wordForms,
    wordOrigin: wikt.origin,
    laymanExplanation,
    sources,
  };
  cache.set(term.toLowerCase(), result);
  return result;
}

/**
 * Looks a word up across every source and fills what it can. Returns null only
 * when neither the primary dictionary nor Wiktionary has an entry.
 */
export async function lookupWord(word: string): Promise<DictionaryResult | null> {
  const term = word.trim();
  const cached = cache.get(term.toLowerCase());
  if (cached) return cached;

  // All sources in flight together — including word-forms, which used to run
  // as a separate step *after* this batch and roughly doubled the total wait.
  // It only needs `term`, not the dictionary entry, so it doesn't have to wait.
  const [entry, wikt, dmSyn, dmAnt, wordForms] = await Promise.all([
    fetchEntry(term),
    fetchWiktionary(term),
    fetchDatamuse('rel_syn', term),
    fetchDatamuse('rel_ant', term),
    fetchWordForms(term),
  ]);

  // The primary Dictionary API is a free, unguaranteed service and does have
  // outages (a full Cloudflare 522 was observed against it). Rather than
  // fail the whole lookup, fall back to Wiktionary's own definition when it
  // has one — a real word looked up during an outage would otherwise show
  // "not found", which reads as "this word doesn't exist" rather than "one
  // upstream source is down".
  if (!entry) {
    if (wikt?.meaning) return wiktionaryOnlyResult(term, wikt, dmSyn, dmAnt, wordForms);
    // Both free sources came up empty — last resort before "not found" is the
    // paid LLM fallback. It's built to decline rather than guess (see
    // fetchLlmFallback's target function), so this still returns null for a
    // genuinely made-up word instead of fabricating an entry for it.
    const llm = await fetchLlmFallback(term);
    if (llm?.found) {
      const result = llmOnlyResult(term, llm);
      cache.set(term.toLowerCase(), result); // avoid re-billing a repeat lookup
      return result;
    }
    return null;
  }

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
  const partOfSpeech = parts.join(', ');

  const sources: DictionaryResult['sources'] = {};

  // --- synonyms / antonyms: dictionary → Wiktionary → Datamuse
  const buildPair = (
    primary: string[],
    wiktList: string[],
    datamuse: string[],
    field: 'synonyms' | 'antonyms'
  ) => {
    const merged = dedupe([...primary, ...wiktList, ...datamuse], term).slice(0, 2);
    if (merged.length) {
      const fromPrimary = dedupe(primary, term).length;
      sources[field] =
        fromPrimary >= merged.length
          ? 'dictionary'
          : dedupe([...primary, ...wiktList], term).length >= merged.length
            ? 'wiktionary'
            : 'datamuse';
    }
    return merged;
  };

  const synonyms = buildPair(collect('synonyms'), wikt?.synonyms ?? [], dmSyn, 'synonyms');
  const antonyms = buildPair(collect('antonyms'), wikt?.antonyms ?? [], dmAnt, 'antonyms');

  // --- meaning / example
  const meaning = definitions[0]?.definition ?? '';
  if (meaning) sources.meaning = 'dictionary';

  let example = definitions.find((d) => d.example)?.example ?? '';
  if (example) sources.example = 'dictionary';
  else if (term && meaning) {
    example = buildExample(term, partOfSpeech);
    sources.example = 'generated';
  }

  // --- origin
  const wordOrigin = wikt?.origin ?? '';
  if (wordOrigin) sources.wordOrigin = 'wiktionary';

  // --- layman explanation (always derived; no free source supplies one)
  const laymanExplanation = simplifyDefinition(meaning, term);
  if (laymanExplanation) sources.laymanExplanation = 'generated';

  const pronunciation = entry.phonetic ?? phonetics.find((p: any) => p.text)?.text ?? '';
  if (pronunciation) sources.pronunciation = 'dictionary';
  const audioUrl = phonetics.find((p: any) => p.audio)?.audio ?? '';
  if (audioUrl) sources.audioUrl = 'dictionary';
  if (partOfSpeech) sources.partOfSpeech = 'dictionary';

  if (wordForms) sources.wordForms = 'dictionary';

  const result: DictionaryResult = {
    pronunciation,
    audioUrl,
    meaning,
    example,
    synonyms,
    antonyms,
    partOfSpeech,
    wordForms,
    wordOrigin,
    laymanExplanation,
    sources,
  };
  cache.set(term.toLowerCase(), result);
  return result;
}
