import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';

import { AppModule } from './app/app.module.js';
import { ApiConfigService } from './config/api-config.service.js';
import { validateApiConfig } from './config/api-config.schema.js';
import { X402ConfigService } from './config/x402-config.service.js';
import { RedisService } from './redis/redis.service.js';
import { ApiExceptionFilter } from './common/errors/api-exception.filter.js';
import { createValidationException } from './common/validation/validation-exception.factory.js';
import { HttpLoggingInterceptor } from './common/logging/http-logging.interceptor.js';
import { AppLoggerService } from './common/logging/app-logger.service.js';
import {
  REQUEST_ID_HEADER,
  REQUEST_ID_RESPONSE_HEADER,
  resolveRequestId,
} from './common/http/request-id.util.js';
import { RequestContext } from './common/request-context/request-context.js';
import { CapabilityRegistryService } from './capabilities/capability-registry.service.js';
import { CapabilityRequestSchemaService } from './capabilities/capability-request-schema.service.js';
import {
  buildHttpFacilitatorClient,
  installX402Middleware,
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_RESPONSE_HEADER,
  PAYMENT_SIGNATURE_HEADER,
} from './x402/index.js';
import { buildRequestSchemaMap } from './x402/discovery-schema.util.js';

import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction,
} from 'fastify';
import type { FacilitatorClient } from '@x402/core/server';

export async function createApp(): Promise<NestFastifyApplication> {
  // Read directly from process.env, once, before the Nest app (and its
  // DI-provided ApiConfigService) exists — trustProxy/bodyLimit are Fastify
  // instance-construction options, so they can't wait for `app.get(...)`.
  // Uses the exact same schema/defaults `ApiConfigService` uses per-request,
  // so there is only one definition of these defaults, not two.
  const bootConfig = validateApiConfig(process.env);

  const adapter = new FastifyAdapter({
    requestIdHeader: REQUEST_ID_HEADER,
    genReqId: (req: { headers: Record<string, string | string[] | undefined> }) => {
      const incoming = req?.headers?.[REQUEST_ID_HEADER];
      return resolveRequestId(incoming);
    },
    // Honors X-Forwarded-* from a reverse proxy/load balancer so
    // request.ip (used by rate limiting) and req.protocol/hostname (used by
    // discovery's resolveRequestOrigin) reflect the real client/origin
    // rather than the proxy's. Safe to leave on in local dev (no proxy in
    // front, so headers are simply absent and ignored).
    trustProxy: bootConfig.TRUST_PROXY,
    bodyLimit: bootConfig.BODY_LIMIT_BYTES,
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
  });

  const configService = app.get(ApiConfigService);
  const logger = new AppLoggerService();
  app.useLogger(logger);

  // 1. Fastify native hooks for request context and response header
  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.addHook(
    'onRequest',
    (req: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction) => {
      const rawHeader = req.headers[REQUEST_ID_HEADER];
      const sanitizedId = resolveRequestId(rawHeader as string | string[] | undefined);
      req.id = sanitizedId;
      RequestContext.run({ requestId: sanitizedId }, done);
    },
  );
  fastifyInstance.addHook(
    'onSend',
    (
      req: FastifyRequest,
      reply: FastifyReply,
      _payload: unknown,
      done: HookHandlerDoneFunction,
    ) => {
      reply.header(REQUEST_ID_RESPONSE_HEADER, req.id);
      done();
    },
  );

  // 2. Security Headers (Helmet)
  await app.register(
    fastifyHelmet as unknown as FastifyPluginAsync<import('@fastify/helmet').FastifyHelmetOptions>,
    {
      contentSecurityPolicy: false, // Allows Swagger UI to load scripts/styles seamlessly
      crossOriginEmbedderPolicy: false,
      xContentTypeOptions: true,
      xFrameOptions: { action: 'sameorigin' },
    },
  );

  // 3. CORS
  // Callrack's paid capabilities are consumed by arbitrary x402 clients and
  // agents, not a single fixed browser origin, and the API never uses
  // cookies or other credentialed browser auth (payment proof travels in a
  // request header, not a cookie). Restricting `origin` to a fixed
  // allowlist would just break legitimate cross-origin callers — including
  // the GoPlausible x402 Doctor's own CORS sanity checks — without
  // protecting anything, so origin is open and `credentials` stays unset
  // (defaults to false) rather than pairing an open origin with
  // credentialed CORS.
  await app.register(
    fastifyCors as unknown as FastifyPluginAsync<import('@fastify/cors').FastifyCorsOptions>,
    {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      // PAYMENT-SIGNATURE is the request header a payer attaches to retry a
      // request with proof of payment (see @x402/core's exact/client
      // scheme) — without it in `allowedHeaders`, a real cross-origin
      // browser (e.g. the Playground) would have that header stripped by
      // CORS preflight before it ever reached the API.
      allowedHeaders: ['Content-Type', 'Authorization', REQUEST_ID_HEADER, PAYMENT_SIGNATURE_HEADER],
      // PAYMENT-REQUIRED (the 402 challenge) and PAYMENT-RESPONSE (the paid
      // settlement receipt) must be exposed the same way: browsers only let
      // JS read response headers listed here for a cross-origin request —
      // curl/server-to-server callers were never affected (no CORS
      // enforcement outside a browser), but any browser-based x402 client,
      // including the Playground, could see 402s and paid responses over
      // the wire yet never actually read either header without this.
      exposedHeaders: [REQUEST_ID_RESPONSE_HEADER, PAYMENT_REQUIRED_HEADER, PAYMENT_RESPONSE_HEADER],
    },
  );

  // 3b. Rate limiting. Global, per-client-IP (via `request.ip`, correct
  // once `trustProxy` above is honored). Backed by Redis so limits are
  // shared across replicas when Redis is reachable; `skipOnError: true`
  // means a Redis outage fails OPEN (requests proceed unlimited) rather
  // than taking the whole API down the way a fail-closed limiter would —
  // consistent with how CapabilityCacheService treats Redis. Health checks
  // are exempt so orchestrator liveness/readiness polling is never
  // throttled. Paid (x402) requests are intentionally NOT exempted or
  // given a separate, larger budget here: the per-payment cost already
  // deters abusive volume far more than a request-count limit could, and a
  // shared budget is simpler to reason about than a second policy.
  await app.register(
    fastifyRateLimit as unknown as FastifyPluginAsync<import('@fastify/rate-limit').RateLimitPluginOptions>,
    {
      max: bootConfig.RATE_LIMIT_MAX,
      timeWindow: bootConfig.RATE_LIMIT_WINDOW_MS,
      redis: app.get(RedisService).rawClient,
      skipOnError: true,
      allowList: (req: FastifyRequest) => req.url === '/health' || req.url.startsWith('/health/'),
    },
  );

  // 4. API Prefix & Versioning
  const rawPrefix = configService.apiPrefix.trim();
  if (/^[vV]\d+$/.test(rawPrefix)) {
    const versionNumber = rawPrefix.replace(/^[vV]/, '');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: versionNumber,
    });
  } else {
    app.setGlobalPrefix(rawPrefix, {
      exclude: [
        'health',
        'health/(.*)',
        'docs',
        'docs/(.*)',
        '.well-known/(.*)',
        'llms.txt',
        'agents.md',
      ],
    });
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
  }

  // 5. Global Request Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: createValidationException,
    }),
  );

  // 6. Global Exception Filter
  app.useGlobalFilters(new ApiExceptionFilter());

  // 7. Structured HTTP Logging Interceptor
  app.useGlobalInterceptors(new HttpLoggingInterceptor());

  // 8. OpenAPI / Swagger Documentation
  const swaggerDocConfig = new DocumentBuilder()
    .setTitle('Callrack API')
    .setDescription('Callrack pay-per-use information infrastructure platform API')
    .setVersion(configService.version)
    .addApiKey(
      {
        type: 'apiKey',
        name: REQUEST_ID_HEADER,
        in: 'header',
        description: 'Optional client request ID for distributed tracing',
      },
      REQUEST_ID_HEADER,
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerDocConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    jsonDocumentUrl: 'docs/json',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
    },
  });

  // 8b. Standalone OpenAPI JSON at the conventional root path AI/agent
  // tooling expects (distinct from `/docs/json`, which stays too — this
  // never replaces `/docs`). Same already-built document, no second
  // generation step.
  fastifyInstance.get('/openapi.json', async () => swaggerDocument);

  // 9. Public capability request-schema reflection for GET /v1/capabilities
  // (CapabilitiesController). Same reflection x402's Bazaar extension uses
  // (see discovery-schema.util.ts) — computed once, here, because it needs
  // the fully-built `app` that isn't available at normal constructor-
  // injection time; not a second, independent computation.
  app.get(CapabilityRequestSchemaService).initialize(buildRequestSchemaMap(app));

  return app;
}

export interface CreateProtectedAppOptions {
  /**
   * Overrides the x402 facilitator client. Used only by the dedicated x402
   * test suite to inject a deterministic in-memory facilitator instead of
   * the real, network-calling GoPlausible client — never set in production.
   * Every other test file uses plain `createApp()`, which never touches
   * x402 at all, so none of them need to know this option exists.
   */
  x402FacilitatorClient?: FacilitatorClient;
}

/**
 * Builds the same app as `createApp()`, then layers x402 payment protection
 * on top — the "x402 sits around the app" architecture from the Phase 7
 * spec. This is the ONLY function that installs x402; `createApp()` itself
 * never does, which is why every capability e2e test written before x402
 * existed keeps working unpaid and unmodified. The real server (`bootstrap`,
 * below) always calls this; only the x402-specific test suite calls it
 * directly with a mocked facilitator.
 */
export async function createProtectedApp(
  options: CreateProtectedAppOptions = {},
): Promise<NestFastifyApplication> {
  const app = await createApp();
  const x402Config = app.get(X402ConfigService);
  const capabilityRegistry = app.get(CapabilityRegistryService);
  const facilitatorClient =
    options.x402FacilitatorClient ?? buildHttpFacilitatorClient(x402Config.facilitatorUrl);

  // Fails application startup (not a customer's first request) on a broken
  // facilitator or an invalid route/scheme combination — see
  // installX402Middleware's own docs for why this is awaited here.
  await installX402Middleware(app, capabilityRegistry, x402Config, facilitatorClient);

  return app;
}

export async function bootstrap(): Promise<NestFastifyApplication> {
  const app = await createProtectedApp();
  const configService = app.get(ApiConfigService);
  const logger = new AppLoggerService();

  // Only the real production entrypoint listens for OS termination signals
  // — deliberately not enabled inside createApp()/createProtectedApp(),
  // which the test suite also calls (many times per run) and already
  // manages its own app.close() in teardown; registering process-wide
  // signal listeners there would leak/duplicate across every test file.
  // On SIGTERM/SIGINT: Fastify stops accepting new connections and lets
  // in-flight requests finish, then Nest calls onModuleDestroy on every
  // provider (DatabaseService disconnects Prisma, RedisService disconnects
  // ioredis) before the process exits — see their own onModuleDestroy.
  app.enableShutdownHooks();

  await app.listen(configService.port, '0.0.0.0');
  logger.log(`Callrack API server listening on http://0.0.0.0:${configService.port}`, 'Bootstrap');

  return app;
}
