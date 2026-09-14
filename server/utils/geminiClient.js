/**
 * Thin wrapper around Google's free Gemini API (https://aistudio.google.com/apikey).
 * Used only as a fallback for the AI Assistant when a question doesn't match
 * any of the app's own data-backed intents - the assistant's normal answers
 * never touch this (or the network), so nothing about the core app depends
 * on this call succeeding.
 *
 * Uses the newer "Interactions API" (Google retired the older
 * generateContent endpoint's free-tier models in 2026) - a flat
 * { model, input } request instead of the old { contents: [...] } shape,
 * with the reply nested inside a `steps` timeline instead of `candidates`.
 */

const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
// Gemini's newer models "think" before answering by default, which can push
// a simple text reply well past 10 seconds. thinking_level: 'minimal' below
// skips most of that, and this timeout gives it generous room regardless.
const TIMEOUT_MS = 20000;

/**
 * Sends a single prompt to Gemini and returns its reply text.
 * Throws on any failure (missing key, network error, non-OK response, an
 * empty/blocked reply) - callers are expected to catch and fall back to a
 * canned response rather than let a flaky free API break the assistant.
 */
const askGemini = async (prompt) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        input: prompt,
        generation_config: {
          // 'minimal' skips most of the model's internal "thinking" pass -
          // this is a short factual reply, not a task that benefits from it,
          // and thinking mode is the main source of slow/timed-out replies.
          thinking_level: 'minimal',
          temperature: 0.4,
          max_output_tokens: 250,
        },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini API responded ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();

  // The reply lives in the last "model_output" step's text content - find
  // it rather than assuming a fixed step count, in case Google adds
  // intermediate steps (e.g. tool calls) later.
  const outputStep = [...(data.steps || [])].reverse().find((s) => s.type === 'model_output');
  const text = outputStep?.content?.find((c) => c.type === 'text')?.text;

  if (!text) {
    throw new Error('Gemini API returned no answer (possibly blocked by safety filters).');
  }
  return text.trim();
};

module.exports = { askGemini };