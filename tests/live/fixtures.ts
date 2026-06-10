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

/** Generate a tiny self-contained MP4 (1s 128x128 test pattern) via ffmpeg. */
export function makeMp4(): Uint8Array {
  return ffmpegOutput([
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=128x128:rate=15:duration=1",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-f",
    "mp4",
  ]);
}

/** Generate a tiny self-contained M4A/AAC clip (1s sine tone) via ffmpeg. */
export function makeM4a(): Uint8Array {
  return ffmpegOutput([
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1",
    "-c:a",
    "aac",
    "-b:a",
    "64k",
    "-movflags",
    "+faststart",
    "-f",
    "mp4",
  ]);
}

function ffmpegOutput(args: readonly string[]): Uint8Array {
  const out = `${process.env.TMPDIR ?? "/tmp"}/wa-fixture-${crypto.randomUUID()}`;
  const proc = Bun.spawnSync([
    "ffmpeg",
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    ...args,
    out,
  ]);
  if (proc.exitCode !== 0) {
    throw new Error(
      `ffmpeg failed (${proc.exitCode}): ${new TextDecoder().decode(proc.stderr)}`
    );
  }
  const bytes = new Uint8Array(require("node:fs").readFileSync(out));
  require("node:fs").rmSync(out, { force: true });
  return bytes;
}

/** Minimal single-page PDF document (valid, openable). */
export function makePdf(text = "whatsapp-ts test document"): Uint8Array {
  const body = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 120]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length 60>>stream
BT /F1 14 Tf 20 60 Td (${text}) Tj ET
endstream endobj
trailer<</Root 1 0 R>>
%%EOF`;
  return new TextEncoder().encode(body);
}

/** Synthesize a valid vCard 3.0 string. */
export function makeVcard(opts: {
  name: string;
  phone?: string;
  email?: string;
  org?: string;
}): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${opts.name}`,
    `N:${opts.name};;;;`,
  ];
  if (opts.org) {
    lines.push(`ORG:${opts.org}`);
  }
  if (opts.phone) {
    lines.push(`TEL;type=CELL:${opts.phone}`);
  }
  if (opts.email) {
    lines.push(`EMAIL:${opts.email}`);
  }
  lines.push("END:VCARD");
  return lines.join("\n");
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
