import { readFile } from "node:fs/promises";
import { createClient } from "../../src/index.ts";

const wa = createClient({
  address: process.env.WHATSAPP_SERVER_ADDRESS ?? "127.0.0.1:50051",
  tls: false,
});

try {
  const image = await readFile(process.env.IMAGE_PATH ?? "");
  const sent = await wa.messages.sendImage(
    process.env.WHATSAPP_RECIPIENT ?? "",
    image,
    { caption: "image from whatsapp-ts" }
  );

  console.log(sent.messageId);
} finally {
  await wa.close();
}
