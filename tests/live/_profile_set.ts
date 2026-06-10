import { Database } from "bun:sqlite";
import { readdirSync } from "node:fs";
import { createClient } from "../../src/index.ts";

const address = process.env.WHATSAPP_SERVER_ADDRESS ?? "127.0.0.1:50051";
const NAME = process.env.NAME ?? "Jayden-PROFILETEST";
const wa = createClient({ address, tls: false });

function readPushName(): string | null {
  const root = `${process.env.HOME}/Library/Group Containers/group.net.whatsapp.WhatsApp.shared/AppState`;
  for (const entry of readdirSync(root)) {
    try {
      const db = new Database(`file:${root}/${entry}/AppState.sqlite?mode=ro`, {
        readonly: true,
      });
      const row = db
        .query<{ ZVALUE: Uint8Array }, []>(
          "SELECT ZVALUE FROM ZAPPSTATEKEYVALUEENTITY WHERE ZKEY = 'MT_push_name'"
        )
        .get();
      db.close();
      if (row?.ZVALUE) return new TextDecoder().decode(row.ZVALUE);
    } catch {}
  }
  return null;
}

try {
  console.log(`before: ${readPushName()}`);
  const applied = await wa.profile.modify({ name: NAME });
  await new Promise((r) => setTimeout(r, 1500));
  console.log(JSON.stringify({ applied, afterDb: readPushName() }, null, 2));
} catch (err) {
  console.error("SET FAILED:", err);
  process.exitCode = 1;
} finally {
  await wa.close();
}
