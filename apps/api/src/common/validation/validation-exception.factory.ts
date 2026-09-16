import { BadRequestException, type ValidationError } from '@nestjs/common';
import { ApiErrorCode } from '../errors/api-error-codes.js';

export function createValidationException(errors: ValidationError[]): BadRequestException {
  const formattedFields: Record<string, string[]> = {};

  function extractErrors(errs: ValidationError[], parentPath = '') {
    for (const err of errs) {
      const fieldPath = parentPath ? `${parentPath}.${err.property}` : err.property;
      if (err.constraints) {
        formattedFields[fieldPath] = Object.values(err.constraints);
      }
      if (err.children && err.children.length > 0) {
        extractErrors(err.children, fieldPath);
      }
    }
  }

  extractErrors(errors);

  return new BadRequestException({
    code: ApiErrorCode.VALIDATION_ERROR,
    message: 'Request validation failed.',
    details: {
      fields: formattedFields,
    },
  });
}
