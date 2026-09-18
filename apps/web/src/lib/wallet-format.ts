/** Shortens a real Algorand address for display (e.g. "TTCZ…UEQXQ") - never a fabricated or partial-looking placeholder. */
export function shortenAddress(address: string, headLength = 4, tailLength = 6): string {
  if (address.length <= headLength + tailLength + 1) return address;
  return `${address.slice(0, headLength)}…${address.slice(-tailLength)}`;
}
