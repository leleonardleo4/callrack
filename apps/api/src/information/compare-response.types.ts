import type { EvidenceDisagreement, EvidenceSourceRef } from './information.types.js';

export interface CompareSubject {
  readonly name: string;
  /** Which Callrack capabilities returned a result for this subject. */
  readonly sources: readonly string[];
}

export interface CompareAttributeRow {
  readonly subject: string;
  readonly key: string;
  readonly value: string;
  readonly provider: string;
}

export interface CompareResponseData {
  readonly query: string;
  readonly subjects: readonly CompareSubject[];
  readonly attributes: readonly CompareAttributeRow[];
  readonly sources: readonly EvidenceSourceRef[];
  readonly disagreements: readonly EvidenceDisagreement[];
}
