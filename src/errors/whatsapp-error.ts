import type { ErrorCode } from "../types/errors.ts";

export interface WhatsAppErrorOptions {
  readonly cause?: Error;
  readonly code: ErrorCode;
  readonly context?: Record<string, string>;
  readonly grpcCode: number;
  readonly retryable: boolean;
}

export class WhatsAppError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly grpcCode: number;
  readonly context: Record<string, string>;

  constructor(message: string, options: WhatsAppErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "WhatsAppError";
    this.code = options.code;
    this.retryable = options.retryable;
    this.grpcCode = options.grpcCode;
    this.context = options.context ?? {};
  }
}

export class AuthenticationError extends WhatsAppError {
  constructor(message: string, options: WhatsAppErrorOptions) {
    super(message, options);
    this.name = "AuthenticationError";
  }
}

export class NotFoundError extends WhatsAppError {
  constructor(message: string, options: WhatsAppErrorOptions) {
    super(message, options);
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends WhatsAppError {
  constructor(message: string, options: WhatsAppErrorOptions) {
    super(message, options);
    this.name = "RateLimitError";
  }
}

export class ValidationError extends WhatsAppError {
  constructor(message: string, options: WhatsAppErrorOptions) {
    super(message, options);
    this.name = "ValidationError";
  }
}

export class OperationNotSupportedError extends WhatsAppError {
  constructor(message: string, options: WhatsAppErrorOptions) {
    super(message, options);
    this.name = "OperationNotSupportedError";
  }
}

export class ConnectionError extends WhatsAppError {
  constructor(message: string, options: WhatsAppErrorOptions) {
    super(message, options);
    this.name = "ConnectionError";
  }
}
