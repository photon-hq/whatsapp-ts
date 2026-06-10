import { createClient } from "../../src/index.ts";
import type { MessageEvent, PollEvent } from "../../src/types/events.ts";
import type { TextContent } from "../../src/types/messages.ts";
import {
  ChatStorageReader,
  isSuccessStatus,
  makePng,
  stanzaOf,
} from "./fixtures.ts";

const address = process.env.WHATSAPP_SERVER_ADDRESS ?? "127.0.0.1:50051";
const SELF = process.env.WHATSAPP_SELF ?? "8613418786371";
const PEER = process.env.WHATSAPP_PEER ?? "14156035192";
const OUT = process.env.OUT ?? "tests/live/last-run.json";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface StepResult {
  step: string;
  target: string;
  ok: boolean;
  messageId?: string;
  apiStatus?: number | null;
  dbStatus?: number | null;
  dbErr?: number | null;
  delivered?: boolean;
  detail?: string;
  error?: string;
}

const results: StepResult[] = [];
const messageEvents: MessageEvent[] = [];
const pollEvents: PollEvent[] = [];

const wa = createClient({ address, tls: false });
const db = new ChatStorageReader();

function tag(): string {
  return Math.random().toString(36).slice(2, 7);
}

async function sendText(
  step: string,
  target: string,
  content: TextContent,
  options?: Parameters<typeof wa.messages.sendText>[2]
): Promise<string | undefined> {
  try {
    const sent = await wa.messages.sendText(target, content, options);
    const row = await db.waitForStatus(stanzaOf(sent.messageId));
    const delivered = isSuccessStatus(row?.status ?? null);
    results.push({
      step,
      target,
      ok: true,
      messageId: sent.messageId,
      apiStatus: sent.messageStatus,
      dbStatus: row?.status ?? null,
      dbErr: row?.err ?? null,
      delivered,
    });
    return sent.messageId;
  } catch (err) {
    results.push({ step, target, ok: false, error: String(err) });
    return undefined;
  }
}

async function run(
  step: string,
  target: string,
  fn: () => Promise<Partial<StepResult>>
): Promise<void> {
  try {
    const extra = await fn();
    results.push({ step, target, ok: true, ...extra });
  } catch (err) {
    results.push({ step, target, ok: false, error: String(err) });
  }
}

async function textMatrix(target: string, full: boolean): Promise<void> {
  const t = tag();
  const firstId = await sendText("text.plain", target, `plain ${t}`);

  await sendText("text.bold", target, [
    { text: [{ text: `bold ${t}`, styles: ["bold"] }] },
  ]);

  if (full) {
    await sendText("text.italic", target, [
      { text: [{ text: `italic ${t}`, styles: ["italic"] }] },
    ]);
    await sendText("text.strikethrough", target, [
      { text: [{ text: `strike ${t}`, styles: ["strikethrough"] }] },
    ]);
    await sendText("text.code", target, [
      { text: [{ text: `code ${t}`, styles: ["code"] }] },
    ]);
    await sendText("text.combinedStyles", target, [
      {
        text: [
          {
            text: `all ${t}`,
            styles: ["bold", "italic", "strikethrough"],
          },
        ],
      },
    ]);
    await sendText("text.quote", target, [
      { type: "quote", text: `quote ${t}` },
    ]);
    await sendText("text.bulletList", target, [
      { type: "bullet", text: `first ${t}` },
      { type: "bullet", text: `second ${t}` },
    ]);
    await sendText("text.numberedList", target, [
      { type: "numbered", text: `step one ${t}` },
      { type: "numbered", text: `step two ${t}` },
    ]);
    await sendText("text.mixedBlocks", target, [
      { text: `intro ${t}` },
      { type: "quote", text: "remember" },
      { type: "bullet", text: "buy milk" },
      { type: "numbered", text: "pay invoice" },
    ]);
    await sendText("text.emojiOnly", target, "🎉🚀😀🔥");
    await sendText("text.multiline", target, `line1 ${t}\nline2\nline3`);
    await sendText(
      "text.linkPreview",
      target,
      `check https://github.com/photon-hq ${t}`,
      { enableLinkPreview: true }
    );
    await sendText("text.cjkRtlEmoji", target, [
      {
        text: [
          { text: "你好 " },
          { text: "👨‍👩‍👧‍👦", styles: ["bold"] },
          { text: " مرحبا", styles: ["italic"] },
        ],
      },
    ]);
  }

  if (firstId) {
    await sendText("text.reply", target, `reply ${t}`, { replyTo: firstId });

    await run("react.add", target, async () => {
      const reacted = await wa.messages.react(firstId, "👍");
      return {
        messageId: reacted.messageId,
        detail: `emoji=${reacted.latestReaction?.emoji ?? "?"}`,
      };
    });
    await run("react.replace", target, async () => {
      const reacted = await wa.messages.react(firstId, "❤️");
      return {
        messageId: reacted.messageId,
        detail: `emoji=${reacted.latestReaction?.emoji ?? "?"}`,
      };
    });
    await run("query.get", target, async () => {
      const m = await wa.messages.get(firstId);
      return { messageId: m.messageId, detail: `text="${m.text}"` };
    });
  }
}

async function mediaMatrix(target: string): Promise<void> {
  const png = makePng();
  await run("media.imageNoCaption", target, async () => {
    const m = await wa.messages.sendImage(target, png);
    const row = await db.waitForStatus(stanzaOf(m.messageId));
    return {
      messageId: m.messageId,
      apiStatus: m.messageStatus,
      dbStatus: row?.status ?? null,
      delivered: isSuccessStatus(row?.status ?? null),
      detail: `mediaUrl=${row?.mediaUrl ? "set" : "empty"}`,
    };
  });
  await run("media.imageWithCaption", target, async () => {
    const m = await wa.messages.sendImage(target, png, {
      caption: `captioned ${tag()}`,
      accessibilityText: "green square",
    });
    const row = await db.waitForStatus(stanzaOf(m.messageId));
    return {
      messageId: m.messageId,
      apiStatus: m.messageStatus,
      dbStatus: row?.status ?? null,
      delivered: isSuccessStatus(row?.status ?? null),
      detail: `mediaUrl=${row?.mediaUrl ? "set" : "empty"}`,
    };
  });
}

async function queryMatrix(target: string): Promise<void> {
  await run("query.listRecent", target, async () => {
    const page = await wa.messages.listRecent({ pageSize: 10 });
    return { detail: `messages=${page.messages.length}` };
  });
  await run("query.listInChat", target, async () => {
    const page = await wa.messages.listInChat(target, { pageSize: 10 });
    return { detail: `messages=${page.messages.length}` };
  });
}

async function pollMatrix(target: string): Promise<void> {
  let singleId: string | undefined;
  await run("poll.createSingle", target, async () => {
    const poll = await wa.polls.create(
      target,
      `Lunch ${tag()}?`,
      ["Sushi", "Tacos", "Pizza"],
      { hideVoterNames: false }
    );
    singleId = poll.pollId;
    return { messageId: poll.pollId, detail: `choices=${poll.choices.length}` };
  });

  if (singleId) {
    await run("poll.get", target, async () => {
      const poll = await wa.polls.get(singleId as string);
      return { messageId: poll.pollId, detail: `q="${poll.question}"` };
    });
    await run("poll.voteSingle", target, async () => {
      const poll = await wa.polls.vote(singleId as string, 0);
      const total = poll.choices.reduce((s, c) => s + c.voteCount, 0);
      return { messageId: poll.pollId, detail: `totalVotes=${total}` };
    });
    await run("poll.unvote", target, async () => {
      const poll = await wa.polls.unvote(singleId as string);
      const total = poll.choices.reduce((s, c) => s + c.voteCount, 0);
      return { messageId: poll.pollId, detail: `totalVotes=${total}` };
    });
  }

  let multiId: string | undefined;
  await run("poll.createMulti", target, async () => {
    const poll = await wa.polls.create(
      target,
      `Pick toppings ${tag()}`,
      ["Cheese", "Mushroom", "Onion"],
      { allowMultipleChoices: true }
    );
    multiId = poll.pollId;
    return {
      messageId: poll.pollId,
      detail: `multi=${poll.allowMultipleChoices}`,
    };
  });
  if (multiId) {
    await run("poll.voteMulti", target, async () => {
      const poll = await wa.polls.vote(multiId as string, [0, 1]);
      const total = poll.choices.reduce((s, c) => s + c.voteCount, 0);
      return { messageId: poll.pollId, detail: `totalVotes=${total}` };
    });
  }
}

async function main(): Promise<void> {
  console.log(`live full matrix @ ${address}`);
  console.log(`  self=${SELF}  peer(Ling)=${PEER}`);

  let firstSeq: number | undefined;
  let lastSeq = 0;
  const msgStream = wa.messages.subscribeEvents();
  const unsubMsg = msgStream.on(
    (e) => {
      messageEvents.push(e);
      firstSeq ??= e.sequence;
      lastSeq = Math.max(lastSeq, e.sequence);
    },
    (err) => console.error("msg stream error:", String(err))
  );
  const pollStream = wa.polls.subscribeEvents();
  const unsubPoll = pollStream.on(
    (e) => {
      pollEvents.push(e);
      lastSeq = Math.max(lastSeq, e.sequence);
    },
    (err) => console.error("poll stream error:", String(err))
  );

  await sleep(600);

  // Full matrix against self (delivers reliably; no spam to others).
  await textMatrix(SELF, true);
  await mediaMatrix(SELF);
  await queryMatrix(SELF);
  await pollMatrix(SELF);

  // Representative subset against Ling (may stay pending if offline).
  await textMatrix(PEER, false);

  // Let trailing events flush.
  await sleep(2500);
  unsubMsg();
  unsubPoll();

  // catch-up replay validation.
  const since = Math.max(0, (firstSeq ?? 1) - 1);
  const replayed: string[] = [];
  let head: number | undefined;
  try {
    const replay = wa.events.catchUp(since);
    for await (const e of replay.take(500)) {
      replayed.push(e.type);
    }
    head = await replay.headSequence;
  } catch (err) {
    console.error("catchUp error:", String(err));
  }

  const selfChatLid = results.find((r) => r.messageId?.includes("@lid"))
    ?.messageId?.split("_")[0];
  const selfMsgEvents = messageEvents.filter((e) =>
    selfChatLid ? e.recipient === selfChatLid : true
  );

  const summary = {
    address,
    self: SELF,
    peer: PEER,
    steps: results.length,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    delivered: results.filter((r) => r.delivered).length,
    messageEvents: messageEvents.length,
    messageEventTypes: tally(messageEvents.map((e) => e.type)),
    pollEvents: pollEvents.length,
    pollEventTypes: tally(pollEvents.map((e) => e.type)),
    catchUp: { since, replayed: replayed.length, headSequence: head ?? null },
    selfMatchedEvents: selfMsgEvents.length,
  };

  await Bun.write(OUT, JSON.stringify({ summary, results }, null, 2));

  console.log("\n=== STEP RESULTS ===");
  for (const r of results) {
    const mark = r.ok ? (r.delivered === false ? "~" : "✓") : "✗";
    const extra = [
      r.dbStatus != null ? `db=${r.dbStatus}` : "",
      r.detail ?? "",
      r.error ?? "",
    ]
      .filter(Boolean)
      .join(" ");
    console.log(`  ${mark} ${r.step.padEnd(22)} ${r.target.padEnd(14)} ${extra}`);
  }

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nwrote ${OUT}`);

  db.close();
  await wa.close();

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

function tally(items: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) {
    out[i] = (out[i] ?? 0) + 1;
  }
  return out;
}

await main();
