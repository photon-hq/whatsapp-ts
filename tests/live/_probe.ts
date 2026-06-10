import { createClient } from "../../src/index.ts";

const address = process.env.WHATSAPP_SERVER_ADDRESS ?? "127.0.0.1:50051";
const wa = createClient({ address, tls: false });

try {
  const page = await wa.messages.listRecent({ pageSize: 20 });
  console.log(`connected to ${address}, got ${page.messages.length} messages`);

  const chats = new Map<
    string,
    { recipient: string; chatJid?: string; partnerName?: string; count: number }
  >();
  for (const m of page.messages) {
    const key = m.chatJid ?? m.recipient;
    const entry = chats.get(key) ?? {
      recipient: m.recipient,
      chatJid: m.chatJid,
      partnerName: m.partnerName,
      count: 0,
    };
    entry.count += 1;
    chats.set(key, entry);
  }

  console.log("\n=== distinct chats in recent page ===");
  for (const [key, info] of chats) {
    console.log(
      JSON.stringify({
        key,
        recipient: info.recipient,
        partnerName: info.partnerName,
        count: info.count,
      })
    );
  }

  console.log("\n=== latest 5 messages (redacted text) ===");
  for (const m of page.messages.slice(0, 5)) {
    console.log(
      JSON.stringify({
        messageId: m.messageId,
        recipient: m.recipient,
        isFromMe: m.isFromMe,
        type: m.messageType,
        status: m.messageStatus,
        textLen: m.text?.length ?? 0,
        hasMedia: Boolean(m.media),
        date: m.messageDate,
      })
    );
  }
} finally {
  await wa.close();
}
