import { Status } from "nice-grpc-common";
import { ValidationError } from "./whatsapp-error.ts";

export function validationError(
  message: string,
  context: Record<string, string> = {}
): ValidationError {
  return new ValidationError(message, {
    code: "invalidArgument",
    context,
    grpcCode: Status.INVALID_ARGUMENT,
    retryable: false,
  });
}
