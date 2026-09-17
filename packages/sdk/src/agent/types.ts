import type { CapabilityCategory, CapabilityPricing, JsonObjectSchema, RequestJsonSchema } from '../types.js';

/**
 * A Callrack capability exposed to an agent as a callable tool. Deliberately
 * excludes `PublicCapability.provider` — an agent reasons about Callrack
 * capabilities (`academic.search`, `news.search`, ...), never the upstream
 * provider behind them (OpenAlex, GDELT, ...).
 */
export interface AgentTool {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: CapabilityCategory;
  readonly inputSchema: RequestJsonSchema;
  readonly outputSchema: JsonObjectSchema;
  readonly price: CapabilityPricing;
  /** `price.amount` converted to atomic USDC base units, for budget arithmetic. */
  readonly priceAtomic: string;
}

export type AgentEventType =
  | 'capability_selected'
  | 'request_started'
  | 'payment_required'
  | 'payment_approved'
  | 'payment_rejected'
  | 'payment_submitted'
  | 'response_received'
  | 'budget_updated';

/**
 * A structured, secret-free log entry. Never carries a private key,
 * mnemonic, payment signature, or raw request/response body — only ids,
 * amounts, and short human-readable messages, since this stream is meant to
 * power a public agent demo.
 */
export interface AgentEvent {
  readonly type: AgentEventType;
  readonly timestamp: string;
  readonly capabilityId?: string;
  readonly requestId?: string;
  readonly message: string;
  readonly data?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface AgentStepResult {
  readonly toolId: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly output?: unknown;
  readonly spentAtomic: string;
  readonly error?: string;
}

export interface AgentBudgetSummary {
  readonly totalAtomic: string;
  readonly spentAtomic: string;
  readonly remainingAtomic: string;
}

export interface AgentResult {
  readonly task: string;
  readonly steps: readonly AgentStepResult[];
  readonly summary: string;
  readonly budget: AgentBudgetSummary;
  readonly events: readonly AgentEvent[];
}

/**
 * Model-agnostic agent runtime contract. Nothing in this phase hardcodes a
 * specific LLM provider — `run` takes a plain task string and the concrete
 * implementation (`CallrackAgentRuntime`) uses a deterministic planner today,
 * replaceable later by an LLM-backed one without changing this interface.
 */
export interface CallrackAgent {
  run(input: string): Promise<AgentResult>;
}
