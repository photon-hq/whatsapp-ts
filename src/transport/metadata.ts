import {
  type CallOptions,
  type ClientMiddleware,
  Metadata,
} from "nice-grpc-common";
import type { RetryOptions } from "../types/common.ts";
import { readMetadataValue } from "../utils/grpc-metadata.ts";
import { DEFAULT_RETRY_OPTIONS } from "../utils/retry.ts";
import { sleep } from "../utils/sleep.ts";

export function authMiddleware(
  token: string | (() => Promise<string>)
): ClientMiddleware {
  return async function* authMw(call, options) {
    const resolvedToken = typeof token === "function" ? await token() : token;

    const metadata = Metadata(options.metadata);
    metadata.set("authorization", `Bearer ${resolvedToken}`);

    const nextOptions: CallOptions = {
      ...options,
      metadata,
    };

    return yield* call.next(call.request, nextOptions);
  };
}

export function retryMiddleware(opts: RetryOptions = {}): ClientMiddleware {
  const maxAttempts = Math.max(
    1,
    opts.maxAttempts ?? DEFAULT_RETRY_OPTIONS.maxAttempts
  );
  const initialDelay = opts.initialDelay ?? DEFAULT_RETRY_OPTIONS.initialDelay;
  const maxDelay = opts.maxDelay ?? DEFAULT_RETRY_OPTIONS.maxDelay;

  return async function* retryMw(call, options) {
    if (call.method.responseStream || call.method.requestStream) {
      return yield* call.next(call.request, options);
    }

    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return yield* call.next(call.request, options);
      } catch (error: unknown) {
        lastError = error;

        const retryable = readMetadataValue(error, "x-retryable") === "true";
        if (!retryable || attempt >= maxAttempts - 1) {
          throw error;
        }

        const exponentialDelay = initialDelay * 2 ** attempt;
        const cappedDelay = Math.min(exponentialDelay, maxDelay);
        await sleep(Math.random() * cappedDelay, options.signal);

        if (options.signal?.aborted) {
          throw error;
        }
      }
    }

    throw lastError;
  };
}

export function trailingMetadataCaptureMiddleware(): ClientMiddleware {
  return async function* trailingMetadataCaptureMw(call, options) {
    let trailer: unknown;

    try {
      return yield* call.next(call.request, {
        ...options,
        onTrailer(t) {
          trailer = t;
          options.onTrailer?.(t);
        },
      });
    } catch (error) {
      await Promise.resolve();

      if (trailer && error instanceof Error) {
        Object.defineProperty(error, "metadata", {
          value: trailer,
          writable: true,
          configurable: true,
        });
      }

      throw error;
    }
  };
}

export function timeoutMiddleware(timeoutMs: number): ClientMiddleware {
  return async function* timeoutMw(call, options) {
    if (call.method.responseStream || call.method.requestStream) {
      return yield* call.next(call.request, options);
    }

    if (options.signal) {
      return yield* call.next(call.request, {
        ...options,
        signal: AbortSignal.any([
          options.signal,
          AbortSignal.timeout(timeoutMs),
        ]),
      });
    }

    return yield* call.next(call.request, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    });
  };
}
