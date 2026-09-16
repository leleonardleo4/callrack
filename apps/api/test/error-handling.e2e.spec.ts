import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ApiExceptionFilter } from '../src/common/errors/api-exception.filter.js';
import { ApiErrorCode } from '../src/common/errors/api-error-codes.js';
import { createApp } from '../src/bootstrap.js';

@Controller('test-errors')
class TestErrorController {
  @Get('crash')
  crash(): void {
    throw new Error('Unexpected catastrophic failure');
  }
}

@Module({
  controllers: [TestErrorController],
})
class TestErrorModule {}

describe('Error Handling (E2E)', () => {
  let mainApp: NestFastifyApplication;
  let crashApp: NestFastifyApplication;

  beforeAll(async () => {
    mainApp = await createApp();
    await mainApp.init();
    await mainApp.getHttpAdapter().getInstance().ready();

    crashApp = await NestFactory.create<NestFastifyApplication>(
      TestErrorModule,
      new FastifyAdapter(),
    );
    crashApp.useGlobalFilters(new ApiExceptionFilter());
    await crashApp.init();
    await crashApp.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await mainApp.close();
    await crashApp.close();
  });

  it('maps unhandled routes (404) to predictable error structure', async () => {
    const response = await mainApp.inject({
      method: 'GET',
      url: '/v1/unknown-route-12345',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.payload);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe(ApiErrorCode.NOT_FOUND);
    expect(body.meta).toBeDefined();
    expect(body.meta.requestId).toBeDefined();
  });

  it('maps unhandled server exception to 500 INTERNAL_SERVER_ERROR', async () => {
    const response = await crashApp.inject({
      method: 'GET',
      url: '/test-errors/crash',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.payload);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe(ApiErrorCode.INTERNAL_SERVER_ERROR);
    expect(body.meta.requestId).toBeDefined();
  });
});
