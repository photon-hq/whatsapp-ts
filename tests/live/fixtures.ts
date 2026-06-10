import { deflateSync } from "node:zlib";
import { Database } from "bun:sqlite";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xff_ff_ff_ff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xff_ff_ff_ff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);

  const out = new Uint8Array(4 + body.length + 4);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(4 + body.length, crc32(body));
  return out;
}

/** Build a real PNG of `size`x`size` filled with one RGB color. */
export function makePng(
  size = 48,
  rgb: [number, number, number] = [37, 211, 102]
): Uint8Array {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, size);
  ihdrView.setUint32(4, size);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  // compression, filter, interlace already 0

  const raw = new Uint8Array(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 3;
      raw[px] = rgb[0];
      raw[px + 1] = rgb[1];
      raw[px + 2] = rgb[2];
    }
  }

  const idat = new Uint8Array(deflateSync(raw));

  const chunks = [
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array(0)),
  ];

  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    png.set(c, offset);
    offset += c.length;
  }
  return png;
}

const CHAT_STORAGE_PATH = `${process.env.HOME}/Library/Group Containers/group.net.whatsapp.WhatsApp.shared/ChatStorage.sqlite`;

export interface DbRow {
  status: number | null;
  err: number | null;
  text: string | null;
  jid: string | null;
  name: string | null;
  mediaUrl: string | null;
  type: number | null;
}

/** Extract the WhatsApp stanza id embedded in a `<chatJid>_<stanza>_..` messageId. */
export function stanzaOf(messageId: string): string {
  const parts = messageId.split("_");
  return parts[1] ?? messageId;
}

const SUCCESS_STATUS = new Set([6, 8]);

export function isSuccessStatus(status: number | null): boolean {
  return status !== null && SUCCESS_STATUS.has(status);
}

export class ChatStorageReader {
  private readonly db: Database;

  constructor() {
    this.db = new Database(CHAT_STORAGE_PATH, { readonly: true });
  }

  rowForStanza(stanza: string): DbRow | undefined {
    const row = this.db
      .query(
        `SELECT m.ZMESSAGESTATUS status, m.ZMESSAGEERRORSTATUS err,
                substr(m.ZTEXT,1,80) text, c.ZCONTACTJID jid, c.ZPARTNERNAME name,
                mi.ZMEDIAURL mediaUrl, m.ZMESSAGETYPE type
         FROM ZWAMESSAGE m
         JOIN ZWACHATSESSION c ON c.Z_PK = m.ZCHATSESSION
         LEFT JOIN ZWAMEDIAITEM mi ON mi.Z_PK = m.ZMEDIAITEM
         WHERE m.ZSTANZAID = ?1
         ORDER BY m.Z_PK DESC LIMIT 1`
      )
      .get(stanza) as DbRow | null;
    return row ?? undefined;
  }

  /** Poll until the row reaches a success status, the timeout elapses, or an error appears. */
  async waitForStatus(
    stanza: string,
    timeoutMs = 8000,
    intervalMs = 400
  ): Promise<DbRow | undefined> {
    const deadline = Date.now() + timeoutMs;
    let last: DbRow | undefined;
    for (;;) {
      last = this.rowForStanza(stanza);
      if (last && (isSuccessStatus(last.status) || (last.err ?? 0) !== 0)) {
        return last;
      }
      if (Date.now() >= deadline) {
        return last;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  close(): void {
    this.db.close();
  }
}
