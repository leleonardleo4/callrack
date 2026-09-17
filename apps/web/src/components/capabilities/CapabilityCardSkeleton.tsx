import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function CapabilityCardSkeleton(): React.JSX.Element {
  return (
    <Card aria-hidden>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="mt-3 h-6 w-2/3" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <div className="flex items-center justify-between border-t border-inkline pt-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

export function CapabilityGridSkeleton({ count = 6 }: { count?: number }): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading capabilities">
      {Array.from({ length: count }, (_, index) => (
        <CapabilityCardSkeleton key={index} />
      ))}
    </div>
  );
}
