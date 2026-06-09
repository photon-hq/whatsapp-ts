import { ClientError, Status } from "nice-grpc-common";
import type { ErrorCode } from "../types/errors.ts";
import {
  readMetadataPrefixedEntries,
  readMetadataValue,
} from "../utils/grpc-metadata.ts";
import {
  AuthenticationError,
  ConnectionError,
  NotFoundError,
  OperationNotSupportedError,
  RateLimitError,
  ValidationError,
  WhatsAppError,
  type WhatsAppErrorOptions,
} from "./whatsapp-error.ts";

export function toWhatsAppError(error: unknown): WhatsAppError {
  if (error instanceof WhatsAppError) {
    return error;
  }

  const isClientError = error instanceof ClientError;
  let grpcCode = Status.UNKNOWN;
  if (isClientError) {
    grpcCode = error.code;
  } else if (typeof (error as { code?: unknown }).code === "number") {
    grpcCode = (error as { code: number }).code;
  }

  let details: string;
  if (isClientError) {
    details = error.details;
  } else if (typeof (error as { details?: unknown }).details === "string") {
    details = (error as { details: string }).details;
  } else if (error instanceof Error) {
    details = error.message;
  } else {
    details = String(error);
  }

  const code =
    (readMetadataValue(error, "error-code") as ErrorCode | undefined) ??
    ("internalError" as ErrorCode);
  const retryable = readMetadataValue(error, "x-retryable") === "true";
  const context = readMetadataPrefixedEntries(error, "error-context-");
  const cause = error instanceof Error ? error : undefined;

  const options: WhatsAppErrorOptions = {
    code,
    context,
    retryable,
    grpcCode,
    cause,
  };

  switch (grpcCode) {
    case Status.UNAUTHENTICATED:
    case Status.PERMISSION_DENIED:
      return new AuthenticationError(details, options);

    case Status.NOT_FOUND:
      return new NotFoundError(details, options);

    case Status.RESOURCE_EXHAUSTED:
      return new RateLimitError(details, options);

    case Status.INVALID_ARGUMENT:
      return new ValidationError(details, options);

    case Status.FAILED_PRECONDITION:
      return code === "operationNotSupported"
        ? new OperationNotSupportedError(details, options)
        : new ValidationError(details, options);

    case Status.UNAVAILABLE:
    case Status.DEADLINE_EXCEEDED:
      return new ConnectionError(details, options);

    default:
      return new WhatsAppError(details, options);
  }
}
