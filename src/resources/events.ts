import { toWhatsAppError } from "../errors/to-whatsapp-error.ts";
import { validationError } from "../errors/validation-error.ts";
import type { CatchUpEventsResponse } from "../generated/whatsapp_event_service.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { EventServiceClient } from "../transport/grpc-client.ts";
import { mapMessageEvent, mapPollEvent } from "../transport/mapper.ts";
import type { CatchUpReplay, LiveEvent } from "../types/events.ts";

function normalizeSequenceCursor(
  cursor: number | undefined,
  field: string
): number | undefined {
  if (cursor === undefined) {
    return undefined;
  }

  if (!Number.isSafeInteger(cursor) || cursor < 0) {
    throw validationError(`${field} must be a non-negative safe integer`, {
      field,
      value: String(cursor),
    });
  }

  return cursor;
}

function mapCatchUpFrame(frame: CatchUpEventsResponse): LiveEvent | undefined {
  if (frame.sequence === undefined) {
    return undefined;
  }

  if (frame.messageChanged) {
    return mapMessageEvent(frame.sequence, frame.messageChanged);
  }

  if (frame.pollChanged) {
    return mapPollEvent(frame.sequence, frame.pollChanged);
  }

  return undefined;
}

export class EventsResource {
  private readonly _client: EventServiceClient;

  constructor(client: EventServiceClient) {
    this._client = client;
  }

  catchUp(since?: number): CatchUpReplay {
    const abort = new AbortController();
    const rpcStream = this._client.catchUpEvents(
      { afterSequence: normalizeSequenceCursor(since, "since") },
      { signal: abort.signal }
    );

    const iterator = rpcStream[Symbol.asyncIterator]();
    let resolveHeadSequence: (value: number) => void;
    let rejectHeadSequence: (error: unknown) => void;
    let settled = false;
    const headSequence = new Promise<number>((resolve, reject) => {
      resolveHeadSequence = resolve;
      rejectHeadSequence = reject;
    });
    headSequence.catch(() => undefined);

    function complete(value: number): void {
      if (!settled) {
        settled = true;
        resolveHeadSequence(value);
      }
    }

    function fail(error: unknown): void {
      if (!settled) {
        settled = true;
        rejectHeadSequence(error);
      }
    }

    async function* mapEvents(): AsyncGenerator<LiveEvent> {
      try {
        for (;;) {
          const next = await iterator.next();
          if (next.done) {
            complete(since ?? 0);
            break;
          }

          const frame = next.value;
          if (frame.complete) {
            complete(frame.complete.headSequence);
            break;
          }

          const event = mapCatchUpFrame(frame);
          if (event) {
            yield event;
          }
        }
      } catch (err) {
        const error = toWhatsAppError(err);
        fail(error);
        throw error;
      }
    }

    const stream = new TypedEventStream(mapEvents(), async () => {
      abort.abort();
      fail(new Error("catchUp was closed before completion."));
      try {
        await iterator.return?.();
      } catch (err) {
        if (!settled) {
          throw err;
        }
      }
    });

    return Object.assign(stream, {
      headSequence,
    });
  }
}
