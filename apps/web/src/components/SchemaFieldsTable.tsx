import type { JsonSchemaProperty } from '@/types/capability';

export interface SchemaFieldsTableProps {
  readonly properties: Record<string, JsonSchemaProperty>;
  readonly required?: readonly string[];
}

function describeType(schema: JsonSchemaProperty): string {
  if (typeof schema.type !== 'string') return schema.type ? schema.type.join(' | ') : 'any';
  if (schema.type === 'array' && schema.items) return `${describeType(schema.items)}[]`;
  return schema.type;
}

export function SchemaFieldsTable({ properties, required = [] }: SchemaFieldsTableProps): React.JSX.Element {
  const entries = Object.entries(properties);

  if (entries.length === 0) {
    return <p className="text-sm text-ash">No request body fields.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-inkline">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-inkline bg-deep-sea text-left text-xs text-ash uppercase">
            <th scope="col" className="px-4 py-2 font-medium">
              Field
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Type
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([name, schema]) => (
            <tr key={name} className="border-b border-inkline last:border-b-0">
              <td className="px-4 py-3 align-top font-mono text-xs text-quartz">
                {name}
                {required.includes(name) ? <span className="ml-1 text-frosted-lilac">*</span> : null}
              </td>
              <td className="px-4 py-3 align-top font-mono text-xs text-frosted-lilac">{describeType(schema)}</td>
              <td className="px-4 py-3 align-top text-mist">
                {schema.description ?? 'No description.'}
                {schema.enum ? (
                  <span className="mt-1 block font-mono text-xs text-ash">one of: {schema.enum.join(', ')}</span>
                ) : null}
                {schema.minimum !== undefined || schema.maximum !== undefined ? (
                  <span className="mt-1 block text-xs text-ash">
                    range: {schema.minimum ?? '−∞'}–{schema.maximum ?? '∞'}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
