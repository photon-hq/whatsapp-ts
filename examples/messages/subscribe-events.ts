import { createClient } from "../../src/index.ts";

const wa = createClient({
  address: process.env.WHATSAPP_SERVER_ADDRESS ?? "127.0.0.1:50051",
  tls: false,
});

for await (const event of wa.messages.subscribeEvents({
  recipient: process.env.WHATSAPP_RECIPIENT,
})) {
  console.log(event);
}
