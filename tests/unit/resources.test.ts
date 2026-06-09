import { describe, expect, test } from "bun:test";
import { ValidationError } from "../../src/errors/whatsapp-error.ts";
import { MediaKind } from "../../src/generated/whatsapp_message_service.ts";
import { EventsResource } from "../../src/resources/events.ts";
import { MessagesResource } from "../../src/resources/messages.ts";
import { PollsResource } from "../../src/resources/polls.ts";
import type { LiveEvent } from "../../src/types/events.ts";

describe("resources", () => {
  test("sendText maps request and returns persisted message snapshot", async () => {
    const calls: unknown[] = [];
    const resource = new MessagesResource({
      async sendTextMessage(request: unknown) {
        calls.push(request);
        return {
          message: {
            messageId: "m1",
            recipient: "15551234567",
            chatJid: "15551234567@s.whatsapp.net",
            stanzaId: "stanza-1",
            text: "hello",
            isFromMe: true,
            messageType: 0,
            messageStatus: 6,
            messageErrorStatus: 0,
            messageDate: new Date(1000),
            sentDate: new Date(1000),
          },
        };
      },
    } as never);

    const sent = await resource.sendText("15551234567", "hello", {
      enableLinkPreview: true,
      clientMessageId: "client-1",
    });

    expect(sent.messageId).toBe("m1");
    expect(sent).toEqual({
      messageId: "m1",
      recipient: "15551234567",
      chatJid: "15551234567@s.whatsapp.net",
      stanzaId: "stanza-1",
      text: "hello",
      isFromMe: true,
      messageType: 0,
      messageStatus: 6,
      messageErrorStatus: 0,
      messageDate: new Date(1000),
      sentDate: new Date(1000),
      fromJid: undefined,
      toJid: undefined,
      pushName: undefined,
      partnerName: undefined,
      replyToMessageId: undefined,
      media: undefined,
      latestReaction: undefined,
      receiptDigest: undefined,
    });
    expect(calls[0]).toMatchObject({
      recipient: "15551234567",
      content: [
        {
          type: 0,
          text: [{ text: "hello", styles: [] }],
        },
      ],
      enableLinkPreview: true,
      clientMessageId: "client-1",
    });
  });

  test("sendText maps structured content request", async () => {
    const calls: unknown[] = [];
    const resource = new MessagesResource({
      async sendTextMessage(request: unknown) {
        calls.push(request);
        return {
          message: {
            messageId: "m1",
            recipient: "15551234567",
            chatJid: "15551234567@s.whatsapp.net",
            stanzaId: "stanza-1",
            text: "Pay today",
            isFromMe: true,
            messageType: 0,
            messageDate: null,
            sentDate: null,
          },
        };
      },
    } as never);

    await resource.sendText("15551234567", [
      {
        type: "bullet",
        text: [{ text: "Pay " }, { text: "today", styles: ["bold", "bold"] }],
      },
    ]);

    expect(calls[0]).toMatchObject({
      recipient: "15551234567",
      content: [
        {
          type: 2,
          text: [
            { text: "Pay ", styles: [] },
            { text: "today", styles: [1] },
          ],
        },
      ],
    });
  });

  test("sendText validates recipient and identifiers before RPC", async () => {
    const resource = new MessagesResource({
      async sendTextMessage() {
        throw new Error("should not call rpc");
      },
    } as never);

    expect(resource.sendText("+15551234567", "hello")).rejects.toThrow(
      ValidationError
    );
    expect(
      resource.sendText("15551234567", "hello", { replyTo: "   " })
    ).rejects.toThrow("replyTo must not be empty");
    expect(
      resource.sendText("15551234567", "hello", { clientMessageId: "   " })
    ).rejects.toThrow("clientMessageId must not be empty");
  });

  test("sendText trims recipient and identifiers but preserves content", async () => {
    const calls: unknown[] = [];
    const resource = new MessagesResource({
      async sendTextMessage(request: unknown) {
        calls.push(request);
        return {
          message: {
            messageId: "m1",
            recipient: "15551234567",
            chatJid: "15551234567@s.whatsapp.net",
            stanzaId: "stanza-1",
            text: "  hello  ",
            isFromMe: true,
            messageType: 0,
            messageDate: null,
            sentDate: null,
          },
        };
      },
    } as never);

    await resource.sendText(" 15551234567 ", "  hello  ", {
      replyTo: " parent ",
      clientMessageId: " client-1 ",
    });

    expect(calls[0]).toMatchObject({
      recipient: "15551234567",
      replyTo: "parent",
      clientMessageId: "client-1",
      content: [{ text: [{ text: "  hello  " }] }],
    });
  });

  test("sendImage maps request and returns persisted message snapshot", async () => {
    const calls: unknown[] = [];
    const resource = new MessagesResource({
      async sendMediaMessage(request: unknown) {
        calls.push(request);
        return {
          message: {
            messageId: "media-1",
            recipient: "15551234567",
            chatJid: "15551234567@s.whatsapp.net",
            stanzaId: "media-stanza",
            text: "caption",
            isFromMe: true,
            messageType: 1,
            messageDate: null,
            sentDate: null,
            media: {
              kind: 1,
              title: "caption",
              mediaUrl: "https://mmg.whatsapp.net/demo.jpg",
              mediaUrlDate: null,
            },
          },
        };
      },
    } as never);

    const sent = await resource.sendImage(
      " 15551234567 ",
      new Uint8Array([1, 2, 3]),
      {
        caption: "caption",
        accessibilityText: "demo image",
        clientMessageId: " image-1 ",
      }
    );

    expect(calls[0]).toMatchObject({
      recipient: "15551234567",
      media: {
        kind: MediaKind.MEDIA_KIND_IMAGE,
        data: new Uint8Array([1, 2, 3]),
        caption: "caption",
        accessibilityText: "demo image",
      },
      clientMessageId: "image-1",
    });
    expect(sent.messageId).toBe("media-1");
    expect(sent.media?.kind).toBe("image");
    expect(sent.media?.mediaUrl).toBe("https://mmg.whatsapp.net/demo.jpg");
  });

  test("sendImage validates inputs before RPC", async () => {
    const resource = new MessagesResource({
      async sendMediaMessage() {
        throw new Error("should not call rpc");
      },
    } as never);

    expect(
      resource.sendImage("+15551234567", new Uint8Array([1]))
    ).rejects.toThrow(ValidationError);
    expect(resource.sendImage("15551234567", new Uint8Array())).rejects.toThrow(
      "image must not be empty"
    );
    expect(
      resource.sendImage("15551234567", new Uint8Array([1]), {
        caption: "   ",
      })
    ).rejects.toThrow("caption must not be empty");
    expect(
      resource.sendImage("15551234567", new Uint8Array([1]), {
        accessibilityText: "   ",
      })
    ).rejects.toThrow("accessibilityText must not be empty");
  });

  test("react returns reacted message snapshot", async () => {
    const resource = new MessagesResource({
      async sendReaction() {
        return {
          message: {
            messageId: "m1",
            recipient: "15551234567",
            chatJid: "15551234567@s.whatsapp.net",
            stanzaId: "stanza-1",
            text: "hello",
            isFromMe: false,
            messageType: 0,
            messageDate: null,
            sentDate: null,
            latestReaction: {
              messageId: "m1",
              emoji: "👍",
              actorJid: "12345@lid",
              reactionId: "3B50485D7776329E4293",
            },
            receiptDigest: "digest-1",
          },
        };
      },
    } as never);

    const reacted = await resource.react("m1", "👍");

    expect(reacted.messageId).toBe("m1");
    expect(reacted.latestReaction?.emoji).toBe("👍");
    expect(reacted.receiptDigest).toBe("digest-1");
  });

  test("react accepts common single emoji grapheme forms", async () => {
    const calls: string[] = [];
    const resource = new MessagesResource({
      async sendReaction(request: { emoji: string }) {
        calls.push(request.emoji);
        return {
          message: {
            messageId: "m1",
            recipient: "15551234567",
            chatJid: "15551234567@s.whatsapp.net",
            stanzaId: "stanza-1",
            text: "hello",
            isFromMe: false,
            messageType: 0,
            messageDate: null,
            sentDate: null,
          },
        };
      },
    } as never);

    await resource.react("m1", "👍");
    await resource.react("m1", "🇺🇸");
    await resource.react("m1", "1️⃣");
    await resource.react("m1", "❤️");

    expect(calls).toEqual(["👍", "🇺🇸", "1️⃣", "❤️"]);
  });

  test("react validates inputs before RPC", async () => {
    const resource = new MessagesResource({
      async sendReaction() {
        throw new Error("should not call rpc");
      },
    } as never);

    expect(resource.react("   ", "👍")).rejects.toThrow(
      "messageId must not be empty"
    );
    expect(resource.react("m1", "   ")).rejects.toThrow(
      "emoji must not be empty"
    );
    expect(resource.react("m1", "hello")).rejects.toThrow(
      "emoji must be a single emoji"
    );
    expect(resource.react("m1", "👍👍")).rejects.toThrow(
      "emoji must be a single emoji"
    );
    expect(
      resource.react("m1", "👍", { clientMessageId: "   " })
    ).rejects.toThrow("clientMessageId must not be empty");
  });

  test("get maps message lookup response", async () => {
    const calls: unknown[] = [];
    const resource = new MessagesResource({
      async getMessage(request: unknown) {
        calls.push(request);
        return {
          message: {
            messageId: "m1",
            recipient: "15551234567",
            chatJid: "15551234567@s.whatsapp.net",
            stanzaId: "stanza-1",
            text: "hello",
            isFromMe: false,
            messageType: 0,
            messageDate: null,
            sentDate: null,
          },
        };
      },
    } as never);

    const message = await resource.get(" m1 ");

    expect(calls[0]).toEqual({ messageId: "m1" });
    expect(message.messageId).toBe("m1");
    expect(message.text).toBe("hello");
  });

  test("listRecent maps full message page request and response", async () => {
    const calls: unknown[] = [];
    const before = new Date(2000);
    const after = new Date(1000);
    const resource = new MessagesResource({
      async listRecentMessages(request: unknown) {
        calls.push(request);
        return {
          messages: [
            {
              messageId: "m2",
              recipient: "15551234567",
              chatJid: "15551234567@s.whatsapp.net",
              stanzaId: "stanza-2",
              text: "recent",
              isFromMe: true,
              messageType: 0,
              messageDate: before,
              sentDate: before,
            },
          ],
          nextPageToken: "next",
        };
      },
    } as never);

    const page = await resource.listRecent({
      pageSize: 25,
      pageToken: " token ",
      isFromMe: true,
      before,
      after,
    });

    expect(calls[0]).toEqual({
      pageSize: 25,
      pageToken: "token",
      isFromMe: true,
      before,
      after,
    });
    expect(page.messages[0]?.messageId).toBe("m2");
    expect(page.nextPageToken).toBe("next");
  });

  test("listInChat maps recipient and page filters", async () => {
    const calls: unknown[] = [];
    const resource = new MessagesResource({
      async listChatMessages(request: unknown) {
        calls.push(request);
        return { messages: [] };
      },
    } as never);

    await resource.listInChat(" 15551234567 ", { pageSize: 1 });

    expect(calls[0]).toEqual({
      recipient: "15551234567",
      pageSize: 1,
      pageToken: undefined,
      isFromMe: undefined,
      before: undefined,
      after: undefined,
    });
  });

  test("message query methods validate inputs before RPC", async () => {
    const resource = new MessagesResource({
      getMessage() {
        throw new Error("should not call rpc");
      },
      listRecentMessages() {
        throw new Error("should not call rpc");
      },
      listChatMessages() {
        throw new Error("should not call rpc");
      },
    } as never);

    expect(resource.get("   ")).rejects.toThrow("messageId must not be empty");
    expect(resource.listInChat("+15551234567")).rejects.toThrow(
      ValidationError
    );
    expect(resource.listRecent({ pageSize: 0 })).rejects.toThrow(
      "pageSize must be an integer between 1 and 100"
    );
    expect(resource.listRecent({ pageToken: "   " })).rejects.toThrow(
      "pageToken must not be empty"
    );
    expect(
      resource.listRecent({ before: new Date(Number.NaN) })
    ).rejects.toThrow("before must be a valid Date");
  });

  test("poll write methods validate clientMessageId before RPC", async () => {
    const resource = new PollsResource({
      createPoll() {
        throw new Error("should not call rpc");
      },
      votePoll() {
        throw new Error("should not call rpc");
      },
      unvotePoll() {
        throw new Error("should not call rpc");
      },
    } as never);

    expect(
      resource.create("15551234567", "Lunch?", ["Sushi", "Tacos"], {
        clientMessageId: "   ",
      })
    ).rejects.toThrow("clientMessageId must not be empty");
    expect(
      resource.vote("poll-1", [0], { clientMessageId: "   " })
    ).rejects.toThrow("clientMessageId must not be empty");
    expect(
      resource.unvote("poll-1", { clientMessageId: "   " })
    ).rejects.toThrow("clientMessageId must not be empty");
  });

  test("poll write methods map clean natural request shapes", async () => {
    const calls: unknown[] = [];
    const resource = new PollsResource({
      async createPoll(request: unknown) {
        calls.push(request);
        return {
          poll: {
            pollId: "poll-1",
            question: "Lunch?",
            choices: [
              { index: 0, text: "Sushi", voteCount: 0 },
              { index: 1, text: "Tacos", voteCount: 0 },
            ],
            allowMultipleChoices: true,
            hideVoterNames: false,
          },
        };
      },
      async votePoll(request: unknown) {
        calls.push(request);
        return {
          poll: {
            pollId: "poll-1",
            question: "Lunch?",
            choices: [
              { index: 0, text: "Sushi", voteCount: 1 },
              { index: 1, text: "Tacos", voteCount: 0 },
            ],
            allowMultipleChoices: true,
            hideVoterNames: false,
          },
        };
      },
      async unvotePoll(request: unknown) {
        calls.push(request);
        return {
          poll: {
            pollId: "poll-1",
            question: "Lunch?",
            choices: [
              { index: 0, text: "Sushi", voteCount: 0 },
              { index: 1, text: "Tacos", voteCount: 0 },
            ],
            allowMultipleChoices: true,
            hideVoterNames: false,
          },
        };
      },
    } as never);

    const closesAt = new Date(Date.now() + 60_000);
    const poll = await resource.create(
      " 15551234567 ",
      " Lunch? ",
      [" Sushi ", "Tacos"],
      {
        allowMultipleChoices: true,
        closesAt,
        clientMessageId: " create-1 ",
      }
    );
    await resource.vote(" poll-1 ", 0, { clientMessageId: " vote-1 " });
    await resource.vote(" poll-1 ", [0, 1]);
    await resource.unvote(" poll-1 ", { clientMessageId: " unvote-1 " });

    expect(poll.question).toBe("Lunch?");
    expect(poll.choices.map((choice) => choice.text)).toEqual([
      "Sushi",
      "Tacos",
    ]);
    expect(calls).toEqual([
      {
        recipient: "15551234567",
        question: "Lunch?",
        choices: ["Sushi", "Tacos"],
        allowMultipleChoices: true,
        hideVoterNames: false,
        closesAt,
        clientMessageId: "create-1",
      },
      {
        pollId: "poll-1",
        choiceIndexes: [0],
        clientMessageId: "vote-1",
      },
      {
        pollId: "poll-1",
        choiceIndexes: [0, 1],
        clientMessageId: undefined,
      },
      {
        pollId: "poll-1",
        clientMessageId: "unvote-1",
      },
    ]);
  });

  test("poll write methods validate inputs before RPC", async () => {
    const resource = new PollsResource({
      createPoll() {
        throw new Error("should not call rpc");
      },
      votePoll() {
        throw new Error("should not call rpc");
      },
      unvotePoll() {
        throw new Error("should not call rpc");
      },
    } as never);

    expect(
      resource.create("+15551234567", "Lunch?", ["A", "B"])
    ).rejects.toThrow(ValidationError);
    expect(resource.create("15551234567", "   ", ["A", "B"])).rejects.toThrow(
      "question must not be empty"
    );
    expect(resource.create("15551234567", "Lunch?", ["A"])).rejects.toThrow(
      "choices must contain at least two entries"
    );
    expect(
      resource.create("15551234567", "Lunch?", [" A ", "A"])
    ).rejects.toThrow("choices must not contain duplicates");
    expect(
      resource.create("15551234567", "Lunch?", ["A", "B"], {
        closesAt: new Date(Date.now() - 60_000),
      })
    ).rejects.toThrow("closesAt must be in the future");
    expect(resource.vote("poll-1", [])).rejects.toThrow(
      "choiceIndexes must not be empty"
    );
    expect(resource.vote("poll-1", [-1])).rejects.toThrow(
      "choiceIndexes must contain non-negative integers"
    );
    expect(resource.vote("poll-1", [0, 0])).rejects.toThrow(
      "choiceIndexes must not contain duplicates"
    );
    expect(resource.unvote("   ")).rejects.toThrow("pollId must not be empty");
  });

  test("poll event subscription validates and trims filter", async () => {
    const calls: unknown[] = [];
    const resource = new PollsResource({
      subscribePollEvents(request: unknown) {
        calls.push(request);
        return (async function* () {
          yield* [];
        })();
      },
    } as never);

    await resource.subscribeEvents({ pollId: " poll-1 " }).close();

    expect(calls[0]).toEqual({ pollId: "poll-1" });
    expect(() => resource.subscribeEvents({ pollId: "   " })).toThrow(
      "pollId must not be empty"
    );
  });

  test("message event subscription validates and trims filter", async () => {
    const calls: unknown[] = [];
    const resource = new MessagesResource({
      subscribeMessageEvents(request: unknown) {
        calls.push(request);
        return (async function* () {
          yield* [];
        })();
      },
    } as never);

    await resource.subscribeEvents({ recipient: " 15551234567 " }).close();

    expect(calls[0]).toEqual({ recipient: "15551234567" });
    expect(() =>
      resource.subscribeEvents({ recipient: "+15551234567" })
    ).toThrow(ValidationError);
  });

  test("catchUp rejects unsafe cursors before RPC", () => {
    const resource = new EventsResource({
      catchUpEvents() {
        throw new Error("should not call rpc");
      },
    } as never);

    expect(() => resource.catchUp(-1)).toThrow(
      "since must be a non-negative safe integer"
    );
  });

  test("catchUp maps reaction and poll vote frames", async () => {
    async function* frames() {
      yield {
        sequence: 8,
        messageChanged: {
          recipient: "15551234567",
          occurredAt: new Date(8000),
          isFromMe: false,
          reaction: {
            messageId: "m1",
            emoji: "👍",
            actorJid: "12345@lid",
            reactionId: "3B50485D7776329E4293",
          },
        },
      };
      yield {
        sequence: 9,
        pollChanged: {
          recipient: "15551234567",
          pollId: "poll-1",
          occurredAt: new Date(9000),
          isFromMe: true,
          voteChanged: {
            pollId: "poll-1",
            question: "Lunch?",
            choices: [{ index: 0, text: "Sushi", voteCount: 1 }],
            allowMultipleChoices: false,
            hideVoterNames: false,
          },
        },
      };
      yield {
        complete: { headSequence: 9 },
      };
    }

    const resource = new EventsResource({
      catchUpEvents(request: unknown) {
        expect(request).toEqual({ afterSequence: 7 });
        return frames();
      },
    } as never);

    const replay = resource.catchUp(7);
    const collected: LiveEvent[] = [];
    for await (const event of replay) {
      collected.push(event);
    }

    await expect(replay.headSequence).resolves.toBe(9);
    expect(collected[0]?.type).toBe("message.reaction");
    expect(collected[1]?.type).toBe("poll.voteChanged");
    expect(collected).toHaveLength(2);
  });

  test("catchUp rejects headSequence when closed before completion", async () => {
    async function* frames() {
      yield {
        sequence: 8,
        messageChanged: {
          recipient: "15551234567",
          occurredAt: new Date(8000),
          isFromMe: false,
          text: { messageId: "m1", text: "hello" },
        },
      };
      await new Promise(() => undefined);
    }

    const resource = new EventsResource({
      catchUpEvents() {
        return frames();
      },
    } as never);

    const replay = resource.catchUp(7);
    await replay.close();

    await expect(replay.headSequence).rejects.toThrow(
      "catchUp was closed before completion."
    );
  });

  test("catchUp close is harmless after replay completion", async () => {
    async function* frames() {
      yield {
        complete: { headSequence: 7 },
      };
    }

    const resource = new EventsResource({
      catchUpEvents() {
        return frames();
      },
    } as never);

    const replay = resource.catchUp(7);
    const collected: LiveEvent[] = [];

    for await (const event of replay) {
      collected.push(event);
    }

    await expect(replay.headSequence).resolves.toBe(7);
    await expect(replay.close()).resolves.toBeUndefined();
    expect(collected).toHaveLength(0);
  });
});
