import { toWhatsAppError } from "../errors/to-whatsapp-error.ts";
import { validationError } from "../errors/validation-error.ts";
import { MediaKind } from "../generated/whatsapp_message_service.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { MessageServiceClient } from "../transport/grpc-client.ts";
import {
  mapMessage,
  mapMessageEvent,
  mapMessagePage,
  mapMessageStatus,
  mapTextBlock,
} from "../transport/mapper.ts";
import type { WriteOptions } from "../types/common.ts";
import type { MessageEvent } from "../types/events.ts";
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

  async sendVideo(
    recipient: string,
    video: Uint8Array,
    options?: SendVideoOptions
  ): Promise<Message> {
    try {
      const response = await this._client.sendMediaMessage({
        recipient: parseRecipient(recipient),
        media: {
          kind: MediaKind.MEDIA_KIND_VIDEO,
          data: parseBytes(video, "video"),
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

  async sendAlbum(
    recipient: string,
    items: readonly AlbumItem[],
    options?: WriteOptions
  ): Promise<Message[]> {
    try {
      if (!Array.isArray(items) || items.length < 2 || items.length > 30) {
        throw validationError("items must contain 2 to 30 media entries", {
          field: "items",
        });
      }

      const kinds = new Set(items.map((item) => item.kind));
      if (kinds.size !== 1) {
        throw validationError("all album items must share the same kind", {
          field: "items",
        });
      }

      const response = await this._client.sendAlbum({
        recipient: parseRecipient(recipient),
        items: items.map((item, index) => ({
          kind: toProtoMediaKind(item.kind, index),
          data: parseBytes(item.data, `items[${index}].data`),
          caption: parseOptionalString(item.caption, `items[${index}].caption`),
          accessibilityText: parseOptionalString(
            item.accessibilityText,
            `items[${index}].accessibilityText`
          ),
        })),
        clientMessageId: parseOptionalString(
          options?.clientMessageId,
          "clientMessageId"
        ),
      });

      return response.messages.map((message) =>
        mapMessage(message as Parameters<typeof mapMessage>[0])
      );
    } catch (err) {
      throw toWhatsAppError(err);
    }
  }

  async sendDocument(
    recipient: string,
    document: Uint8Array,
    options?: SendDocumentOptions
  ): Promise<Message> {
    try {
      const response = await this._client.sendDocument({
        recipient: parseRecipient(recipient),
        data: parseBytes(document, "document"),
        fileName: parseOptionalString(options?.fileName, "fileName"),
        mimeType: parseOptionalString(options?.mimeType, "mimeType"),
        caption: parseOptionalString(options?.caption, "caption"),
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

  async sendAudio(
    recipient: string,
    audio: Uint8Array,
    options?: SendAudioOptions
  ): Promise<Message> {
    try {
      const response = await this._client.sendAudio({
        recipient: parseRecipient(recipient),
        data: parseBytes(audio, "audio"),
        mimeType: parseOptionalString(options?.mimeType, "mimeType"),
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

  async sendSticker(
    recipient: string,
    sticker: Uint8Array,
    options?: SendStickerOptions
  ): Promise<Message> {
    try {
      const response = await this._client.sendSticker({
        recipient: parseRecipient(recipient),
        data: parseBytes(sticker, "sticker"),
        emojis: (options?.emojis ?? []).map((emoji) => parseReactionEmoji(emoji)),
        accessibilityText: parseOptionalString(
          options?.accessibilityText,
          "accessibilityText"
        ),
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

  async sendContact(
    recipient: string,
    contacts: ContactCard | readonly ContactCard[],
    options?: WriteOptions
  ): Promise<Message> {
    try {
      const normalized = Array.isArray(contacts)
        ? (contacts as readonly ContactCard[])
        : [contacts as ContactCard];
      if (normalized.length === 0) {
        throw validationError("contacts must not be empty", {
          field: "contacts",
        });
      }

      const response = await this._client.sendContact({
        recipient: parseRecipient(recipient),
        contacts: normalized.map((contact, index) =>
          parseContactCard(contact, index)
        ),
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

  async edit(
    messageId: string,
    text: string,
    options?: WriteOptions
  ): Promise<Message> {
    try {
      const response = await this._client.editMessage({
        messageId: parseRequiredString(messageId, "messageId"),
        text: parseRequiredString(text, "text"),
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

  async revoke(
    messageId: string,
    options?: WriteOptions
  ): Promise<RemoveMessageResult> {
    try {
      const response = await this._client.revokeMessage({
        messageId: parseRequiredString(messageId, "messageId"),
        clientMessageId: parseOptionalString(
          options?.clientMessageId,
          "clientMessageId"
        ),
      });

      return { messageId: response.messageId, removed: response.removed };
    } catch (err) {
      throw toWhatsAppError(err);
    }
  }

  async delete(
    messageId: string,
    options?: WriteOptions
  ): Promise<RemoveMessageResult> {
    try {
      const response = await this._client.deleteMessage({
        messageId: parseRequiredString(messageId, "messageId"),
        clientMessageId: parseOptionalString(
          options?.clientMessageId,
          "clientMessageId"
        ),
      });

      return { messageId: response.messageId, removed: response.removed };
    } catch (err) {
      throw toWhatsAppError(err);
    }
  }

  async getStatus(messageId: string): Promise<MessageStatusInfo> {
    try {
      const response = await this._client.getMessageStatus({
        messageId: parseRequiredString(messageId, "messageId"),
      });

      return mapMessageStatus(response);
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

function toProtoMediaKind(kind: "image" | "video", index: number): MediaKind {
  switch (kind) {
    case "image":
      return MediaKind.MEDIA_KIND_IMAGE;
    case "video":
      return MediaKind.MEDIA_KIND_VIDEO;
    default:
      throw validationError("kind must be image or video", {
        field: `items[${index}].kind`,
      });
  }
}

function parseContactCard(contact: ContactCard, index: number) {
  const field = `contacts[${index}]`;
  const name = parseOptionalString(contact.name, `${field}.name`);
  const vcard = parseOptionalString(contact.vcard, `${field}.vcard`);
  const phones = [...(contact.phones ?? [])];
  const emails = [...(contact.emails ?? [])];
  const organization = parseOptionalString(
    contact.organization,
    `${field}.organization`
  );

  if (!(name || vcard)) {
    throw validationError("contact requires a name or a vcard", { field });
  }

  if (!vcard && phones.length === 0 && emails.length === 0 && !organization) {
    throw validationError(
      "contact requires a vcard or at least one phone/email/organization field",
      { field }
    );
  }

  return { name: name ?? "", vcard, phones, emails, organization };
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
