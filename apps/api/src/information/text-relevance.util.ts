/**
 * Deterministic, explainable lexical heuristics used by `verify` - never an
 * LLM, never semantic/entailment understanding. This measures term overlap
 * and simple negation-cue presence, which is a genuinely useful, honest
 * signal for "does this evidence discuss the claim, and does its wording
 * read as an affirmation or a denial" - it is NOT fact-checking in any deep
 * sense, and the capability's own description says so.
 */

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'is', 'are', 'was', 'were', 'be', 'been',
  'that', 'this', 'it', 'as', 'by', 'with', 'from', 'has', 'have', 'had', 'will', 'would', 'can', 'could', 'its',
  'their', 'than', 'into', 'over', 'about', 'which', 'who', 'what', 'when', 'where', 'how',
]);

const WORD_PATTERN = /[a-z0-9]+/g;
const MIN_TERM_LENGTH = 3;

/** Lowercased, stopword-filtered significant terms - the unit both relevance and overlap scoring operate on. */
export function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(WORD_PATTERN) ?? [];
  return matches.filter((term) => term.length >= MIN_TERM_LENGTH && !STOPWORDS.has(term));
}

/** Fraction (0..1) of `claimTerms` that also appear in `text` - 0 when `claimTerms` is empty (nothing to compare against). */
export function termOverlap(claimTerms: readonly string[], text: string): number {
  if (claimTerms.length === 0) return 0;
  const textTerms = new Set(tokenize(text));
  const matches = claimTerms.filter((term) => textTerms.has(term)).length;
  return matches / claimTerms.length;
}

const NEGATION_CUES = [
  'not', 'false', 'falsely', 'denies', 'denied', 'disputes', 'disputed', 'debunked', 'debunks', 'refute', 'refutes',
  'refuted', 'contradicts', 'contradicted', 'disproven', 'disproved', 'myth', 'incorrect', 'untrue', 'fake',
  'no evidence', 'never happened',
];

/** Simple substring cue-matching - a lexical proxy for "this text reads as a denial", not semantic negation detection. */
export function hasNegationCue(text: string): boolean {
  const lower = text.toLowerCase();
  return NEGATION_CUES.some((cue) => lower.includes(cue));
}
