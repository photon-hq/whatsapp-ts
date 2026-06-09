import { toWhatsAppError } from "../errors/to-whatsapp-error.ts";
import { validationError } from "../errors/validation-error.ts";
import { MediaKind } from "../generated/whatsapp_message_service.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { MessageServiceClient } from "../transport/grpc-client.ts";
import {
  mapMessage,
  mapMessageEvent,
  mapMessagePage,
  mapTextBlock,
} from "../transport/mapper.ts";
import type { WriteOptions } from "../types/common.ts";
import type { MessageEvent } from "../types/events.ts";
import type {
  Message,
  MessageListOptions,
  MessagePage,
  SendImageOptions,
  SendTextOptions,
  TextContent,
} from "../types/messages.ts";
import {
  parseOptionalString,
  parseRecipient,
  parseRequiredString,
} from "../utils/input.ts";
import { parseTextContent } from "../utils/text-content.ts";

const emojiSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});
const EXTENDED_PICTOGRAPHIC_PATTERN = /\p{Extended_Pictographic}/u;
const EMOJI_PRESENTATION_PATTERN = /\p{Emoji_Presentation}/u;
const REGIONAL_INDICATOR_PAIR_PATTERN = /^\p{Regional_Indicator}{2}$/u;
const KEYCAP_EMOJI_PATTERN = /^[0-9#*]\uFE0F?\u20E3$/u;

export class MessagesResource {
  private readonly _client: MessageServiceClient;

  constructor(client: MessageServiceClient) {
    this._client = client;
  }

  async sendText(
    recipient: string,
    content: TextContent,
    options?: SendTextOptions
  ): Promise<Message> {
    try {
      const parsedRecipient = parseRecipient(recipient);
      const normalizedContent = parseTextContent(content);
      const response = await this._client.sendTextMessage({
        recipient: parsedRecipient,
        content: normalizedContent.map(mapTextBlock),
        replyTo: parseOptionalString(options?.replyTo, "replyTo"),
        enableLinkPreview: options?.enableLinkPreview ?? false,
        clientMessageId: parseOptionalString(
          options?.clientMessageId,
          "clientMessageId"
        ),
      });

      return mapMessageResponse(response);
    } catch (err) {
      throw toWhatsAppError(err);
    }
  }

  async sendImage(
    recipient: string,
    image: Uint8Array,
    options?: SendImageOptions
  ): Promise<Message> {
    try {
      const response = await this._client.sendMediaMessage({
        recipient: parseRecipient(recipient),
        media: {
          kind: MediaKind.MEDIA_KIND_IMAGE,
          data: parseBytes(image, "image"),
          caption: parseOptionalString(options?.caption, "caption"),
          accessibilityText: parseOptionalString(
            options?.accessibilityText,
            "accessibilityText"
          ),
        },
        clientMessageId: parseOptionalString(
          options?.clientMessageId,
          "clientMessageId"
        ),
      });

      return mapMessageResponse(response);
    } catch (err) {
      throw toWhatsAppError(err);
    }
  }

  async react(
    messageId: string,
    emoji: string,
    options?: WriteOptions
  ): Promise<Message> {
    try {
      const response = await this._client.sendReaction({
        messageId: parseRequiredString(messageId, "messageId"),
        emoji: parseReactionEmoji(emoji),
        clientMessageId: parseOptionalString(
          options?.clientMessageId,
          "clientMessageId"
        ),
      });

      return mapMessageResponse(response);
    } catch (err) {
      throw toWhatsAppError(err);
    }
  }

  async get(messageId: string): Promise<Message> {
    try {
      const response = await this._client.getMessage({
        messageId: parseRequiredString(messageId, "messageId"),
      });

      return mapMessageResponse(response);
    } catch (err) {
      throw toWhatsAppError(err);
    }
  }

  async listRecent(options?: MessageListOptions): Promise<MessagePage> {
    try {
      const response = await this._client.listRecentMessages(
        mapMessageListOptions(options)
      );

      return mapMessagePage(response);
    } catch (err) {
      throw toWhatsAppError(err);
    }
  }

  async listInChat(
    recipient: string,
    options?: MessageListOptions
  ): Promise<MessagePage> {
    try {
      const response = await this._client.listChatMessages({
        recipient: parseRecipient(recipient),
        ...mapMessageListOptions(options),
      });

      return mapMessagePage(response);
    } catch (err) {
      throw toWhatsAppError(err);
    }
  }

  subscribeEvents(filter?: {
    readonly recipient?: string;
  }): TypedEventStream<MessageEvent> {
    const abort = new AbortController();
    const rpcStream = this._client.subscribeMessageEvents(
      { recipient: parseOptionalRecipient(filter?.recipient) },
      { signal: abort.signal }
    );

    async function* mapEvents(): AsyncGenerator<MessageEvent> {
      try {
        for await (const frame of rpcStream) {
          if (frame.sequence === undefined || !frame.messageChanged) {
            continue;
          }

          const event = mapMessageEvent(frame.sequence, frame.messageChanged);
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

function mapMessageResponse(response: { readonly message?: unknown }): Message {
  if (!response.message) {
    throw new Error(
      "Message response did not include a persisted message snapshot."
    );
  }

  return mapMessage(response.message as Parameters<typeof mapMessage>[0]);
}

function parseBytes(value: Uint8Array, field: string): Uint8Array {
  if (!(value instanceof Uint8Array)) {
    throw validationError(`${field} must be a Uint8Array`, { field });
  }

  if (value.byteLength === 0) {
    throw validationError(`${field} must not be empty`, { field });
  }

  return value;
}

function mapMessageListOptions(options: MessageListOptions | undefined) {
  return {
    pageSize: parsePageSize(options?.pageSize),
    pageToken: parseOptionalString(options?.pageToken, "pageToken"),
    isFromMe: options?.isFromMe,
    before: parseOptionalDate(options?.before, "before"),
    after: parseOptionalDate(options?.after, "after"),
  };
}

function parseOptionalRecipient(value: string | undefined): string | undefined {
  return value === undefined ? undefined : parseRecipient(value);
}

function parsePageSize(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw validationError("pageSize must be an integer between 1 and 100", {
      field: "pageSize",
    });
  }

  return value;
}

function parseOptionalDate(
  value: Date | undefined,
  field: string
): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw validationError(`${field} must be a valid Date`, { field });
  }

  return value;
}

function parseReactionEmoji(value: string): string {
  const emoji = parseRequiredString(value, "emoji");
  const segments = [...emojiSegmenter.segment(emoji)];
  if (segments.length !== 1 || !isEmojiGrapheme(emoji)) {
    throw validationError("emoji must be a single emoji", {
      field: "emoji",
    });
  }

  return emoji;
}

function isEmojiGrapheme(value: string): boolean {
  return (
    EXTENDED_PICTOGRAPHIC_PATTERN.test(value) ||
    EMOJI_PRESENTATION_PATTERN.test(value) ||
    REGIONAL_INDICATOR_PAIR_PATTERN.test(value) ||
    KEYCAP_EMOJI_PATTERN.test(value)
  );
}
