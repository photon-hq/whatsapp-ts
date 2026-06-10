import { createClient } from "../../src/index.ts";
import { ChatStorageReader, isSuccessStatus, makePng, stanzaOf } from "./fixtures.ts";

const address = process.env.WHATSAPP_SERVER_ADDRESS ?? "127.0.0.1:50051";
const SELF = process.env.WHATSAPP_SELF ?? "8613418786371";
const wa = createClient({ address, tls: false });
const db = new ChatStorageReader();

try {
  const stamp = new Date().toISOString();
  const items = [
    { kind: "image" as const, data: makePng(64, [220, 40, 40]), caption: `album-1 ${stamp}` },
    { kind: "image" as const, data: makePng(64, [40, 220, 40]), caption: `album-2 ${stamp}` },
    { kind: "image" as const, data: makePng(64, [40, 40, 220]), caption: `album-3 ${stamp}` },
  ];

  const sent = await wa.messages.sendAlbum(SELF, items);
  if (sent.length !== items.length) {
    throw new Error(`expected ${items.length} snapshots, got ${sent.length}`);
  }

  const ids = new Set(sent.map((m) => m.messageId));
  if (ids.size !== sent.length) {
    throw new Error(`duplicate message ids in album readback: ${[...ids].join(", ")}`);
  }

  const results = [];
  for (const message of sent) {
    const row = await db.waitForStatus(stanzaOf(message.messageId), 15000);
    results.push({
      messageId: message.messageId,
      apiStatus: message.messageStatus,
      dbStatus: row?.status ?? null,
      delivered: isSuccessStatus(row?.status ?? null),
      mediaUrl: row?.mediaUrl ? "set" : "empty",
      type: row?.type,
    });
  }

  console.log(JSON.stringify({ ok: true, count: sent.length, results }, null, 2));
} catch (err) {
  console.error("ALBUM FAILED:", err);
  process.exitCode = 1;
} finally {
  db.close();
  await wa.close();
}
