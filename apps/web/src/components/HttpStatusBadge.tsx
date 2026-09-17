import { cn } from 'cn';

export interface HttpStatusBadgeProps {
  readonly status: number;
  readonly label: string;
}

function toneFor(status: number): string {
  if (status === 402) return 'bg-cobalt-panel text-frosted-lilac';
  if (status >= 200 && status < 300) return 'bg-cobalt-panel text-frosted-lilac';
  if (status >= 400) return 'bg-destructive/15 text-destructive';
  return 'bg-deep-sea text-mist';
}

/** Never color-only: the status code and a text label are always both present. */
export function HttpStatusBadge({ status, label }: HttpStatusBadgeProps): React.JSX.Element {
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-sm font-medium', toneFor(status))}>
      {status} <span className="font-sans font-normal">{label}</span>
    </span>
  );
}
