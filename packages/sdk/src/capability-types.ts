/**
 * Hand-typed request/response shapes for a handful of headline capabilities
 * (see `CallrackClient.weather`/`.news.search`/`.academic.search`), mirrored
 * from `apps/api/src/**\/dto` and `capability-definitions.ts` `discovery`
 * examples. This is intentionally NOT a generic capability-id-to-type
 * mapping system - every other capability stays reachable, fully
 * functional, and typed at its edges (`unknown` in/out) via the generic
 * `CallrackClient.call(id, input)`, which is how an agent discovers and
 * calls capabilities it wasn't compiled against anyway.
 */

export interface WeatherInput {
  readonly latitude: number;
  readonly longitude: number;
  readonly days?: number;
}

export interface WeatherLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string | null;
}

export interface WeatherCurrentConditions {
  readonly time: string;
  readonly temperature: number | null;
  readonly humidity: number | null;
  readonly windSpeed: number | null;
  readonly precipitation: number | null;
  readonly weatherCode: number | null;
}

export interface WeatherDailyForecast {
  readonly date: string;
  readonly temperatureMax: number | null;
  readonly temperatureMin: number | null;
  readonly weatherCode: number | null;
}

export interface WeatherOutput {
  readonly location: WeatherLocation;
  readonly current: WeatherCurrentConditions | null;
  readonly daily: readonly WeatherDailyForecast[];
}

export interface NewsSearchInput {
  readonly query: string;
  readonly limit?: number;
}

export interface NewsArticle {
  readonly title: string;
  readonly url: string;
  readonly source: string | null;
  readonly publishedAt: string | null;
  readonly language: string | null;
  readonly country: string | null;
}

export interface NewsSearchOutput {
  readonly results: readonly NewsArticle[];
}

export interface AcademicSearchInput {
  readonly query: string;
  readonly limit?: number;
}

export interface AcademicWork {
  readonly id: string;
  readonly title: string;
  readonly authors: readonly string[];
  readonly publicationYear: number | null;
  readonly doi: string | null;
  readonly url: string | null;
  readonly journal: string | null;
  readonly citations: number | null;
  readonly openAccess: boolean;
  readonly source: string;
}

export interface AcademicSearchOutput {
  readonly results: readonly AcademicWork[];
  readonly meta: { readonly count: number };
}

/**
 * Shared provenance-preserving evidence shape, mirrored from
 * `apps/api/src/information/information.types.ts` - the same type
 * `verify`/`evidence`/`compare`/the upgraded `research` all use.
 */
export interface EvidenceSourceRef {
  readonly title: string;
  readonly url?: string;
  /** The Callrack capability that produced this item (e.g. "news.search") - never an upstream provider name. */
  readonly provider: string;
}

export interface EvidenceItem {
  readonly source: EvidenceSourceRef;
  readonly excerpt?: string;
  readonly retrievedAt: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface EvidenceDisagreementValue {
  readonly value: string;
  readonly source: EvidenceSourceRef;
}

export interface EvidenceDisagreement {
  readonly subject: string;
  readonly attribute: string;
  readonly values: readonly EvidenceDisagreementValue[];
}

export type InformationSourceType = 'academic' | 'news' | 'knowledge';

export interface VerifyInput {
  readonly claim: string;
  readonly sourceTypes?: readonly InformationSourceType[];
  readonly maxSources?: number;
}

export type VerifyVerdict = 'supported' | 'contradicted' | 'mixed' | 'insufficient';

export interface VerifyOutput {
  readonly claim: string;
  readonly verdict: VerifyVerdict;
  /** 0..1, deterministic - see the API's own VerifyService doc comment for the exact formula. Not an AI confidence score. */
  readonly confidence: number;
  readonly evidence: readonly EvidenceItem[];
  readonly agreementCount: number;
  readonly contradictionCount: number;
  readonly sourcesChecked: number;
}

export interface EvidenceInput {
  readonly query: string;
  readonly sourceTypes?: readonly InformationSourceType[];
  readonly limit?: number;
}

export interface EvidenceOutput {
  readonly query: string;
  readonly findings: readonly EvidenceItem[];
  readonly sources: readonly EvidenceSourceRef[];
  readonly retrievedAt: string;
}

export interface CompareInput {
  readonly query: string;
  readonly sourceTypes?: readonly InformationSourceType[];
  readonly limit?: number;
}

export interface CompareSubject {
  readonly name: string;
  readonly sources: readonly string[];
}

export interface CompareAttributeRow {
  readonly subject: string;
  readonly key: string;
  readonly value: string;
  readonly provider: string;
}

export interface CompareOutput {
  readonly query: string;
  readonly subjects: readonly CompareSubject[];
  readonly attributes: readonly CompareAttributeRow[];
  readonly sources: readonly EvidenceSourceRef[];
  readonly disagreements: readonly EvidenceDisagreement[];
}

export type ResearchSourceName = 'academic' | 'news' | 'knowledge' | 'government';

export interface ResearchGovernmentOptions {
  readonly dataset: string;
  readonly year: number;
  readonly variables: readonly string[];
  readonly forGeography: string;
}

export interface ResearchInput {
  readonly query: string;
  readonly sources?: readonly ResearchSourceName[];
  readonly limit?: number;
  readonly government?: ResearchGovernmentOptions;
}

export type ResearchSourceStatus = 'success' | 'empty' | 'failed';

export interface ResearchSourceError {
  readonly code: string;
  readonly message: string;
}

export interface ResearchSourceEntry {
  readonly status: ResearchSourceStatus;
  /** Present when status is "success" or "empty" - shape varies by source (e.g. AcademicSearchOutput, NewsSearchOutput). */
  readonly data?: unknown;
  readonly error?: ResearchSourceError;
}

export interface ResearchSourcesMap {
  readonly academic?: ResearchSourceEntry;
  readonly news?: ResearchSourceEntry;
  readonly knowledge?: ResearchSourceEntry;
  readonly government?: ResearchSourceEntry;
}

export type ResearchOverallStatus = 'complete' | 'partial' | 'failed';

export interface ResearchCompositionMetadata {
  readonly sourcesRequested: readonly ResearchSourceName[];
  readonly sourcesSucceeded: readonly ResearchSourceName[];
  readonly sourcesEmpty: readonly ResearchSourceName[];
  readonly sourcesFailed: readonly ResearchSourceName[];
  readonly retrievedAt: string;
}

export interface ResearchOutput {
  readonly query: string;
  readonly status: ResearchOverallStatus;
  /** Per-source raw capability responses - kept for backward compatibility. */
  readonly sources: ResearchSourcesMap;
  /** The same sources' results normalized into provenance-preserving evidence items (government excluded - see EvidenceItem). */
  readonly findings: readonly EvidenceItem[];
  readonly disagreements: readonly EvidenceDisagreement[];
  readonly composition: ResearchCompositionMetadata;
}
