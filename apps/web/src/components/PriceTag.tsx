import { cn } from 'cn';

export interface PriceTagProps {
  readonly amount: string;
  readonly className?: string;
}

/** Always renders the exact decimal string from the registry, never parsed through a float. */
export function PriceTag({ amount, className }: PriceTagProps): React.JSX.Element {
  return (
    <span className={cn('font-mono text-sm font-medium text-frosted-lilac', className)}>
      ${amount} <span className="text-ash">USDC</span>
    </span>
  );
}
