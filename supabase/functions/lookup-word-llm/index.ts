// ---------------------------------------------------------------------------
// lookup-word-llm — last-resort dictionary fallback via an LLM (OpenRouter).
// Runs server-side on Supabase's infrastructure (Deno), never inside the
// mobile app bundle — the OpenRouter key must never ship in a release APK.
//
// This is the THIRD tier of the lookup chain (see src/api/dictionary.ts):
//   1. Free Dictionary API (dictionaryapi.dev)
//   2. Wiktionary + Datamuse
//   3. This function — only called when BOTH of the above found nothing.
//
// Because it only runs for words the free sources couldn't find, the prompt
// is deliberately conservative: the model is told to decline (found: false)
// rather than guess, so an obscure or misspelled word gets an honest "not
// found" instead of confidently wrong content sitting in someone's vocab
// list. Every field is also re-validated here before it reaches the app —
// the app never trusts raw model output directly.
//
// Required secret (set via `supabase secrets set`, never committed):
//   OPENROUTER_API_KEY   from https://openrouter.ai/keys
// Optional secret:
//   OPENROUTER_MODEL     defaults to 'anthropic/claude-haiku-4.5'. This tier
//                         only runs when both free sources already failed, so
//                         call volume is tiny (a handful of lookups, not every
//                         one) — at that volume the cost difference between
//                         cheap models is a few paisa, not worth trading away
//                         accuracy for. Change via `supabase secrets set` if
//                         you want a different model; check current ids and
//                         prices at https://openrouter.ai/models first, since
//                         provider model names get renamed/retired over time.
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LookupRequest {
  word: string;
}

interface LlmResult {
  found: boolean;
  meaning?: string;
  partOfSpeech?: string;
  synonyms?: string[];
  antonyms?: string[];
  example?: string;
  wordOrigin?: string;
  laymanExplanation?: string;
}

const SYSTEM_PROMPT = `You are a strict, careful English dictionary — not a creative writer.
You will be asked to define a single English word. This word already failed to
be found in the Free Dictionary API, Wiktionary and Datamuse, so treat it as
likely obscure, archaic, a proper noun, a typo, or not a real English word.

Rules:
- If you are not confident this is a standard, real English word with a
  well-established meaning, respond with exactly {"found": false} and
  nothing else. Do NOT guess. A refusal is always better than a wrong or
  invented definition — this is going into a vocabulary-learning app where
  wrong information actively teaches someone something false.
- If you ARE confident, respond with ONLY a JSON object, no prose, no
  markdown fences, matching this exact shape:
  {
    "found": true,
    "meaning": "the primary dictionary definition, one sentence, plain register",
    "partOfSpeech": "noun" | "verb" | "adjective" | "adverb" | etc,
    "synonyms": ["up to 2 real single-word or short synonyms, or []"],
    "antonyms": ["up to 2 real single-word or short antonyms, or [] if none exist"],
    "example": "one natural example sentence using the word correctly",
    "wordOrigin": "one short sentence on etymology if well known, else empty string",
    "laymanExplanation": "the same meaning explained in the simplest possible everyday words"
  }
- Never invent a synonym/antonym that isn't a real, established one. An empty
  array is correct and expected for words with no common antonym.
- Do not include any field not listed above. Do not wrap the JSON in
  markdown code fences.`;

function sanitizeWord(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const w = raw.trim();
  // Real English headwords: letters, spaces, hyphens, apostrophes only.
  // Also caps length — this both blocks prompt-injection-by-length and
  // keeps cost per call predictable.
  if (!w || w.length > 40 || !/^[a-zA-Z][a-zA-Z' -]*$/.test(w)) return null;
  return w;
}

/** Up to `max` short (<=3 word) strings, deduplicated, excluding the headword itself. */
function cleanList(list: unknown, headword: string, max: number): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set([headword.toLowerCase()]);
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const v = item.trim();
    const k = v.toLowerCase();
    if (!v || v.length > 40 || seen.has(k)) continue;
    if (v.split(/\s+/).length > 3) continue; // reject whole phrases
    seen.add(k);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

function cleanSentence(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  const v = value.trim().replace(/\s+/g, ' ');
  return v.length > maxLen ? `${v.slice(0, maxLen - 1).trimEnd()}…` : v;
}

/** Re-validates the model's own JSON before it's ever trusted by the app. */
function validate(raw: unknown, headword: string): LlmResult {
  if (!raw || typeof raw !== 'object') return { found: false };
  const r = raw as Record<string, unknown>;
  if (r.found !== true) return { found: false };

  const meaning = cleanSentence(r.meaning, 300);
  // No meaning at all means there's nothing trustworthy to show — treat as
  // not found rather than surfacing an empty-but-"successful" result.
  if (!meaning) return { found: false };

  return {
    found: true,
    meaning,
    partOfSpeech: cleanSentence(r.partOfSpeech, 40),
    synonyms: cleanList(r.synonyms, headword, 2),
    antonyms: cleanList(r.antonyms, headword, 2),
    example: cleanSentence(r.example, 200),
    wordOrigin: cleanSentence(r.wordOrigin, 320),
    laymanExplanation: cleanSentence(r.laymanExplanation, 220),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    const model = Deno.env.get('OPENROUTER_MODEL') ?? 'anthropic/claude-haiku-4.5';

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENROUTER_API_KEY is not configured on this function.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = (await req.json()) as LookupRequest;
    const word = sanitizeWord(body?.word);
    if (!word) {
      return new Response(JSON.stringify({ error: 'Request must include a valid "word".' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // OpenRouter asks for these to attribute traffic; harmless if unused.
        'HTTP-Referer': 'https://vocabhub.app',
        'X-Title': 'Vocab Hub',
      },
      body: JSON.stringify({
        model,
        temperature: 0, // deterministic — this is a lookup, not creative writing
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Word: "${word}"` },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`OpenRouter request failed: ${res.status} ${text}`);
      return new Response(JSON.stringify({ found: false, error: 'upstream_error' }), {
        status: 200, // the app treats this the same as "not found", not a hard error
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    let parsed: unknown = null;
    try {
      parsed = content ? JSON.parse(content) : null;
    } catch {
      console.error('OpenRouter returned non-JSON content:', content);
    }

    const result = validate(parsed, word);
    console.log(`lookup-word-llm: word="${word}" found=${result.found} model=${model}`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('lookup-word-llm failed:', err);
    // Failure here should degrade to "not found", not break word-adding entirely.
    return new Response(JSON.stringify({ found: false, error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
