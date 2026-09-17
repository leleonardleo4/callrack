const STATUS_LABELS: Record<number, string> = {
  200: 'OK',
  400: 'Bad Request',
  402: 'Payment Required',
  404: 'Not Found',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export function statusLabel(status: number): string {
  return STATUS_LABELS[status] ?? 'Unknown';
}
