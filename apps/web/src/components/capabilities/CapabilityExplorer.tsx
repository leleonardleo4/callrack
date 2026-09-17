import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CapabilityCard } from '@/components/capabilities/CapabilityCard';
import { formatCategory } from '@/lib/format';
import type { CapabilityCategory, PublicCapability } from '@/types/capability';

export interface CapabilityExplorerProps {
  readonly capabilities: readonly PublicCapability[];
}

const ALL_CATEGORIES = 'all';

export function CapabilityExplorer({ capabilities }: CapabilityExplorerProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);

  const categories = useMemo<readonly CapabilityCategory[]>(() => {
    const seen = new Set<CapabilityCategory>();
    for (const capability of capabilities) seen.add(capability.category);
    return [...seen].sort();
  }, [capabilities]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return capabilities.filter((capability) => {
      const matchesCategory = category === ALL_CATEGORIES || capability.category === category;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        capability.name.toLowerCase().includes(normalizedQuery) ||
        capability.description.toLowerCase().includes(normalizedQuery) ||
        capability.path.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [capabilities, query, category]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ash" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search capabilities…"
            aria-label="Search capabilities"
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger aria-label="Filter by category" className="w-full sm:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {formatCategory(cat)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-inkline bg-deep-sea px-6 py-12 text-center text-sm text-ash">
          No capabilities match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((capability) => (
            <CapabilityCard key={capability.id} capability={capability} />
          ))}
        </div>
      )}
    </div>
  );
}
