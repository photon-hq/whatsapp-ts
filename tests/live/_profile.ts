import { Database } from "bun:sqlite";
import { homedir } from "node:os";
import { join } from "node:path";
import { readdirSync } from "node:fs";
import { createClient } from "../../src/index.ts";

const address = process.env.WHATSAPP_SERVER_ADDRESS ?? "127.0.0.1:50051";
const wa = createClient({ address, tls: false });

function readPushName(): string | null {
  const stateRoot = join(
    homedir(),
    "Library/Group Containers/group.net.whatsapp.WhatsApp.shared/AppState"
  );
  for (const entry of readdirSync(stateRoot)) {
    const path = join(stateRoot, entry, "AppState.sqlite");
    try {
      const db = new Database(`file:${path}?mode=ro`, { readonly: true });
      const row = db
        .query<{ ZVALUE: Uint8Array }, []>(
          "SELECT ZVALUE FROM ZAPPSTATEKEYVALUEENTITY WHERE ZKEY = 'MT_push_name'"
        )
        .get();
      db.close();
      if (row?.ZVALUE) {
        return new TextDecoder().decode(row.ZVALUE);
      }
    } catch {
      // not every entry is a valid AppState store
    }
  }
  return null;
}

try {
  const originalName = readPushName();
  if (!originalName) {
    throw new Error("could not read current push name from AppState.sqlite");
  }
  console.log(`original push name: ${originalName}`);

  const testName = `${originalName} [test]`;
  const applied = await wa.profile.modify({ name: testName });
  if (!applied.nameUpdated) {
    throw new Error(`modify did not report nameUpdated: ${JSON.stringify(applied)}`);
  }

  // Give WhatsApp a moment to persist the new value, then verify.
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const afterModify = readPushName();

  const restored = await wa.profile.modify({ name: originalName });
  if (!restored.nameUpdated) {
    throw new Error(`restore did not report nameUpdated: ${JSON.stringify(restored)}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));
  const afterRestore = readPushName();

  console.log(
    JSON.stringify(
      {
        ok: afterModify === testName && afterRestore === originalName,
        originalName,
        afterModify,
        afterRestore,
        modifyResult: applied,
        restoreResult: restored,
      },
      null,
      2
    )
  );

  if (afterModify !== testName || afterRestore !== originalName) {
    process.exitCode = 1;
  }
} catch (err) {
  console.error("PROFILE FAILED:", err);
  process.exitCode = 1;
} finally {
  await wa.close();
}
