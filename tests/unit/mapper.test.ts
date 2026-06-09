import { describe, expect, test } from "bun:test";
import { MessageAttachmentKind } from "../../src/generated/whatsapp_message_types.ts";
import { mapMessageEvent, mapPollEvent } from "../../src/transport/mapper.ts";

describe("mapper", () => {
  test("maps unknown attachment kind to document", () => {
    const event = mapMessageEvent(7, {
      recipient: "15551234567",
      occurredAt: new Date(1000),
      isFromMe: false,
      attachment: {
        messageId: "m1",
        kind: MessageAttachmentKind.MESSAGE_ATTACHMENT_KIND_UNKNOWN,
      },
    });

    expect(event?.type).toBe("message.attachment");
    if (event?.type === "message.attachment") {
      expect(event.attachment.kind).toBe("document");
    }
  });

  test("maps text messages", () => {
    const event = mapMessageEvent(1, {
      recipient: "15551234567",
      occurredAt: new Date(1000),
      isFromMe: true,
      text: {
        messageId: "m1",
        text: "hello",
        replyToMessageId: "parent",
      },
    });

    expect(event).toEqual({
      type: "message.text",
      sequence: 1,
      occurredAt: new Date(1000),
      recipient: "15551234567",
      isFromMe: true,
      messageId: "m1",
      text: "hello",
      replyToMessageId: "parent",
    });
  });

  test("maps poll creation", () => {
    const event = mapPollEvent(2, {
      recipient: "15551234567",
      pollId: "poll-1",
      occurredAt: new Date(2000),
      isFromMe: true,
      created: {
        pollId: "poll-1",
        question: "Lunch?",
        choices: [{ index: 0, text: "Sushi", voteCount: 1 }],
        allowMultipleChoices: false,
        hideVoterNames: false,
      },
    });

    expect(event?.type).toBe("poll.created");
    expect(event?.poll.pollId).toBe("poll-1");
  });

  test("maps reaction and receipt message changes", () => {
    const reaction = mapMessageEvent(5, {
      recipient: "15551234567",
      occurredAt: new Date(5000),
      isFromMe: false,
      reaction: {
        messageId: "m1",
        emoji: "👍",
        actorJid: "12345@lid",
        reactionId: "3B50485D7776329E4293",
      },
    });

    expect(reaction?.type).toBe("message.reaction");
    expect(reaction?.messageId).toBe("m1");
    if (reaction?.type === "message.reaction") {
      expect(reaction.reaction).toEqual({
        messageId: "m1",
        emoji: "👍",
        actorJid: "12345@lid",
        reactionId: "3B50485D7776329E4293",
      });
    }

    const receipt = mapMessageEvent(6, {
      recipient: "15551234567",
      occurredAt: new Date(6000),
      isFromMe: true,
      receipt: {
        messageId: "m2",
        receiptDigest: "abc123",
      },
    });

    expect(receipt?.type).toBe("message.receiptChanged");
    expect(receipt?.messageId).toBe("m2");
    if (receipt?.type === "message.receiptChanged") {
      expect(receipt.receiptDigest).toBe("abc123");
    }
  });

  test("maps poll vote, choices, and update changes", () => {
    const basePoll = {
      pollId: "poll-1",
      question: "Lunch?",
      choices: [{ index: 0, text: "Sushi", voteCount: 1 }],
      allowMultipleChoices: false,
      hideVoterNames: false,
    };

    expect(
      mapPollEvent(7, {
        recipient: "15551234567",
        pollId: "poll-1",
        occurredAt: new Date(7000),
        isFromMe: true,
        voteChanged: basePoll,
      })?.type
    ).toBe("poll.voteChanged");

    expect(
      mapPollEvent(8, {
        recipient: "15551234567",
        pollId: "poll-1",
        occurredAt: new Date(8000),
        isFromMe: true,
        choicesChanged: {
          ...basePoll,
          choices: [
            ...basePoll.choices,
            { index: 1, text: "Pizza", voteCount: 0 },
          ],
        },
      })?.type
    ).toBe("poll.choicesChanged");

    expect(
      mapPollEvent(9, {
        recipient: "15551234567",
        pollId: "poll-1",
        occurredAt: new Date(9000),
        isFromMe: true,
        updated: basePoll,
      })?.type
    ).toBe("poll.updated");
  });
});
