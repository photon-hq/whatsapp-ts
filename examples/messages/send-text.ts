import { createClient } from "../../src/index.ts";

const wa = createClient({
  address: process.env.WHATSAPP_SERVER_ADDRESS ?? "127.0.0.1:50051",
  tls: false,
});

try {
  const sent = await wa.messages.sendText(
    process.env.WHATSAPP_RECIPIENT ?? "",
    "hello from whatsapp-ts"
  );

  console.log(sent.messageId);
} finally {
  await wa.close();
}
