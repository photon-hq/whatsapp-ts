import { toWhatsAppError } from "../errors/to-whatsapp-error.ts";
import { validationError } from "../errors/validation-error.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { PollServiceClient } from "../transport/grpc-client.ts";
import { mapPoll, mapPollEvent } from "../transport/mapper.ts";
import type { PollEvent } from "../types/events.ts";
import type {
  CreatePollSettings,
  Poll,
  PollWriteOptions,
} from "../types/polls.ts";
import {
  parseOptionalString,
  parseRecipient,
  parseRequiredString,
} from "../utils/input.ts";
import { unwrap } from "../utils/unwrap.ts";

export class PollsResource {
  private readonly _client: PollServiceClient;

  constructor(client: PollServiceClient) {
    this._client = client;
  }

  async create(
    recipient: string,
    question: string,
    choices: readonly string[],
    settings?: CreatePollSettings
  ): Promise<Poll> {
    try {
      const response = await this._client.createPoll({
        recipient: parseRecipient(recipient),
        question: parseRequiredString(question, "question"),
        choices: parsePollChoices(choices),
        allowMultipleChoices: settings?.allowMultipleChoices ?? false,
        hideVoterNames: settings?.hideVoterNames ?? false,
        closesAt: parseFutureDate(settings?.closesAt, "closesAt"),
        clientMessageId: parseOptionalString(
          settings?.clientMessageId,
          "clientMessageId"
        ),
      });

      return mapPoll(unwrap(response.poll, "poll"));
    } catch (err) {
      throw toWhatsAppError(err);
    }
  }

  async get(pollId: string): Promise<Poll> {
    try {
      const response = await this._client.getPoll({
        pollId: parseRequiredString(pollId, "pollId"),
      });
      return mapPoll(unwrap(response.poll, "poll"));
    } catch (err) {
      throw toWhatsAppError(err);
    }
  }

  async vote(
    pollId: string,
    choiceIndexes: number | readonly number[],
    options?: PollWriteOptions
  ): Promise<Poll>;
  async vote(
    pollId: string,
    choiceIndexOrIndexes: number | readonly number[],
    options?: PollWriteOptions
  ): Promise<Poll> {
    try {
      const response = await this._client.votePoll({
        pollId: parseRequiredString(pollId, "pollId"),
        choiceIndexes: parseChoiceIndexes(choiceIndexOrIndexes),
        clientMessageId: parseOptionalString(
          options?.clientMessageId,
          "clientMessageId"
        ),
      });

      return mapPoll(unwrap(response.poll, "poll"));
    } catch (err) {
      throw toWhatsAppError(err);
    }
  }

  async unvote(pollId: string, options?: PollWriteOptions): Promise<Poll> {
    try {
      const response = await this._client.unvotePoll({
        pollId: parseRequiredString(pollId, "pollId"),
        clientMessageId: parseOptionalString(
          options?.clientMessageId,
          "clientMessageId"
        ),
      });

      return mapPoll(unwrap(response.poll, "poll"));
    } catch (err) {
      throw toWhatsAppError(err);
    }
  }

  subscribeEvents(filter?: {
    readonly pollId?: string;
  }): TypedEventStream<PollEvent> {
    const abort = new AbortController();
    const rpcStream = this._client.subscribePollEvents(
      { pollId: parseOptionalString(filter?.pollId, "pollId") },
      { signal: abort.signal }
    );

    async function* mapEvents(): AsyncGenerator<PollEvent> {
      try {
        for await (const frame of rpcStream) {
          if (frame.sequence === undefined || !frame.pollChanged) {
            continue;
          }

          const event = mapPollEvent(frame.sequence, frame.pollChanged);
          if (event) {
            yield event;
          }
        }
      } catch (err) {
        throw toWhatsAppError(err);
      }
    }

    return new TypedEventStream(mapEvents(), async () => abort.abort());
  }
}

function parsePollChoices(value: readonly string[]): string[] {
  if (!Array.isArray(value)) {
    throw validationError("choices must be an array", { field: "choices" });
  }

  const choices = value.map((choice, index) =>
    parseRequiredString(choice, `choices[${index}]`)
  );

  if (choices.length < 2) {
    throw validationError("choices must contain at least two entries", {
      field: "choices",
    });
  }

  if (new Set(choices).size !== choices.length) {
    throw validationError("choices must not contain duplicates", {
      field: "choices",
    });
  }

  return choices;
}

function parseChoiceIndexes(value: number | readonly number[]): number[] {
  const indexes = typeof value === "number" ? [value] : value;

  if (!Array.isArray(indexes)) {
    throw validationError("choiceIndexes must be a number or an array", {
      field: "choiceIndexes",
    });
  }

  if (indexes.length === 0) {
    throw validationError("choiceIndexes must not be empty", {
      field: "choiceIndexes",
    });
  }

  for (const [index, choiceIndex] of indexes.entries()) {
    if (!Number.isSafeInteger(choiceIndex) || choiceIndex < 0) {
      throw validationError(
        "choiceIndexes must contain non-negative integers",
        {
          field: `choiceIndexes[${index}]`,
        }
      );
    }
  }

  if (new Set(indexes).size !== indexes.length) {
    throw validationError("choiceIndexes must not contain duplicates", {
      field: "choiceIndexes",
    });
  }

  return [...indexes];
}

function parseFutureDate(
  value: Date | undefined,
  field: string
): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw validationError(`${field} must be a valid Date`, { field });
  }

  if (value.getTime() <= Date.now()) {
    throw validationError(`${field} must be in the future`, { field });
  }

  return value;
}
