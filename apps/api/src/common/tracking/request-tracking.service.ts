import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';

export type TrackedRequestStatus = 'SUCCESS' | 'ERROR' | 'TIMEOUT';

export interface RequestTrackingEntry {
  requestId: string;
  endpoint: string;
  capabilitySlug: string;
  capabilityName: string;
  providerSlug?: string;
  providerName?: string;
  status: TrackedRequestStatus;
  durationMs: number;
  cacheHit: boolean;
}

/**
 * Best-effort usage tracking against the Phase 2 Capability/Provider/Request
 * tables. Never blocks or fails a capability response: `record()` fires the
 * write in the background and swallows any error (including the database
 * being unreachable).
 */
@Injectable()
export class RequestTrackingService {
  private readonly logger = new Logger(RequestTrackingService.name);

  constructor(private readonly database: DatabaseService) {}

  record(entry: RequestTrackingEntry): void {
    void this.persist(entry).catch((error: unknown) => {
      this.logger.warn(`Failed to record request tracking: ${(error as Error).message}`);
    });
  }

  private async persist(entry: RequestTrackingEntry): Promise<void> {
    const capability = await this.database.client.capability.upsert({
      where: { slug: entry.capabilitySlug },
      update: {},
      create: { slug: entry.capabilitySlug, name: entry.capabilityName },
    });

    let providerId: string | undefined;
    if (entry.providerSlug) {
      const provider = await this.database.client.provider.upsert({
        where: { slug: entry.providerSlug },
        update: {},
        create: { slug: entry.providerSlug, name: entry.providerName ?? entry.providerSlug },
      });
      providerId = provider.id;
    }

    await this.database.client.request.create({
      data: {
        requestId: entry.requestId,
        endpoint: entry.endpoint,
        capabilityId: capability.id,
        providerId,
        status: entry.status,
        durationMs: entry.durationMs,
        cacheHit: entry.cacheHit,
      },
    });
  }
}
