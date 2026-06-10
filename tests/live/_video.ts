import { createClient } from "../../src/index.ts";
import { ChatStorageReader, isSuccessStatus, makeMp4, stanzaOf } from "./fixtures.ts";

const address = process.env.WHATSAPP_SERVER_ADDRESS ?? "127.0.0.1:50051";
const SELF = process.env.WHATSAPP_SELF ?? "8613418786371";
const wa = createClient({ address, tls: false });
const db = new ChatStorageReader();

try {
  const mp4 = makeMp4();
  console.log(`generated mp4: ${mp4.byteLength} bytes`);

  const sent = await wa.messages.sendVideo(SELF, mp4, {
    caption: `video ${new Date().toISOString()}`,
  });
  const row = await db.waitForStatus(stanzaOf(sent.messageId), 15000);
  console.log(
    JSON.stringify(
      {
        ok: true,
        messageId: sent.messageId,
        apiStatus: sent.messageStatus,
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
  console.error("VIDEO FAILED:", err);
  process.exitCode = 1;
} finally {
  db.close();
  await wa.close();
}
