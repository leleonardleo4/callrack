import type { AgentTool } from './types.js';

export interface PlannedStep {
  readonly toolId: string;
  readonly input: Readonly<Record<string, unknown>>;
}

/**
 * Selects which discovered tools to call, and with what input, for a task.
 * `CallrackAgentRuntime` takes one of these as a constructor option so a
 * future LLM-backed planner can replace `deterministicPlanner` without
 * changing anything else in the runtime.
 */
export type AgentPlanner = (task: string, tools: readonly AgentTool[]) => readonly PlannedStep[];

interface KeywordRule {
  readonly pattern: RegExp;
  readonly toolId: string;
  readonly buildInput: (task: string) => Readonly<Record<string, unknown>>;
}

const KEYWORD_RULES: readonly KeywordRule[] = [
  {
    pattern: /\b(paper|papers|research|academic|scholar|scholarly|studies|study|journal)\b/i,
    toolId: 'academic.search',
    buildInput: (task) => ({ query: task, limit: 5 }),
  },
  {
    pattern: /\b(news|headline|headlines|article|articles|coverage|reporting)\b/i,
    toolId: 'news.search',
    buildInput: (task) => ({ query: task, limit: 5 }),
  },
  {
    pattern: /\b(census|population|demographic|demographics)\b/i,
    toolId: 'government.census',
    buildInput: (task) => ({ query: task }),
  },
  {
    pattern: /\b(verify|confirm|true or false|fact.?check)\b/i,
    toolId: 'information.verify',
    buildInput: (task) => ({ claim: task }),
  },
  {
    pattern: /\b(evidence|proof|sources? for)\b/i,
    toolId: 'information.evidence',
    buildInput: (task) => ({ query: task }),
  },
  {
    pattern: /\b(compare|comparison|versus|vs\.?)\b/i,
    toolId: 'information.compare',
    buildInput: (task) => ({ query: task }),
  },
];

/**
 * A deterministic, keyword-based planner — not an autonomous LLM planner.
 * This phase's job is the SDK/agent *foundation*, not planning intelligence:
 * matches each keyword rule whose tool was actually discovered (never a
 * capability the client didn't advertise), and falls back to
 * `knowledge.search` when nothing else matched and it's available. Every
 * matching rule fires — a task can plan more than one capability call.
 */
export function deterministicPlanner(task: string, tools: readonly AgentTool[]): readonly PlannedStep[] {
  const availableIds = new Set(tools.map((tool) => tool.id));
  const steps: PlannedStep[] = [];

  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(task) && availableIds.has(rule.toolId)) {
      steps.push({ toolId: rule.toolId, input: rule.buildInput(task) });
    }
  }

  if (steps.length === 0 && availableIds.has('knowledge.search')) {
    steps.push({ toolId: 'knowledge.search', input: { query: task } });
  }

  return steps;
}
