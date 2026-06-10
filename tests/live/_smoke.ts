import { createClient } from "../../src/index.ts";

const address = process.env.WHATSAPP_SERVER_ADDRESS ?? "127.0.0.1:50051";
const recipient = process.env.WHATSAPP_RECIPIENT ?? "14156035192";
const wa = createClient({ address, tls: false });

try {
  const sent = await wa.messages.sendText(
    recipient,
    `whatsapp-ts smoke ${new Date().toISOString()}`
  );
  console.log(
    JSON.stringify(
      {
        ok: true,
        messageId: sent.messageId,
        recipient: sent.recipient,
        chatJid: sent.chatJid,
        status: sent.messageStatus,
        err: sent.messageErrorStatus,
        isFromMe: sent.isFromMe,
      },
      null,
      2
    )
  );
} catch (err) {
  console.error("SEND FAILED:", err);
  process.exitCode = 1;
} finally {
  await wa.close();
}
