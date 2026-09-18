import { CallrackClient, type CallrackClientOptions } from '../client.js';
import { CallrackPaymentError, CallrackPaymentPolicyError, CallrackPaymentRequiredError, isCallrackError } from '../errors.js';
import { convertToTokenAmount } from '../money.js';
import type { PaymentEvent } from '../payment-events.js';
import { AgentBudget } from './budget.js';
import { AgentEventLog, type AgentEventListener } from './events.js';
import { deterministicPlanner, type AgentPlanner } from './planner.js';
import { buildToolsFromCapabilities } from './tools.js';
import type { AgentResult, AgentStepResult, CallrackAgent } from './types.js';

export interface CallrackAgentRuntimeOptions {
  /** Forwarded to `new CallrackClient(...)` — the runtime owns the client so it can wire payment-event logging. */
  readonly client: CallrackClientOptions;
  /** Exact decimal USDC string task budget (e.g. "0.25"). */
  readonly maxBudget: string;
  /** Defaults to `deterministicPlanner`; swap in an LLM-backed planner without changing anything else. */
  readonly planner?: AgentPlanner;
  readonly onEvent?: AgentEventListener;
}

const PAYMENT_EVENT_MESSAGE: Record<PaymentEvent['type'], (event: PaymentEvent) => string> = {
  payment_required: (event) => `Payment required: ${event.amount} of ${event.asset} on ${event.network}`,
  payment_approved: (event) => `Payment approved by policy: ${event.amount} of ${event.asset}`,
  payment_submitted: (event) => `Payment submitted: ${event.amount} of ${event.asset} to ${event.payTo}`,
};

function summarize(task: string, steps: readonly AgentStepResult[]): string {
  const succeeded = steps.filter((step) => step.error === undefined).length;
  const failed = steps.length - succeeded;
  const parts = [`Task: ${task}`, `${succeeded} capability call(s) succeeded`];
  if (failed > 0) parts.push(`${failed} failed or were skipped`);
  if (steps.length === 0) parts.push('no capability matched this task');
  return parts.join('. ');
}

/**
 * Deterministic-planner reference implementation of `CallrackAgent`. Chains:
 * task -> plan (which tools, which inputs) -> per-step budget check ->
 * `CallrackClient.call` (x402 payment handled transparently) -> budget
 * update -> next step — emitting the full structured event vocabulary
 * along the way, never a private key, mnemonic, or signature.
 */
export class CallrackAgentRuntime implements CallrackAgent {
  readonly #clientOptions: CallrackClientOptions;
  readonly #maxBudgetDecimal: string;
  readonly #planner: AgentPlanner;
  readonly #onEvent: AgentEventListener | undefined;

  constructor(options: CallrackAgentRuntimeOptions) {
    this.#clientOptions = options.client;
    this.#maxBudgetDecimal = options.maxBudget;
    this.#planner = options.planner ?? deterministicPlanner;
    this.#onEvent = options.onEvent;
  }

  async run(task: string): Promise<AgentResult> {
    const events = new AgentEventLog(this.#onEvent);

    const client = new CallrackClient({
      ...this.#clientOptions,
      onPaymentEvent: (event) => {
        events.emit(event.type, PAYMENT_EVENT_MESSAGE[event.type](event), {
          data: { resource: event.resource, network: event.network, asset: event.asset, amount: event.amount },
        });
      },
    });

    const budget = new AgentBudget(convertToTokenAmount(this.#maxBudgetDecimal, client.network.usdcDecimals));
    events.emit('budget_updated', `Task budget set to ${this.#maxBudgetDecimal} USDC`, {
      data: { ...budget.summary() },
    });

    const capabilities = await client.listCapabilities();
    const tools = buildToolsFromCapabilities(capabilities, client.network.usdcDecimals);
    const plan = this.#planner(task, tools);

    const steps: AgentStepResult[] = [];

    for (const plannedStep of plan) {
      const tool = tools.find((candidate) => candidate.id === plannedStep.toolId);
      if (!tool) continue;

      events.emit('capability_selected', `Selected capability "${tool.id}" (${tool.price.amount} ${tool.price.currency})`, {
        capabilityId: tool.id,
      });

      if (!budget.canAfford(tool.priceAtomic)) {
        events.emit('payment_rejected', `Budget exceeded: "${tool.id}" costs more than the remaining task budget`, {
          capabilityId: tool.id,
          data: { priceAtomic: tool.priceAtomic, remainingAtomic: budget.remainingAtomic },
        });
        steps.push({ toolId: tool.id, input: plannedStep.input, spentAtomic: '0', error: 'PAYMENT_BUDGET_EXCEEDED' });
        continue;
      }

      events.emit('request_started', `Calling capability "${tool.id}"`, { capabilityId: tool.id });

      try {
        const result = await client.call(tool.id, plannedStep.input);
        budget.record(tool.priceAtomic);
        events.emit('response_received', `Received response from "${tool.id}"`, {
          capabilityId: tool.id,
          requestId: result.meta.requestId,
        });
        events.emit('budget_updated', `Spent ${tool.price.amount} ${tool.price.currency} on "${tool.id}"`, {
          capabilityId: tool.id,
          requestId: result.meta.requestId,
          data: { ...budget.summary() },
        });
        steps.push({ toolId: tool.id, input: plannedStep.input, output: result.data, spentAtomic: tool.priceAtomic });
      } catch (error) {
        const message = isCallrackError(error) ? error.message : String(error);
        if (
          error instanceof CallrackPaymentPolicyError ||
          error instanceof CallrackPaymentRequiredError ||
          error instanceof CallrackPaymentError
        ) {
          events.emit('payment_rejected', `Payment rejected for "${tool.id}": ${message}`, { capabilityId: tool.id });
        }
        steps.push({ toolId: tool.id, input: plannedStep.input, spentAtomic: '0', error: message });
      }
    }

    return {
      task,
      steps,
      summary: summarize(task, steps),
      budget: budget.summary(),
      events: events.all(),
    };
  }
}
