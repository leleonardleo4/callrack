import { DEFAULT_RESEARCH_SOURCES, type ResearchSourceName } from './research-sources.constants.js';
import type { ResearchRequestDto } from './dto/research-request.dto.js';

export interface ResearchPlan {
  sources: ResearchSourceName[];
}

/**
 * Deterministic research planner: translates a validated request into the
 * exact set of Callrack capabilities to consult. No natural-language
 * inference, no LLM — purely a lookup over already-validated input, so it's
 * trivially deterministic and testable. Kept as a standalone pure function
 * (not a class, no DI) so a future LLM/agent planner can replace or wrap it
 * without touching ResearchService, capability services, or the response
 * contract.
 *
 * Policy:
 *  - `sources` explicitly provided → use exactly those (already validated
 *    against the supported set and deduplicated).
 *  - `sources` omitted → academic + news + knowledge (government is never
 *    auto-selected; it requires structured parameters no free-text query
 *    can supply, so it only runs when explicitly requested).
 */
export function planResearch(dto: ResearchRequestDto): ResearchPlan {
  if (dto.sources && dto.sources.length > 0) {
    return { sources: [...new Set(dto.sources)] };
  }
  return { sources: [...DEFAULT_RESEARCH_SOURCES] };
}
