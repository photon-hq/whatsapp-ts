import { createClient } from "../../src/index.ts";
import { ChatStorageReader, stanzaOf } from "./fixtures.ts";

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

await step("edit", async () => {
  const original = await wa.messages.sendText(SELF, `edit target ${Date.now()}`);
  const edited = await wa.messages.edit(
    original.messageId,
    `edited text ${Date.now()}`
  );
  const row = db.rowForStanza(stanzaOf(edited.messageId));
  return {
    messageId: edited.messageId,
    sameId: edited.messageId === original.messageId,
    newText: edited.text,
    dbText: row?.text,
    textMatches: row?.text === edited.text,
  };
});

await step("status", async () => {
  const sent = await wa.messages.sendText(SELF, `status target ${Date.now()}`);
  const status = await wa.messages.getStatus(sent.messageId);
  return {
    messageId: status.messageId,
    status: status.status,
    statusCode: status.statusCode,
    isFromMe: status.isFromMe,
    isSent: status.isSent,
  };
});

await step("revoke", async () => {
  const sent = await wa.messages.sendText(SELF, `revoke target ${Date.now()}`);
  const result = await wa.messages.revoke(sent.messageId);
  const row = db.rowForStanza(stanzaOf(sent.messageId));
  return {
    messageId: result.messageId,
    removed: result.removed,
    dbRowGone: row === null || row === undefined || row.type === 14,
    dbType: row?.type ?? null,
  };
});

await step("delete", async () => {
  const sent = await wa.messages.sendText(SELF, `delete target ${Date.now()}`);
  const result = await wa.messages.delete(sent.messageId);
  const row = db.rowForStanza(stanzaOf(sent.messageId));
  return {
    messageId: result.messageId,
    removed: result.removed,
    dbRowGone: row === null || row === undefined,
  };
});

db.close();
await wa.close();
process.exit(failures > 0 ? 1 : 0);
