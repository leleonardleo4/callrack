import type { AcademicSearchResponseData } from '../academic/academic-response.types.js';
import type { NewsSearchResponseData } from '../news/news-response.types.js';
import type { KnowledgeSearchResponseData } from '../knowledge/knowledge-response.types.js';
import type { EvidenceDisagreement, EvidenceDisagreementValue, EvidenceItem, EvidenceSourceRef } from './information.types.js';

function omitNullish(data: Record<string, unknown>): Record<string, unknown> | undefined {
  const entries = Object.entries(data).filter(([, value]) => value !== null && value !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/** `AcademicWorkResponse` has no abstract/excerpt field — `excerpt` is genuinely omitted, never synthesized. */
export function academicToEvidence(data: AcademicSearchResponseData, retrievedAt: string): EvidenceItem[] {
  return data.results.map((work) => ({
    source: { title: work.title, url: work.url ?? undefined, provider: 'academic.search' },
    retrievedAt,
    data: omitNullish({
      authors: work.authors,
      publicationYear: work.publicationYear,
      journal: work.journal,
      citations: work.citations,
      openAccess: work.openAccess,
      doi: work.doi,
    }),
  }));
}

/** `NewsArticleResponse` has no excerpt/body field — `excerpt` is genuinely omitted, never synthesized. */
export function newsToEvidence(data: NewsSearchResponseData, retrievedAt: string): EvidenceItem[] {
  return data.results.map((article) => ({
    source: { title: article.title, url: article.url, provider: 'news.search' },
    retrievedAt,
    data: omitNullish({
      publishedAt: article.publishedAt,
      language: article.language,
      country: article.country,
      sourceDomain: article.source,
    }),
  }));
}

/** The only one of the three with a real descriptive field — `description` becomes the evidence excerpt as-is. */
export function knowledgeToEvidence(data: KnowledgeSearchResponseData, retrievedAt: string): EvidenceItem[] {
  return data.results.map((entity) => ({
    source: { title: entity.name, url: entity.url, provider: 'knowledge.search' },
    excerpt: entity.description ?? undefined,
    retrievedAt,
    data: omitNullish({ id: entity.id }),
  }));
}

/** Deduplicates by exact (title, url, provider) — the same source cited by multiple evidence items counts once. */
export function dedupeSources(items: readonly EvidenceItem[]): EvidenceSourceRef[] {
  const seen = new Map<string, EvidenceSourceRef>();
  for (const item of items) {
    const key = `${item.source.provider}|${item.source.title}|${item.source.url ?? ''}`;
    if (!seen.has(key)) {
      seen.set(key, item.source);
    }
  }
  return [...seen.values()];
}

/**
 * Groups evidence items by normalized title (the "subject") and flags cases
 * where two items about the same subject carry different `excerpt` text —
 * a real, deterministic conflict signal. Deliberately narrow: only compares
 * `excerpt`, only within items sharing an exact (case/whitespace-insensitive)
 * title match. An empty result is the common, correct outcome — most
 * subjects appear once, or multiple sources agree.
 */
export function detectDisagreements(items: readonly EvidenceItem[]): EvidenceDisagreement[] {
  const bySubject = new Map<string, EvidenceItem[]>();
  for (const item of items) {
    const key = item.source.title.trim().toLowerCase();
    if (!key) continue;
    const group = bySubject.get(key) ?? [];
    group.push(item);
    bySubject.set(key, group);
  }

  const disagreements: EvidenceDisagreement[] = [];
  for (const group of bySubject.values()) {
    if (group.length < 2) continue;

    const seenValues = new Set<string>();
    const values: EvidenceDisagreementValue[] = [];
    for (const item of group) {
      const value = item.excerpt?.trim();
      if (!value || seenValues.has(value)) continue;
      seenValues.add(value);
      values.push({ value, source: item.source });
    }

    if (values.length > 1) {
      disagreements.push({ subject: group[0]!.source.title, attribute: 'excerpt', values });
    }
  }
  return disagreements;
}
