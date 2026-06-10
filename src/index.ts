// biome-ignore-all lint/performance/noBarrelFile: package root is the public SDK entrypoint.

export type {
  ClientOptions,
  EventsResource,
  MessagesResource,
  PollsResource,
  ProfileResource,
  WhatsApp,
} from "./client.ts";
export { createClient } from "./client.ts";

export {
  AuthenticationError,
  ConnectionError,
  NotFoundError,
  OperationNotSupportedError,
  RateLimitError,
  ValidationError,
  WhatsAppError,
} from "./errors/whatsapp-error.ts";

export { TypedEventStream } from "./streaming/event-stream.ts";
export type { RetryOptions, WriteOptions } from "./types/common.ts";
export { ErrorCode } from "./types/errors.ts";
export type {
  CatchUpReplay,
  EventContext,
  LiveEvent,
  MessageAttachmentEvent,
  MessageEvent,
  MessageEventContext,
  MessageReactionEvent,
  MessageReceiptChangedEvent,
  MessageTextEvent,
  PollChoicesChangedEvent,
  PollCreatedEvent,
  PollEvent,
  PollEventContext,
  PollUpdatedEvent,
  PollVoteChangedEvent,
} from "./types/events.ts";
export type {
  AlbumItem,
  ContactCard,
  Message,
  MessageAttachment,
  MessageAttachmentKind,
  MessageDeliveryStatus,
  MessageListOptions,
  MessagePage,
  MessageReaction,
  MessageStatusInfo,
  MessageText,
  RemoveMessageResult,
  SendAudioOptions,
  SendDocumentOptions,
  SendImageOptions,
  SendStickerOptions,
  SendTextOptions,
  SendVideoOptions,
  TextBlock,
  TextBlockType,
  TextContent,
  TextRun,
  TextStyle,
} from "./types/messages.ts";
export type {
  CreatePollSettings,
  Poll,
  PollChoice,
  PollWriteOptions,
} from "./types/polls.ts";
export type {
  ModifyProfileOptions,
  ProfileUpdateResult,
} from "./types/profile.ts";
