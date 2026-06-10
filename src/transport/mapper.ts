import {
  type Message as ProtoMessage,
  type MessageAttachment as ProtoMessageAttachment,
  MessageAttachmentKind as ProtoMessageAttachmentKind,
  type MessageChangeEvent as ProtoMessageChangeEvent,
  type MessageMedia as ProtoMessageMedia,
  type MessageReaction as ProtoMessageReaction,
  type MessageReceiptUpdate as ProtoMessageReceiptUpdate,
  type MessageText as ProtoMessageText,
  type TextBlock as ProtoTextBlock,
  TextBlockType as ProtoTextBlockType,
  type TextRun as ProtoTextRun,
  TextStyle as ProtoTextStyle,
} from "../generated/whatsapp_message_types.ts";
import type {
  Poll as ProtoPoll,
  PollChangeEvent as ProtoPollChangeEvent,
  PollChoice as ProtoPollChoice,
} from "../generated/whatsapp_poll_types.ts";
import { MessageDeliveryStatus as ProtoMessageDeliveryStatus } from "../generated/whatsapp_message_service.ts";
import type { MessageEvent, PollEvent } from "../types/events.ts";
import type {
  Message,
  MessageAttachment,
  MessageAttachmentKind,
  MessageDeliveryStatus,
  MessageMedia,
  MessageStatusInfo,
  MessagePage,
  MessageReaction,
  MessageReceiptUpdate,
  MessageText,
  TextBlockType,
  TextStyle,
} from "../types/messages.ts";
import type { Poll, PollChoice } from "../types/polls.ts";
import type {
  NormalizedTextBlock,
  NormalizedTextRun,
} from "../utils/text-content.ts";

export function mapMessageStatus(response: {
  readonly messageId: string;
  readonly status: ProtoMessageDeliveryStatus;
  readonly statusCode: number;
  readonly isFromMe: boolean;
  readonly isSent: boolean;
  readonly isError: boolean;
  readonly isPlayed: boolean;
  readonly text: string;
}): MessageStatusInfo {
  return {
    messageId: response.messageId,
    status: toDeliveryStatus(response.status),
    statusCode: response.statusCode,
    isFromMe: response.isFromMe,
    isSent: response.isSent,
    isError: response.isError,
    isPlayed: response.isPlayed,
    text: response.text,
  };
}

function toDeliveryStatus(
  status: ProtoMessageDeliveryStatus
): MessageDeliveryStatus {
  switch (status) {
    case ProtoMessageDeliveryStatus.MESSAGE_DELIVERY_STATUS_PENDING:
      return "pending";
    case ProtoMessageDeliveryStatus.MESSAGE_DELIVERY_STATUS_SENT:
      return "sent";
    case ProtoMessageDeliveryStatus.MESSAGE_DELIVERY_STATUS_DELIVERED:
      return "delivered";
    case ProtoMessageDeliveryStatus.MESSAGE_DELIVERY_STATUS_READ:
      return "read";
    case ProtoMessageDeliveryStatus.MESSAGE_DELIVERY_STATUS_PLAYED:
      return "played";
    case ProtoMessageDeliveryStatus.MESSAGE_DELIVERY_STATUS_ERROR:
      return "error";
    default:
      return "unknown";
  }
}

export function mapTextBlock(input: NormalizedTextBlock): ProtoTextBlock {
  return {
    type: toProtoTextBlockType(input.type),
    text: input.text.map(mapTextRun),
  };
}

function mapTextRun(input: NormalizedTextRun): ProtoTextRun {
  return {
    text: input.text,
    styles: input.styles.map(toProtoTextStyle),
  };
}

function toProtoTextBlockType(type: TextBlockType): ProtoTextBlockType {
  switch (type) {
    case "normal":
      return ProtoTextBlockType.TEXT_BLOCK_TYPE_NORMAL;
    case "quote":
      return ProtoTextBlockType.TEXT_BLOCK_TYPE_QUOTE;
    case "bullet":
      return ProtoTextBlockType.TEXT_BLOCK_TYPE_BULLET;
    case "numbered":
      return ProtoTextBlockType.TEXT_BLOCK_TYPE_NUMBERED;
    default:
      throw new Error(`Unsupported text block type: ${String(type)}`);
  }
}

function toProtoTextStyle(type: TextStyle): ProtoTextStyle {
  switch (type) {
    case "bold":
      return ProtoTextStyle.TEXT_STYLE_BOLD;
    case "italic":
      return ProtoTextStyle.TEXT_STYLE_ITALIC;
    case "strikethrough":
      return ProtoTextStyle.TEXT_STYLE_STRIKETHROUGH;
    case "code":
      return ProtoTextStyle.TEXT_STYLE_CODE;
    default:
      throw new Error(`Unsupported text style: ${String(type)}`);
  }
}

export function mapMessage(proto: ProtoMessage): Message {
  return {
    messageId: proto.messageId,
    recipient: proto.recipient,
    chatJid: proto.chatJid,
    partnerName: proto.partnerName,
    stanzaId: proto.stanzaId,
    isFromMe: proto.isFromMe,
    latestReaction: proto.latestReaction
      ? mapMessageReaction(proto.latestReaction)
      : undefined,
    messageType: proto.messageType,
    messageStatus: proto.messageStatus,
    messageErrorStatus: proto.messageErrorStatus,
    messageDate: proto.messageDate ?? null,
    sentDate: proto.sentDate ?? null,
    text: proto.text,
    fromJid: proto.fromJid,
    toJid: proto.toJid,
    pushName: proto.pushName,
    receiptDigest: proto.receiptDigest,
    replyToMessageId: proto.replyToMessageId,
    media: proto.media ? mapMessageMedia(proto.media) : undefined,
  };
}

export function mapMessagePage(proto: {
  readonly messages: readonly ProtoMessage[];
  readonly nextPageToken?: string;
}): MessagePage {
  return {
    messages: proto.messages.map(mapMessage),
    nextPageToken: proto.nextPageToken,
  };
}

function mapMessageMedia(proto: ProtoMessageMedia): MessageMedia {
  return {
    kind: mapAttachmentKind(proto.kind),
    title: proto.title,
    localPath: proto.localPath,
    mediaUrl: proto.mediaUrl,
    fileSize: proto.fileSize,
    vcardName: proto.vcardName,
    vcardString: proto.vcardString,
    latitude: proto.latitude,
    longitude: proto.longitude,
    thumbnailLocalPath: proto.thumbnailLocalPath,
    xmppThumbnailPath: proto.xmppThumbnailPath,
    mediaUrlDate: proto.mediaUrlDate ?? null,
    cloudStatus: proto.cloudStatus,
  };
}

export function mapMessageText(proto: ProtoMessageText): MessageText {
  return {
    messageId: proto.messageId,
    text: proto.text,
    replyToMessageId: proto.replyToMessageId,
  };
}

export function mapMessageAttachment(
  proto: ProtoMessageAttachment
): MessageAttachment {
  return {
    messageId: proto.messageId,
    kind: mapAttachmentKind(proto.kind),
    caption: proto.caption,
    localPath: proto.localPath,
    fileSize: proto.fileSize,
    title: proto.title,
    replyToMessageId: proto.replyToMessageId,
  };
}

export function mapMessageReaction(
  proto: ProtoMessageReaction
): MessageReaction {
  return {
    messageId: proto.messageId,
    emoji: proto.emoji,
    actorJid: proto.actorJid,
    reactionId: proto.reactionId,
  };
}

export function mapMessageReceiptUpdate(
  proto: ProtoMessageReceiptUpdate
): MessageReceiptUpdate {
  return {
    messageId: proto.messageId,
    receiptDigest: proto.receiptDigest,
  };
}

function mapAttachmentKind(
  proto: ProtoMessageAttachmentKind
): MessageAttachmentKind {
  switch (proto) {
    case ProtoMessageAttachmentKind.MESSAGE_ATTACHMENT_KIND_IMAGE:
      return "image";
    case ProtoMessageAttachmentKind.MESSAGE_ATTACHMENT_KIND_VIDEO:
      return "video";
    case ProtoMessageAttachmentKind.MESSAGE_ATTACHMENT_KIND_AUDIO:
      return "audio";
    case ProtoMessageAttachmentKind.MESSAGE_ATTACHMENT_KIND_VOICE:
      return "voice";
    case ProtoMessageAttachmentKind.MESSAGE_ATTACHMENT_KIND_STICKER:
      return "sticker";
    case ProtoMessageAttachmentKind.MESSAGE_ATTACHMENT_KIND_CONTACT:
      return "contact";
    case ProtoMessageAttachmentKind.MESSAGE_ATTACHMENT_KIND_LOCATION:
      return "location";
    case ProtoMessageAttachmentKind.MESSAGE_ATTACHMENT_KIND_DOCUMENT:
    case ProtoMessageAttachmentKind.MESSAGE_ATTACHMENT_KIND_UNKNOWN:
    case ProtoMessageAttachmentKind.UNRECOGNIZED:
      return "document";
    default:
      return "document";
  }
}

export function mapPoll(proto: ProtoPoll): Poll {
  return {
    pollId: proto.pollId,
    question: proto.question,
    choices: proto.choices.map(mapPollChoice),
    allowMultipleChoices: proto.allowMultipleChoices,
    hideVoterNames: proto.hideVoterNames,
  };
}

function mapPollChoice(proto: ProtoPollChoice): PollChoice {
  return {
    index: proto.index,
    text: proto.text,
    voteCount: proto.voteCount,
  };
}

export function mapMessageEvent(
  sequence: number,
  proto: ProtoMessageChangeEvent
): MessageEvent | undefined {
  const occurredAt = proto.occurredAt ?? null;

  if (proto.text) {
    const text = mapMessageText(proto.text);
    return {
      type: "message.text",
      sequence,
      occurredAt,
      recipient: proto.recipient,
      isFromMe: proto.isFromMe,
      messageId: text.messageId,
      text: text.text,
      replyToMessageId: text.replyToMessageId,
    };
  }

  if (proto.attachment) {
    const attachment = mapMessageAttachment(proto.attachment);
    return {
      type: "message.attachment",
      sequence,
      occurredAt,
      recipient: proto.recipient,
      isFromMe: proto.isFromMe,
      messageId: attachment.messageId,
      attachment,
    };
  }

  if (proto.reaction) {
    const reaction = mapMessageReaction(proto.reaction);
    return {
      type: "message.reaction",
      sequence,
      occurredAt,
      recipient: proto.recipient,
      isFromMe: proto.isFromMe,
      messageId: reaction.messageId,
      reaction,
    };
  }

  if (proto.receipt) {
    const receipt = mapMessageReceiptUpdate(proto.receipt);
    return {
      type: "message.receiptChanged",
      sequence,
      occurredAt,
      recipient: proto.recipient,
      isFromMe: proto.isFromMe,
      messageId: receipt.messageId,
      receiptDigest: receipt.receiptDigest,
    };
  }

  return undefined;
}

export function mapPollEvent(
  sequence: number,
  proto: ProtoPollChangeEvent
): PollEvent | undefined {
  const context = {
    sequence,
    occurredAt: proto.occurredAt ?? null,
    recipient: proto.recipient,
    isFromMe: proto.isFromMe,
  };

  if (proto.created) {
    return {
      ...context,
      type: "poll.created",
      poll: mapPoll(proto.created),
    };
  }

  if (proto.updated) {
    return {
      ...context,
      type: "poll.updated",
      poll: mapPoll(proto.updated),
    };
  }

  if (proto.voteChanged) {
    return {
      ...context,
      type: "poll.voteChanged",
      poll: mapPoll(proto.voteChanged),
    };
  }

  if (proto.choicesChanged) {
    return {
      ...context,
      type: "poll.choicesChanged",
      poll: mapPoll(proto.choicesChanged),
    };
  }

  return undefined;
}
