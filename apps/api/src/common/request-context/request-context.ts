import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextData {
  requestId: string;
  [key: string]: unknown;
}

export class RequestContext {
  private static readonly storage = new AsyncLocalStorage<RequestContextData>();

  static run<R>(data: RequestContextData, fn: () => R): R {
    return this.storage.run(data, fn);
  }

  static current(): RequestContextData | undefined {
    return this.storage.getStore();
  }

  static get requestId(): string | undefined {
    return this.current()?.requestId;
  }

  static set(key: string, value: unknown): void {
    const store = this.current();
    if (store) {
      store[key] = value;
    }
  }

  static get<T = unknown>(key: string): T | undefined {
    const store = this.current();
    return store ? (store[key] as T) : undefined;
  }
}
