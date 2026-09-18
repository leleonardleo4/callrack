import type {
  AcademicSearchInput,
  AcademicSearchOutput,
  CompareInput,
  CompareOutput,
  EvidenceInput,
  EvidenceOutput,
  NewsSearchInput,
  NewsSearchOutput,
  ResearchInput,
  ResearchOutput,
  VerifyInput,
  VerifyOutput,
  WeatherInput,
  WeatherOutput,
} from './capability-types.js';
import { CallrackValidationError } from './errors.js';
import { CallrackHttpClient } from './http-client.js';
import { resolveNetwork, type CallrackNetwork, type ResolvedNetwork } from './network.js';
import type { PaymentEventListener } from './payment-events.js';
import type { CallrackPaymentSigner } from './signer.js';
import { defaultSpendPolicy, type CallrackSpendPolicy } from './spend-policy.js';
import type { ApiSuccessMeta, PublicCapabilitiesData, PublicCapability } from './types.js';
import { X402PaymentClient } from './x402-payment-client.js';

const DEFAULT_BASE_URL = 'http://localhost:3000';

export interface CallrackClientOptions {
  /** Defaults to `http://localhost:3000` for local development — never hardcode a production URL. */
  readonly baseUrl?: string;
  /** Defaults to `testnet`; a Mainnet client must be requested explicitly. */
  readonly network?: CallrackNetwork;
  /**
   * A payment signer (see `CallrackPaymentSigner`, `testnetSignerFromEnv`).
   * Without one, capability calls that return 402 surface a
   * `CallrackPaymentRequiredError` instead of paying automatically.
   */
  readonly signer?: CallrackPaymentSigner;
  /** Defaults to `defaultSpendPolicy(network)` — this client's own network, USDC only, capped at $1.00/payment. */
  readonly spendPolicy?: CallrackSpendPolicy;
  readonly timeoutMs?: number;
  /** Observes the x402 payment lifecycle (never secrets) — used by `CallrackAgentRuntime`'s decision log. */
  readonly onPaymentEvent?: PaymentEventListener;
}

export interface CallResult<T> {
  readonly data: T;
  readonly meta: ApiSuccessMeta;
}

export interface ListCapabilitiesOptions {
  /** Bypasses this client's in-memory capability cache and re-fetches from the discovery endpoint. */
  readonly forceRefresh?: boolean;
}

/**
 * The Callrack SDK's top-level client: capability discovery, generic
 * capability invocation, and transparent x402 payment handling. Capability
 * metadata always comes from the live `GET /v1/capabilities` endpoint, never
 * a bundled registry — prices and availability can change server-side
 * without an SDK release.
 */
export class CallrackClient {
  readonly baseUrl: string;
  readonly network: ResolvedNetwork;

  private readonly discoveryHttp: CallrackHttpClient;
  private readonly callHttp: CallrackHttpClient;
  private capabilitiesCache: readonly PublicCapability[] | undefined;

  constructor(options: CallrackClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.network = resolveNetwork(options.network ?? 'testnet');

    const plainFetch = globalThis.fetch.bind(globalThis);
    this.discoveryHttp = new CallrackHttpClient({
      baseUrl: this.baseUrl,
      fetchImpl: plainFetch,
      timeoutMs: options.timeoutMs,
    });

    const paymentFetch = options.signer
      ? new X402PaymentClient({
          resolvedNetwork: this.network,
          signer: options.signer,
          spendPolicy: options.spendPolicy ?? defaultSpendPolicy(this.network),
          onPaymentEvent: options.onPaymentEvent,
        }).fetch
      : plainFetch;

    this.callHttp = new CallrackHttpClient({
      baseUrl: this.baseUrl,
      fetchImpl: paymentFetch,
      timeoutMs: options.timeoutMs,
      hasSigner: Boolean(options.signer),
    });
  }

  /** Fetches (and caches) the current public capability list from `GET /v1/capabilities`. */
  async listCapabilities(options: ListCapabilitiesOptions = {}): Promise<readonly PublicCapability[]> {
    if (!options.forceRefresh && this.capabilitiesCache) {
      return this.capabilitiesCache;
    }
    const response = await this.discoveryHttp.request<PublicCapabilitiesData>('/v1/capabilities');
    this.capabilitiesCache = response.data.capabilities;
    return this.capabilitiesCache;
  }

  /** Alias of `listCapabilities`. */
  async capabilities(options?: ListCapabilitiesOptions): Promise<readonly PublicCapability[]> {
    return this.listCapabilities(options);
  }

  async getCapability(id: string): Promise<PublicCapability> {
    const capabilities = await this.listCapabilities();
    const capability = capabilities.find((entry) => entry.id === id);
    if (!capability) {
      throw new CallrackValidationError(`Unknown capability: ${id}`, { capabilityId: id });
    }
    return capability;
  }

  /** Alias of `getCapability`. */
  async capability(id: string): Promise<PublicCapability> {
    return this.getCapability(id);
  }

  /**
   * Invokes any discovered capability by id — the entry point an agent
   * uses for capabilities it did not know about at compile time. 402s are
   * paid automatically when a signer is configured; otherwise they surface
   * as `CallrackPaymentRequiredError`.
   */
  async call<TInput = Record<string, unknown>, TOutput = unknown>(id: string, input: TInput): Promise<CallResult<TOutput>> {
    const capability = await this.getCapability(id);
    const response = await this.callHttp.request<TOutput>(capability.path, {
      method: capability.method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input ?? {}),
    });
    return { data: response.data, meta: response.meta };
  }

  async weather(input: WeatherInput): Promise<CallResult<WeatherOutput>> {
    return this.call<WeatherInput, WeatherOutput>('weather', input);
  }

  readonly news = {
    search: (input: NewsSearchInput): Promise<CallResult<NewsSearchOutput>> =>
      this.call<NewsSearchInput, NewsSearchOutput>('news.search', input),
  };

  readonly academic = {
    search: (input: AcademicSearchInput): Promise<CallResult<AcademicSearchOutput>> =>
      this.call<AcademicSearchInput, AcademicSearchOutput>('academic.search', input),
  };

  /** Verify a claim against existing Callrack capabilities — deterministic, never an LLM. See `VerifyOutput`. */
  async verify(input: VerifyInput): Promise<CallResult<VerifyOutput>> {
    return this.call<VerifyInput, VerifyOutput>('information.verify', input);
  }

  /** A machine-readable evidence pack for a query — never an AI-generated narrative answer. */
  async evidence(input: EvidenceInput): Promise<CallResult<EvidenceOutput>> {
    return this.call<EvidenceInput, EvidenceOutput>('information.evidence', input);
  }

  /** Structured comparison across whatever distinct subjects the underlying capabilities return for a query. */
  async compare(input: CompareInput): Promise<CallResult<CompareOutput>> {
    return this.call<CompareInput, CompareOutput>('information.compare', input);
  }

  /** Evidence-backed research packet: findings, provenance, per-source status, and composition metadata. */
  async research(input: ResearchInput): Promise<CallResult<ResearchOutput>> {
    return this.call<ResearchInput, ResearchOutput>('research', input);
  }
}
