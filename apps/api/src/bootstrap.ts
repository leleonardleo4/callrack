import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';

import { AppModule } from './app/app.module.js';
import { ApiConfigService } from './config/api-config.service.js';
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

import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction,
} from 'fastify';

export async function createApp(): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    requestIdHeader: REQUEST_ID_HEADER,
    genReqId: (req: { headers: Record<string, string | string[] | undefined> }) => {
      const incoming = req?.headers?.[REQUEST_ID_HEADER];
      return resolveRequestId(incoming);
    },
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
  await app.register(
    fastifyCors as unknown as FastifyPluginAsync<import('@fastify/cors').FastifyCorsOptions>,
    {
      origin: configService.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', REQUEST_ID_HEADER],
      exposedHeaders: [REQUEST_ID_RESPONSE_HEADER],
      credentials: true,
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
      exclude: ['health', 'health/(.*)', 'docs', 'docs/(.*)'],
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

  return app;
}

export async function bootstrap(): Promise<NestFastifyApplication> {
  const app = await createApp();
  const configService = app.get(ApiConfigService);
  const logger = new AppLoggerService();

  await app.listen(configService.port, '0.0.0.0');
  logger.log(`Callrack API server listening on http://0.0.0.0:${configService.port}`, 'Bootstrap');

  return app;
}
