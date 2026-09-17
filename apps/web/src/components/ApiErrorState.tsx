import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export interface ApiErrorStateProps {
  readonly message: string;
}

export function ApiErrorState({ message }: ApiErrorStateProps): React.JSX.Element {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="size-4" aria-hidden />
      <AlertTitle>Couldn&apos;t reach the Callrack API</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
