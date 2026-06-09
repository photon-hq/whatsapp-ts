import { createClient } from "../../src/index.ts";

const wa = createClient({
  address: process.env.WHATSAPP_SERVER_ADDRESS ?? "127.0.0.1:50051",
  tls: false,
});

try {
  const poll = await wa.polls.create(
    process.env.WHATSAPP_RECIPIENT ?? "",
    "Lunch?",
    ["Sushi", "Tacos"]
  );

  console.log(poll);
} finally {
  await wa.close();
}
