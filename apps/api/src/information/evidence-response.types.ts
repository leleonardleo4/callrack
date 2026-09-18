import type { EvidenceItem, EvidenceSourceRef } from './information.types.js';

export interface EvidenceResponseData {
  readonly query: string;
  readonly findings: readonly EvidenceItem[];
  readonly sources: readonly EvidenceSourceRef[];
  readonly retrievedAt: string;
}
