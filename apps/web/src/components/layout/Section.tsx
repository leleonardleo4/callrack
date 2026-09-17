import { cn } from 'cn';

export function Section({
  className,
  children,
  ...props
}: React.ComponentProps<'section'>): React.JSX.Element {
  return (
    <section className={cn('mx-auto max-w-(--page-max-width) px-4 py-16 sm:px-6 md:py-20', className)} {...props}>
      {children}
    </section>
  );
}

export function Eyebrow({ className, children, ...props }: React.ComponentProps<'p'>): React.JSX.Element {
  return (
    <p className={cn('text-xs font-medium tracking-wide text-ash uppercase', className)} {...props}>
      {children}
    </p>
  );
}
