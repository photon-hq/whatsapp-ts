import { EventsResource as EventsImpl } from "./resources/events.ts";
import { MessagesResource as MessagesImpl } from "./resources/messages.ts";
import { PollsResource as PollsImpl } from "./resources/polls.ts";
import { ProfileResource as ProfileImpl } from "./resources/profile.ts";
import type { TypedEventStream } from "./streaming/event-stream.ts";
import { createGrpcClients } from "./transport/grpc-client.ts";
import type { RetryOptions, WriteOptions } from "./types/common.ts";
import type { CatchUpReplay, MessageEvent, PollEvent } from "./types/events.ts";
import type {
  AlbumItem,
  ContactCard,
  Message,
  MessageListOptions,
  MessagePage,
  MessageStatusInfo,
  RemoveMessageResult,
  SendAudioOptions,
  SendDocumentOptions,
  SendImageOptions,
  SendStickerOptions,
  SendTextOptions,
  SendVideoOptions,
  TextContent,
} from "./types/messages.ts";
import type {
  CreatePollSettings,
  Poll,
  PollWriteOptions,
} from "./types/polls.ts";
import type {
  ModifyProfileOptions,
  ProfileUpdateResult,
} from "./types/profile.ts";

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
   * Deletes a message locally ("delete for me"). The message stays on the
   * recipient's device. Resolves once the local row is gone.
   */
  delete(
    messageId: string,
    options?: WriteOptions
  ): Promise<RemoveMessageResult>;
  /**
   * Edits one of this account's outgoing text messages and returns the updated
   * snapshot once ChatStorage reflects the new text.
   *
   * WhatsApp only allows edits within its send window (roughly 15 minutes).
   */
  edit(
    messageId: string,
    text: string,
    options?: WriteOptions
  ): Promise<Message>;
  /**
   * Reads WhatsApp's own computed delivery status for one message.
   *
   * Point-in-time read; poll again to observe transitions.
   */
  getStatus(messageId: string): Promise<MessageStatusInfo>;
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
   * Revokes one of this account's outgoing messages for everyone
   * ("delete for everyone"). Resolves once the local row is gone.
   *
   * WhatsApp's server-side revoke window (roughly two days) still applies.
   */
  revoke(
    messageId: string,
    options?: WriteOptions
  ): Promise<RemoveMessageResult>;
  /**
   * Sends 2 to 30 same-kind media items as one album and returns the persisted
   * snapshots, oldest first. WhatsApp groups them into a native album bubble
   * when album sending is enabled for the account.
   */
  sendAlbum(
    recipient: string,
    items: readonly AlbumItem[],
    options?: WriteOptions
  ): Promise<Message[]>;
  /**
   * Sends a voice-note audio message and returns the persisted local ChatStorage
   * snapshot observed after the server sees a successful local send/upload signal.
   *
   * `audio` must contain the file bytes for one decodable audio file.
   */
  sendAudio(
    recipient: string,
    audio: Uint8Array,
    options?: SendAudioOptions
  ): Promise<Message>;
  /**
   * Sends one or more contact cards and returns the persisted local ChatStorage
   * snapshot observed after the server sees a successful local send signal.
   */
  sendContact(
    recipient: string,
    contacts: ContactCard | readonly ContactCard[],
    options?: WriteOptions
  ): Promise<Message>;
  /**
   * Sends a document attachment and returns the persisted local ChatStorage
   * snapshot observed after the server sees a successful local send/upload signal.
   *
   * `document` must contain the file bytes for one document.
   */
  sendDocument(
    recipient: string,
    document: Uint8Array,
    options?: SendDocumentOptions
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
   * Sends a sticker and returns the persisted local ChatStorage snapshot observed
   * after the server sees a successful local send/upload signal.
   *
   * `sticker` must contain image bytes; WhatsApp converts them to WebP.
   */
  sendSticker(
    recipient: string,
    sticker: Uint8Array,
    options?: SendStickerOptions
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
  /**
   * Sends a video and returns the persisted local ChatStorage snapshot observed
   * after the server sees a successful local send/upload signal.
   *
   * `video` must contain the file bytes for one video.
   */
  sendVideo(
    recipient: string,
    video: Uint8Array,
    options?: SendVideoOptions
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

export interface ProfileResource {
  /**
   * Updates the current account's push name, about text, and/or avatar.
   * At least one field is required. Returns which fields were applied.
   */
  modify(options: ModifyProfileOptions): Promise<ProfileUpdateResult>;
}

export interface WhatsApp extends AsyncDisposable {
  /** Closes the underlying gRPC channel. */
  close(): Promise<void>;
  readonly events: EventsResource;
  readonly messages: MessagesResource;
  readonly polls: PollsResource;
  readonly profile: ProfileResource;
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
  const profile = new ProfileImpl(clients.profile);

  function close(): Promise<void> {
    clients.channel.close();
    return Promise.resolve();
  }

  return {
    messages,
    polls,
    events,
    profile,
    close,
    async [Symbol.asyncDispose](): Promise<void> {
      await close();
    },
  };
}
