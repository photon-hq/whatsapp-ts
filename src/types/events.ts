import type { TypedEventStream } from "../streaming/event-stream.ts";
import type { MessageAttachment, MessageReaction } from "./messages.ts";
import type { Poll } from "./polls.ts";

export interface EventContext {
  /** When WhatsApp says the change happened, or `null` when unavailable. */
  readonly occurredAt: Date | null;
  /** Server event-log sequence. Persist it after handling an event. */
  readonly sequence: number;
}

export interface MessageEventContext extends EventContext {
  /** `true` when this device/account sent the message. */
  readonly isFromMe: boolean;
  /** Local WhatsApp message unique key. */
  readonly messageId: string;
  /** Phone-number recipient normalized by the server. */
  readonly recipient: string;
}

export interface MessageTextEvent extends MessageEventContext {
  readonly replyToMessageId?: string;
  readonly text: string;
  readonly type: "message.text";
}

export interface MessageAttachmentEvent extends MessageEventContext {
  readonly attachment: MessageAttachment;
  readonly type: "message.attachment";
}

export interface MessageReactionEvent extends MessageEventContext {
  readonly reaction: MessageReaction;
  readonly type: "message.reaction";
}

export interface MessageReceiptChangedEvent extends MessageEventContext {
  readonly receiptDigest: string;
  readonly type: "message.receiptChanged";
}

export type MessageEvent =
  | MessageTextEvent
  | MessageAttachmentEvent
  | MessageReactionEvent
  | MessageReceiptChangedEvent;

export interface PollEventContext extends EventContext {
  /** `true` when this device/account created or mutated the poll. */
  readonly isFromMe: boolean;
  /** Phone-number recipient normalized by the server. */
  readonly recipient: string;
}

export interface PollCreatedEvent extends PollEventContext {
  readonly poll: Poll;
  readonly type: "poll.created";
}

export interface PollUpdatedEvent extends PollEventContext {
  readonly poll: Poll;
  readonly type: "poll.updated";
}

export interface PollVoteChangedEvent extends PollEventContext {
  readonly poll: Poll;
  readonly type: "poll.voteChanged";
}

export interface PollChoicesChangedEvent extends PollEventContext {
  readonly poll: Poll;
  readonly type: "poll.choicesChanged";
}

export type PollEvent =
  | PollCreatedEvent
  | PollUpdatedEvent
  | PollVoteChangedEvent
  | PollChoicesChangedEvent;

export interface CatchUpReplay extends TypedEventStream<LiveEvent> {
  /** Server head sequence reached by this replay. Resolves after completion. */
  readonly headSequence: Promise<number>;
}

export type LiveEvent = MessageEvent | PollEvent;
