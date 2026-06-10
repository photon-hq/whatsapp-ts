import { createClient } from "../../src/index.ts";
import { ChatStorageReader, isSuccessStatus, makePdf, stanzaOf } from "./fixtures.ts";

const address = process.env.WHATSAPP_SERVER_ADDRESS ?? "127.0.0.1:50051";
const SELF = process.env.WHATSAPP_SELF ?? "8613418786371";
const wa = createClient({ address, tls: false });
const db = new ChatStorageReader();

try {
  const pdf = makePdf(`doc test ${Date.now()}`);
  const sent = await wa.messages.sendDocument(SELF, pdf, {
    fileName: "ts-live-test.pdf",
    mimeType: "application/pdf",
    caption: `document ${new Date().toISOString()}`,
  });
  const row = await db.waitForStatus(stanzaOf(sent.messageId), 15000);
  console.log(
    JSON.stringify(
      {
        ok: true,
        messageId: sent.messageId,
        apiStatus: sent.messageStatus,
        mediaKind: sent.media?.kind,
        title: sent.media?.title,
        dbStatus: row?.status ?? null,
        delivered: isSuccessStatus(row?.status ?? null),
        mediaUrl: row?.mediaUrl ? "set" : "empty",
        type: row?.type,
      },
      null,
      2
    )
  );
} catch (err) {
  console.error("DOCUMENT FAILED:", err);
  process.exitCode = 1;
} finally {
  db.close();
  await wa.close();
}
