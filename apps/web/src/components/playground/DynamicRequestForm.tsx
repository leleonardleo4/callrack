import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { fieldKindFor, type FormFieldValue } from '@/lib/dynamic-form';
import type { RequestJsonSchema } from '@/types/capability';

export interface DynamicRequestFormProps {
  readonly schema: RequestJsonSchema;
  readonly values: Record<string, FormFieldValue>;
  readonly onChange: (name: string, value: FormFieldValue) => void;
  readonly fieldError?: { readonly field: string; readonly message: string };
}

export function DynamicRequestForm({ schema, values, onChange, fieldError }: DynamicRequestFormProps): React.JSX.Element {
  const required = new Set(schema.required ?? []);
  const entries = Object.entries(schema.properties);

  if (entries.length === 0) {
    return <p className="text-sm text-ash">This capability takes no request body fields.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {entries.map(([name, fieldSchema]) => {
        const kind = fieldKindFor(fieldSchema);
        const fieldId = `field-${name}`;
        const isRequired = required.has(name);
        const errorForField = fieldError?.field === name ? fieldError.message : undefined;

        return (
          <div key={name} className="flex flex-col gap-1.5">
            <Label htmlFor={fieldId} className="flex items-center gap-1 text-mist">
              <span className="font-mono text-xs text-quartz">{name}</span>
              {isRequired ? <span className="text-frosted-lilac">*</span> : null}
              {fieldSchema.description ? <span className="text-xs text-ash">: {fieldSchema.description}</span> : null}
            </Label>

            {kind === 'boolean' ? (
              <Switch
                id={fieldId}
                checked={Boolean(values[name])}
                onCheckedChange={(checked) => onChange(name, checked)}
              />
            ) : kind === 'json' ? (
              <Textarea
                id={fieldId}
                value={String(values[name] ?? '')}
                onChange={(event) => onChange(name, event.target.value)}
                rows={4}
                className="font-mono text-xs"
                aria-invalid={Boolean(errorForField)}
              />
            ) : (
              <Input
                id={fieldId}
                type={kind === 'number' ? 'number' : 'text'}
                value={String(values[name] ?? '')}
                onChange={(event) =>
                  onChange(name, kind === 'number' ? event.target.value : event.target.value)
                }
                placeholder={kind === 'string-array' ? 'comma-separated values' : undefined}
                min={fieldSchema.minimum}
                max={fieldSchema.maximum}
                aria-invalid={Boolean(errorForField)}
                aria-required={isRequired}
              />
            )}

            {errorForField ? (
              <p className="text-xs text-destructive" role="alert">
                {errorForField}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
