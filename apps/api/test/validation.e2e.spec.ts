import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Body, Controller, Module, Post, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { IsInt, IsString, Min } from 'class-validator';
import { createValidationException } from '../src/common/validation/validation-exception.factory.js';
import { ApiExceptionFilter } from '../src/common/errors/api-exception.filter.js';
import { ApiErrorCode } from '../src/common/errors/api-error-codes.js';

class SampleInputDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(1)
  count!: number;
}

@Controller('test-validation')
class TestValidationController {
  @Post()
  create(@Body() body: SampleInputDto) {
    return { success: true, received: body };
  }
}

@Module({
  controllers: [TestValidationController],
})
class TestValidationModule {}

describe('Request Validation (E2E)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      TestValidationModule,
      new FastifyAdapter(),
    );

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: createValidationException,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts valid input according to DTO schema', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test-validation',
      payload: {
        name: 'sample item',
        count: 5,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.received.name).toBe('sample item');
    expect(body.received.count).toBe(5);
  });

  it('rejects missing or invalid fields with 400 VALIDATION_ERROR', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test-validation',
      payload: {
        name: 12345, // invalid type
        count: -1, // fails @Min(1)
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.code).toBe(ApiErrorCode.VALIDATION_ERROR);
    expect(body.error.message).toBe('Request validation failed.');
    expect(body.error.details.fields).toBeDefined();
    expect(body.error.details.fields.name).toBeDefined();
    expect(body.error.details.fields.count).toBeDefined();
  });

  it('rejects unexpected properties strictly (forbidNonWhitelisted)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test-validation',
      payload: {
        name: 'sample item',
        count: 5,
        maliciousExtraProperty: 'exploit',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.code).toBe(ApiErrorCode.VALIDATION_ERROR);
    expect(body.error.details.fields.maliciousExtraProperty).toBeDefined();
  });
});
