import { EventsResource as EventsImpl } from "./resources/events.ts";
import { MessagesResource as MessagesImpl } from "./resources/messages.ts";
import { PollsResource as PollsImpl } from "./resources/polls.ts";
import type { TypedEventStream } from "./streaming/event-stream.ts";
import { createGrpcClients } from "./transport/grpc-client.ts";
import type { RetryOptions, WriteOptions } from "./types/common.ts";
import type { CatchUpReplay, MessageEvent, PollEvent } from "./types/events.ts";
import type {
  Message,
  MessageListOptions,
  MessagePage,
  SendImageOptions,
  SendTextOptions,
  TextContent,
} from "./types/messages.ts";
import type {
  CreatePollSettings,
  Poll,
  PollWriteOptions,
} from "./types/polls.ts";

export interface ClientOptions {
  /** gRPC server address, for example `"127.0.0.1:50051"`. */
  readonly address: string;
  /** Retries retryable unary RPC failures. Streaming RPCs are never retried automatically. */
  readonly retry?: boolean | RetryOptions;
  /** Default unary RPC timeout in milliseconds. Streaming RPCs are left open. */
  readonly timeout?: number;
  /** Use TLS for the gRPC channel. Defaults to `true`; set `false` for local development. */
  readonly tls?: boolean;
  /** Bearer token, or async function that returns a fresh bearer token per RPC. */
  readonly token?: string | (() => Promise<string>);
}

export interface MessagesResource {
  /**
   * Reads one persisted WhatsApp message snapshot by `message.messageId`.
   *
   * Messages are read from ChatStorage, not the helper.
   */
  get(messageId: string): Promise<Message>;
  /**
   * Pages through one chat's messages.
   *
   * `recipient` is phone-number digits such as `"15551234567"`.
   */
  listInChat(
    recipient: string,
    options?: MessageListOptions
  ): Promise<MessagePage>;
  /** Pages through recent messages across chats. */
  listRecent(options?: MessageListOptions): Promise<MessagePage>;
  /**
   * Reacts to an existing message and returns the reacted message snapshot after
   * the server observes the local receipt metadata change.
   *
   * `emoji` must be one emoji grapheme.
   */
  react(
    messageId: string,
    emoji: string,
    options?: WriteOptions
  ): Promise<Message>;
  /**
   * Sends an image and returns the persisted local ChatStorage snapshot observed
   * after the server sees a successful local send/upload signal.
   *
   * `image` must contain the file bytes for one image.
   */
  sendImage(
    recipient: string,
    image: Uint8Array,
    options?: SendImageOptions
  ): Promise<Message>;
  /**
   * Sends a text message and returns the persisted local ChatStorage snapshot observed
   * after the server sees a local send-success signal.
   *
   * Pass a string for plain text, or ordered text blocks for quotes, lists, and
   * inline styles.
   */
  sendText(
    recipient: string,
    content: TextContent,
    options?: SendTextOptions
  ): Promise<Message>;
  /** Streams future message events. Use `events.catchUp(...)` after reconnects. */
  subscribeEvents(filter?: {
    readonly recipient?: string;
  }): TypedEventStream<MessageEvent>;
}

export interface PollsResource {
  /**
   * Creates a WhatsApp poll and returns the persisted local poll snapshot.
   *
   * `recipient` is phone-number digits. `choices` must contain at least two
   * unique non-empty entries.
   */
  create(
    recipient: string,
    question: string,
    choices: readonly string[],
    settings?: CreatePollSettings
  ): Promise<Poll>;
  /**
   * Look up a poll by the local WhatsApp message unique key returned by create,
   * poll events, or recent DB-derived event payloads.
   */
  get(pollId: string): Promise<Poll>;
  /** Streams future poll events. Each event carries the current poll snapshot. */
  subscribeEvents(filter?: {
    readonly pollId?: string;
  }): TypedEventStream<PollEvent>;
  /** Clears this account's vote for a poll and returns the refreshed poll snapshot. */
  unvote(pollId: string, options?: PollWriteOptions): Promise<Poll>;
  /** Votes for one or more poll choice indexes and returns the refreshed poll snapshot. */
  vote(
    pollId: string,
    choiceIndexes: number | readonly number[],
    options?: PollWriteOptions
  ): Promise<Poll>;
}

export interface EventsResource {
  /**
   * Replays durable events after `since`, then resolves `headSequence` when the
   * server sends the completion frame.
   */
  catchUp(since?: number): CatchUpReplay;
}

export interface WhatsApp extends AsyncDisposable {
  /** Closes the underlying gRPC channel. */
  close(): Promise<void>;
  readonly events: EventsResource;
  readonly messages: MessagesResource;
  readonly polls: PollsResource;
}

export function createClient(options: ClientOptions): WhatsApp {
  const clients = createGrpcClients({
    address: options.address,
    retry: options.retry,
    timeout: options.timeout,
    tls: options.tls,
    token: options.token,
  });

  const messages = new MessagesImpl(clients.messages);
  const polls = new PollsImpl(clients.polls);
  const events = new EventsImpl(clients.events);

  function close(): Promise<void> {
    clients.channel.close();
    return Promise.resolve();
  }

  return {
    messages,
    polls,
    events,
    close,
    async [Symbol.asyncDispose](): Promise<void> {
      await close();
    },
  };
}
