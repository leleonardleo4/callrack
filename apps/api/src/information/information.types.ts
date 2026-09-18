/**
 * Shared provenance-preserving evidence shapes, reused by `verify`,
 * `evidence`, `compare`, and the upgraded `research` response. One
 * definition, several consumers — never a per-endpoint duplicate.
 */

/** Never an upstream provider name (e.g. never "openalex") — the Callrack capability that produced this item. */
export interface EvidenceSourceRef {
  readonly title: string;
  readonly url?: string;
  readonly provider: string;
}

export interface EvidenceItem {
  readonly source: EvidenceSourceRef;
  /** Present only when the underlying capability actually returned descriptive text (currently: knowledge only) — never synthesized. */
  readonly excerpt?: string;
  readonly retrievedAt: string;
  /** Additional real, structured fields already present on the underlying result (e.g. citations, publishedAt) — never fabricated, never present when the source has nothing more to offer. */
  readonly data?: Readonly<Record<string, unknown>>;
}

export type InformationSourceStatus = 'success' | 'empty' | 'failed';

export interface InformationSourceError {
  readonly code: string;
  readonly message: string;
}

export interface InformationSourceResult {
  readonly source: string;
  readonly status: InformationSourceStatus;
  readonly evidence: readonly EvidenceItem[];
  readonly error?: InformationSourceError;
}

export interface EvidenceDisagreementValue {
  readonly value: string;
  readonly source: EvidenceSourceRef;
}

/**
 * A genuine, detected conflict: the same-titled subject described with
 * different text by two different evidence items. Deliberately narrow (see
 * `detectDisagreements` in `evidence.util.ts`) — an empty array is the
 * correct, common result, not a bug.
 */
export interface EvidenceDisagreement {
  readonly subject: string;
  readonly attribute: string;
  readonly values: readonly EvidenceDisagreementValue[];
}
