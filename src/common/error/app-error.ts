import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';

export class AppError extends Error {
  public constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly httpStatus: number = HttpStatus.BAD_REQUEST,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace?.(this, AppError);
  }
}
