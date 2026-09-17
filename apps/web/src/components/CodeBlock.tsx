import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from 'cn';

export interface CodeBlockProps {
  readonly code: string;
  readonly label?: string;
  readonly className?: string;
}

/** The signature devtool component per DESIGN.md: filename/label header, mono body, copy action. */
export function CodeBlock({ code, label, className }: CodeBlockProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied (permissions, insecure context), so the
      // copy button simply stays inert; the code is still visible/selectable.
    }
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-inkline bg-deep-sea', className)}>
      {label ? (
        <div className="flex items-center justify-between border-b border-inkline px-4 py-2">
          <span className="font-mono text-xs text-ash">{label}</span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? 'Copied' : 'Copy code'}
            className="flex items-center gap-1 rounded-md p-1 text-mist transition-colors hover:text-quartz focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          </button>
        </div>
      ) : null}
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code className="font-mono text-mist">{code}</code>
      </pre>
    </div>
  );
}
