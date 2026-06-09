import type { WriteOptions } from "./common.ts";

/** Inline text style supported by WhatsApp text sends. */
export type TextStyle = "bold" | "italic" | "strikethrough" | "code";

/** Layout role for one text block. */
export type TextBlockType = "normal" | "quote" | "bullet" | "numbered";

/**
 * One contiguous run of text inside a block.
 *
 * Styles apply to the whole run. Whitespace in `text` is preserved exactly.
 */
export interface TextRun {
  readonly styles?: readonly TextStyle[];
  readonly text: string;
}

/**
 * One message unit: normal text, quote, bullet item, or numbered item.
 *
 * Omit `type` for normal text. Use a string for plain block text, or runs when
 * only part of the block needs inline styling.
 */
export interface TextBlock {
  readonly text: string | readonly TextRun[];
  readonly type?: TextBlockType;
}

/**
 * Text accepted by `messages.sendText`.
 *
 * Use a string for a plain message. Use blocks for layout boundaries and inline
 * styles. Multiple blocks are rendered as separate lines or list items.
 */
export type TextContent = string | readonly TextBlock[];

export interface SendTextOptions extends WriteOptions {
  /** Ask WhatsApp to generate a rich URL preview when possible. */
  readonly enableLinkPreview?: boolean;
  /** Message id returned by this SDK to quote/reply to. */
  readonly replyTo?: string;
}

export interface SendImageOptions extends WriteOptions {
  /** Accessibility description forwarded to WhatsApp when supported. */
  readonly accessibilityText?: string;
  /** Optional image caption. */
  readonly caption?: string;
}

export interface MessageListOptions {
  /** Return messages after this message date. */
  readonly after?: Date;
  /** Return messages before this message date. */
  readonly before?: Date;
  /** Limit results to outgoing (`true`) or incoming (`false`) messages. */
  readonly isFromMe?: boolean;
  /** Number of messages per page. Must be between 1 and 100. */
  readonly pageSize?: number;
  /** Token returned by a previous page. */
  readonly pageToken?: string;
}

export interface MessagePage {
  /** Messages in newest-first order. */
  readonly messages: Message[];
  /** Pass to the next list call to continue paging. */
  readonly nextPageToken?: string;
}

export type MessageAttachmentKind =
  | "image"
  | "video"
  | "audio"
  | "voice"
  | "document"
  | "sticker"
  | "contact"
  | "location";

export interface Message {
  /** WhatsApp chat JID from ChatStorage. */
  readonly chatJid: string;
  readonly fromJid?: string;
  /** `true` when this device/account sent the message. */
  readonly isFromMe: boolean;
  /** Latest decoded reaction when ChatStorage exposes one. */
  readonly latestReaction?: MessageReaction;
  /** Media metadata for attachment messages. Bytes are not included. */
  readonly media?: MessageMedia;
  readonly messageDate: Date | null;
  readonly messageErrorStatus?: number;
  /** Local WhatsApp message unique key. Use this for replies, reactions, and lookups. */
  readonly messageId: string;
  readonly messageStatus?: number;
  readonly messageType: number;
  readonly partnerName?: string;
  readonly pushName?: string;
  readonly receiptDigest?: string;
  /** Phone-number recipient normalized by the server. */
  readonly recipient: string;
  /** Replied-to local message id when WhatsApp persisted reply linkage. */
  readonly replyToMessageId?: string;
  readonly sentDate: Date | null;
  readonly stanzaId: string;
  readonly text: string;
  readonly toJid?: string;
}

export interface MessageMedia {
  readonly cloudStatus?: number;
  readonly fileSize?: number;
  readonly kind: MessageAttachmentKind;
  readonly latitude?: number;
  readonly localPath?: string;
  readonly longitude?: number;
  readonly mediaUrl?: string;
  readonly mediaUrlDate: Date | null;
  readonly thumbnailLocalPath?: string;
  readonly title?: string;
  readonly vcardName?: string;
  readonly vcardString?: string;
  readonly xmppThumbnailPath?: string;
}

export interface MessageText {
  readonly messageId: string;
  readonly replyToMessageId?: string;
  readonly text: string;
}

export interface MessageAttachment {
  readonly caption?: string;
  readonly fileSize?: number;
  readonly kind: MessageAttachmentKind;
  readonly localPath?: string;
  readonly messageId: string;
  readonly replyToMessageId?: string;
  readonly title?: string;
}

export interface MessageReaction {
  readonly actorJid?: string;
  /** Emoji currently applied, or absent when the event represents a clear. */
  readonly emoji?: string;
  readonly messageId: string;
  readonly reactionId?: string;
}

export interface MessageReceiptUpdate {
  readonly messageId: string;
  /** Stable digest for a trusted but not yet semantically decoded receipt blob. */
  readonly receiptDigest: string;
}
