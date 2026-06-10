import { createClient } from "../../src/index.ts";
import {
  ChatStorageReader,
  isSuccessStatus,
  makeM4a,
  makePng,
  makeVcard,
  stanzaOf,
} from "./fixtures.ts";

const address = process.env.WHATSAPP_SERVER_ADDRESS ?? "127.0.0.1:50051";
const SELF = process.env.WHATSAPP_SELF ?? "8613418786371";
const only = process.argv[2];
const wa = createClient({ address, tls: false });
const db = new ChatStorageReader();
let failures = 0;

async function step(name: string, run: () => Promise<Record<string, unknown>>) {
  if (only && only !== name) {
    return;
  }
  try {
    const result = await run();
    console.log(`PASS ${name}:`, JSON.stringify(result));
  } catch (err) {
    failures += 1;
    console.error(`FAIL ${name}:`, err);
  }
}

await step("audio", async () => {
  const sent = await wa.messages.sendAudio(SELF, makeM4a(), {
    mimeType: "audio/mp4",
  });
  const row = await db.waitForStatus(stanzaOf(sent.messageId), 15_000);
  return {
    messageId: sent.messageId,
    kind: sent.media?.kind,
    dbStatus: row?.status,
    delivered: isSuccessStatus(row?.status ?? null),
    type: row?.type,
  };
});

await step("sticker", async () => {
  const sent = await wa.messages.sendSticker(SELF, makePng(96, 96), {
    emojis: ["🤖"],
  });
  const row = await db.waitForStatus(stanzaOf(sent.messageId), 15_000);
  return {
    messageId: sent.messageId,
    kind: sent.media?.kind,
    dbStatus: row?.status,
    delivered: isSuccessStatus(row?.status ?? null),
    type: row?.type,
  };
});

await step("contact-vcard", async () => {
  const sent = await wa.messages.sendContact(SELF, {
    vcard: makeVcard({
      name: "TS Live Vcard",
      phone: "+8610000000001",
      email: "vcard@example.com",
    }),
  });
  const row = await db.waitForStatus(stanzaOf(sent.messageId), 15_000);
  return {
    messageId: sent.messageId,
    kind: sent.media?.kind,
    vcardName: sent.media?.vcardName,
    dbStatus: row?.status,
    delivered: isSuccessStatus(row?.status ?? null),
    type: row?.type,
  };
});

await step("contact-fields", async () => {
  const sent = await wa.messages.sendContact(SELF, {
    name: "TS Live Fields",
    phones: ["+8610000000002"],
    organization: "Photon",
  });
  const row = await db.waitForStatus(stanzaOf(sent.messageId), 15_000);
  return {
    messageId: sent.messageId,
    kind: sent.media?.kind,
    vcardName: sent.media?.vcardName,
    dbStatus: row?.status,
    delivered: isSuccessStatus(row?.status ?? null),
    type: row?.type,
  };
});

db.close();
await wa.close();
process.exit(failures > 0 ? 1 : 0);
