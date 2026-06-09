import { createClient } from "../../src/index.ts";

const wa = createClient({
  address: process.env.WHATSAPP_SERVER_ADDRESS ?? "127.0.0.1:50051",
  tls: false,
});

try {
  const since = Number(process.env.WHATSAPP_AFTER_SEQUENCE ?? "0");

  for await (const event of wa.events.catchUp(since)) {
    console.log(event);

    if (event.type === "catchup.complete") {
      break;
    }
  }
} finally {
  await wa.close();
}
