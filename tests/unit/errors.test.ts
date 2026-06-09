import { describe, expect, test } from "bun:test";
import { Metadata, Status } from "nice-grpc-common";
import { toWhatsAppError } from "../../src/errors/to-whatsapp-error.ts";
import {
  OperationNotSupportedError,
  ValidationError,
} from "../../src/errors/whatsapp-error.ts";

describe("error mapping", () => {
  test("maps operationNotSupported failed precondition to a typed SDK error", () => {
    const metadata = new Metadata();
    metadata.set("error-code", "operationNotSupported");

    const error = toWhatsAppError({
      code: Status.FAILED_PRECONDITION,
      details: "This WhatsApp runtime cannot modify this poll",
      metadata,
    });

    expect(error).toBeInstanceOf(OperationNotSupportedError);
    expect(error.name).toBe("OperationNotSupportedError");
    expect(error.code).toBe("operationNotSupported");
    expect(error.grpcCode).toBe(Status.FAILED_PRECONDITION);
    expect(error.message).toBe("This WhatsApp runtime cannot modify this poll");
  });

  test("keeps other failed preconditions as validation errors", () => {
    const metadata = new Metadata();
    metadata.set("error-code", "invalidArgument");

    const error = toWhatsAppError({
      code: Status.FAILED_PRECONDITION,
      details: "bad state",
      metadata,
    });

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.code).toBe("invalidArgument");
  });
});
