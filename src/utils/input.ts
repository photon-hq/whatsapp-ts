import { validationError } from "../errors/validation-error.ts";

const asciiDigits = /^[0-9]+$/;

export function parseRecipient(value: string): string {
  const field = "recipient";
  const trimmed = parseRequiredString(value, field);

  if (!asciiDigits.test(trimmed)) {
    throw validationError(`${field} must contain digits only`, { field });
  }

  if (trimmed.length < 7) {
    throw validationError(`${field} must have at least 7 digits`, { field });
  }

  if (trimmed.length > 15) {
    throw validationError(`${field} must have at most 15 digits`, { field });
  }

  return trimmed;
}

export function parseRequiredString(value: string, field: string): string {
  if (typeof value !== "string") {
    throw validationError(`${field} must be a string`, { field });
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw validationError(`${field} must not be empty`, { field });
  }

  return trimmed;
}

export function parseOptionalString(
  value: string | undefined,
  field: string
): string | undefined {
  return value === undefined ? undefined : parseRequiredString(value, field);
}
