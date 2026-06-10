import { createClient } from "../../src/index.ts";

const address = process.env.WHATSAPP_SERVER_ADDRESS ?? "127.0.0.1:50051";
const path = process.env.AVATAR ?? "/tmp/wa-test-avatar.jpg";
const wa = createClient({ address, tls: false });

try {
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  console.log(`avatar source: ${path} (${bytes.byteLength} bytes)`);

  const applied = await wa.profile.modify({ avatar: bytes });
  console.log(JSON.stringify({ applied }, null, 2));

  if (!applied.avatarUpdated) {
    throw new Error("modify did not report avatarUpdated");
  }
} catch (err) {
  console.error("AVATAR FAILED:", err);
  process.exitCode = 1;
} finally {
  await wa.close();
}
