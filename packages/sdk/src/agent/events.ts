import type { AgentEvent, AgentEventType } from './types.js';

export type AgentEventListener = (event: AgentEvent) => void;

/**
 * Collects the agent's structured decision log and optionally streams each
 * event to a listener (the reference CLI uses this to print live progress).
 * `emit`'s `data` is typed to exclude anything secret-shaped by construction
 * — only primitives, never objects that could carry a signature or key.
 */
export class AgentEventLog {
  private readonly events: AgentEvent[] = [];

  constructor(private readonly listener?: AgentEventListener) {}

  emit(
    type: AgentEventType,
    message: string,
    options: {
      readonly capabilityId?: string;
      readonly requestId?: string;
      readonly data?: Readonly<Record<string, string | number | boolean | null>>;
    } = {},
  ): void {
    const event: AgentEvent = {
      type,
      timestamp: new Date().toISOString(),
      capabilityId: options.capabilityId,
      requestId: options.requestId,
      message,
      data: options.data,
    };
    this.events.push(event);
    this.listener?.(event);
  }

  all(): readonly AgentEvent[] {
    return this.events;
  }
}
