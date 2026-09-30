/** Best-effort domain extraction for providers that don't return a clean source/domain field of their own. */
export function extractDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}
