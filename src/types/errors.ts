export const ErrorCode = {
  duplicateMessage: "duplicateMessage",
  invalidArgument: "invalidArgument",
  preconditionFailed: "preconditionFailed",
  operationNotSupported: "operationNotSupported",
  pollNotFound: "pollNotFound",
  serviceUnavailable: "serviceUnavailable",
  timeout: "timeout",
  internalError: "internalError",
  databaseError: "databaseError",
  networkError: "networkError",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
