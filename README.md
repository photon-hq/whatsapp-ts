# @photon-ai/whatsapp

TypeScript SDK for the Photon WhatsApp server.

The SDK is intentionally thin: each resource method maps to one server RPC,
returns handwritten SDK types, and keeps reconnect / catch-up behavior explicit.
Generated protobuf types are not part of the public API.

## Install

```bash
bun add @photon-ai/whatsapp
```

Node.js `>=18.17` is supported. The package is ESM-only.

## Connect

```ts
import { createClient } from "@photon-ai/whatsapp";

const wa = createClient({
  address: "127.0.0.1:50051",
  tls: false,
  token: "my-api-token",
});

await wa.close();
```

`tls` defaults to `true`. Set `tls: false` for local development.
`token` is sent as `authorization: Bearer ...` on every RPC.

## Recipients

Methods that send to a conversation take `recipient`:

- Direct chats: phone number digits, such as `"15551234567"`.

Use message and event payload IDs directly when replying, reacting, voting, or
catching up.

Poll IDs are WhatsApp message unique keys on the local device/account. For a
poll created on another device, use the `pollId` surfaced by this device's poll
event or `get` result, not a poll id copied from the creator device.

## Messages

```ts
const sent = await wa.messages.sendText("15551234567", "hello", {
  enableLinkPreview: true,
});

await wa.messages.react(sent.messageId, "👍");
```

Send image bytes:

```ts
import { readFile } from "node:fs/promises";

const sentImage = await wa.messages.sendImage(
  "15551234567",
  await readFile("photo.jpg"),
  { caption: "photo" }
);
```

Message writes resolve after the server observes the persisted ChatStorage row
and return the fresh message snapshot.

For retries, pass a stable `clientMessageId` on the write:

```ts
await wa.messages.sendText("15551234567", "hello", {
  clientMessageId: "send-20260519-001",
});
```

Reuse a `clientMessageId` only for the same logical write. Use a new value for
each different message, image, reaction, poll, vote, or unvote.

Read recent messages:

```ts
const recent = await wa.messages.listRecent({ pageSize: 20 });
const chat = await wa.messages.listInChat("15551234567", { pageSize: 20 });
const message = await wa.messages.get(recent.messages[0].messageId);
```

## Polls

```ts
const poll = await wa.polls.create(
  "15551234567",
  "Lunch?",
  ["Sushi", "Tacos"],
  { allowMultipleChoices: false }
);

await wa.polls.vote(poll.pollId, 0);
await wa.polls.unvote(poll.pollId);
```

Every poll event carries a complete current snapshot. Use `voteChanged` events
and choice vote counts to track vote transitions.

## Live Events

Each live subscription starts at the current server head and streams future
changes. Persist the `sequence` from handled events if you need reconnect
recovery.

```ts
for await (const event of wa.messages.subscribeEvents()) {
  switch (event.type) {
    case "message.text":
      console.log(event.sequence, event.messageId, event.text);
      break;
    case "message.attachment":
      console.log(event.sequence, event.messageId, event.attachment.kind);
      break;
    case "message.reaction":
      console.log(event.sequence, event.messageId, event.reaction.emoji);
      break;
    case "message.receiptChanged":
      console.log(event.sequence, event.messageId, event.receiptDigest);
      break;
  }
}
```

Domain streams:

- `wa.messages.subscribeEvents({ recipient })`
- `wa.polls.subscribeEvents({ pollId })`

Message events are top-level discriminated unions such as `message.text`,
`message.attachment`, `message.reaction`, and `message.receiptChanged`.
Delivery/read receipt blobs are intentionally suppressed unless the server can
map them to a stable public event such as a reaction change.

Poll events carry the current poll snapshot directly:

```ts
for await (const event of wa.polls.subscribeEvents({ pollId: poll.pollId })) {
  console.log(event.type, event.poll.question, event.poll.choices);
}
```

The public event surface intentionally tracks only helper-supported domains:
messages and polls. Chat-list and group-state APIs are not part of this SDK.

## Catch Up

Use `events.catchUp(lastHandledSequence)` after a disconnect, then reopen the
live streams you need.

```ts
const replay = wa.events.catchUp(lastHandledSequence);

for await (const event of replay) {
  console.log(event.sequence, event.type);
}

console.log("caught up through", await replay.headSequence);
```

`catchUp()` is itself a business-event stream. `headSequence` resolves only
after the replay reaches the server's completion frame.
