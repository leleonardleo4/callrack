import { describe, expect, it, vi } from 'vitest';
import { runProviderChain } from '../../../src/providers/common/provider-fallback.js';
import { ProviderError, ProviderErrorCode } from '../../../src/providers/common/provider.errors.js';
import type { ProviderCooldownService } from '../../../src/providers/common/provider-cooldown.service.js';

function unavailable(slug: string): ProviderError {
  return new ProviderError({ code: ProviderErrorCode.PROVIDER_UNAVAILABLE, message: 'down', providerSlug: slug });
}

function fakeCooldown(coolingDown: Set<string> = new Set()): ProviderCooldownService & { markFailure: ReturnType<typeof vi.fn> } {
  return {
    isCoolingDown: vi.fn(async (slug: string) => coolingDown.has(slug)),
    markFailure: vi.fn().mockResolvedValue(undefined),
  } as unknown as ProviderCooldownService & { markFailure: ReturnType<typeof vi.fn> };
}

describe('runProviderChain', () => {
  it('returns the first successful attempt without trying the rest', async () => {
    const b = vi.fn();
    const outcome = await runProviderChain([
      { slug: 'a', run: () => Promise.resolve('a-result') },
      { slug: 'b', run: b },
    ]);

    expect(outcome).toEqual({ result: 'a-result', providerSlug: 'a' });
    expect(b).not.toHaveBeenCalled();
  });

  it('falls through to the next attempt on a ProviderError', async () => {
    const outcome = await runProviderChain([
      { slug: 'a', run: () => Promise.reject(unavailable('a')) },
      { slug: 'b', run: () => Promise.resolve('b-result') },
    ]);

    expect(outcome).toEqual({ result: 'b-result', providerSlug: 'b' });
  });

  it('rethrows a non-ProviderError immediately instead of falling back', async () => {
    const b = vi.fn();
    await expect(
      runProviderChain([
        { slug: 'a', run: () => Promise.reject(new Error('bug')) },
        { slug: 'b', run: b },
      ]),
    ).rejects.toThrow('bug');
    expect(b).not.toHaveBeenCalled();
  });

  it('throws the last error when every attempt fails', async () => {
    await expect(
      runProviderChain([
        { slug: 'a', run: () => Promise.reject(unavailable('a')) },
        { slug: 'b', run: () => Promise.reject(unavailable('b')) },
      ]),
    ).rejects.toMatchObject({ providerSlug: 'b' });
  });

  it('treats an empty result as a miss and falls through, unless it is the last attempt', async () => {
    const outcome = await runProviderChain(
      [
        { slug: 'a', run: () => Promise.resolve({ items: [] }) },
        { slug: 'b', run: () => Promise.resolve({ items: ['x'] }) },
      ],
      { isEmpty: (r: { items: unknown[] }) => r.items.length === 0 },
    );

    expect(outcome).toEqual({ result: { items: ['x'] }, providerSlug: 'b' });
  });

  it('returns the last attempt\'s empty result when every attempt is empty', async () => {
    const outcome = await runProviderChain(
      [
        { slug: 'a', run: () => Promise.resolve({ items: [] }) },
        { slug: 'b', run: () => Promise.resolve({ items: [] }) },
      ],
      { isEmpty: (r: { items: unknown[] }) => r.items.length === 0 },
    );

    expect(outcome).toEqual({ result: { items: [] }, providerSlug: 'b' });
  });

  it('skips a provider that is cooling down, unless it is the only attempt left', async () => {
    const cooldown = fakeCooldown(new Set(['a']));
    const aRun = vi.fn();

    const outcome = await runProviderChain(
      [
        { slug: 'a', run: aRun },
        { slug: 'b', run: () => Promise.resolve('b-result') },
      ],
      { cooldown },
    );

    expect(aRun).not.toHaveBeenCalled();
    expect(outcome.providerSlug).toBe('b');
  });

  it('still attempts the last provider even if it is cooling down, rather than failing with nothing tried', async () => {
    const cooldown = fakeCooldown(new Set(['a']));

    const outcome = await runProviderChain([{ slug: 'a', run: () => Promise.resolve('a-result') }], { cooldown });

    expect(outcome).toEqual({ result: 'a-result', providerSlug: 'a' });
  });

  it('marks a failing provider on cooldown', async () => {
    const cooldown = fakeCooldown();

    await runProviderChain(
      [
        { slug: 'a', run: () => Promise.reject(unavailable('a')) },
        { slug: 'b', run: () => Promise.resolve('b-result') },
      ],
      { cooldown },
    );

    expect(cooldown.markFailure).toHaveBeenCalledWith('a', expect.any(ProviderError));
  });

  it('rejects when called with no attempts', async () => {
    await expect(runProviderChain([])).rejects.toThrow();
  });
});
