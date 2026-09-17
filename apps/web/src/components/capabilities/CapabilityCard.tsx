import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PriceTag } from '@/components/PriceTag';
import { formatCategory, formatProvider } from '@/lib/format';
import { categoryIcon } from '@/lib/category-icons';
import type { PublicCapability } from '@/types/capability';

export interface CapabilityCardProps {
  readonly capability: PublicCapability;
}

export function CapabilityCard({ capability }: CapabilityCardProps): React.JSX.Element {
  const Icon = categoryIcon(capability.category);

  return (
    <Link
      to={`/capabilities/${capability.id}`}
      className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full transition-colors group-hover:border-sapphire-hairline">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <Icon className="size-8 shrink-0 text-frosted-lilac" aria-hidden />
            <Badge variant="outline">{formatCategory(capability.category)}</Badge>
          </div>
          <CardTitle className="mt-3 flex items-center gap-1.5 text-xl">
            {capability.name}
            <ArrowUpRight className="size-4 text-ash opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-mist">{capability.description}</p>
          <div className="flex items-center justify-between gap-3 border-t border-inkline pt-4">
            <code className="font-mono text-xs text-ash">
              {capability.method} {capability.path}
            </code>
            <PriceTag amount={capability.price.amount} />
          </div>
          <p className="text-xs text-ash">
            {capability.provider.kind === 'composite' ? 'Composition' : 'Atomic'} · {formatProvider(capability.provider)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
