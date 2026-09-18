import type { EvidenceItem } from './information.types.js';

export type VerifyVerdict = 'supported' | 'contradicted' | 'mixed' | 'insufficient';

export interface VerifyResponseData {
  readonly claim: string;
  readonly verdict: VerifyVerdict;
  /** 0..1. See VerifyService's own doc comment for the exact, deterministic formula. */
  readonly confidence: number;
  readonly evidence: readonly EvidenceItem[];
  readonly agreementCount: number;
  readonly contradictionCount: number;
  readonly sourcesChecked: number;
}
