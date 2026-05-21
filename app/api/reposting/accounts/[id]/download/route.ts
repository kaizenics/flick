import { readFile, rm } from "node:fs/promises";
import { getAccount } from "@/lib/reposting/accounts-store";
import { downloadVideo } from "@/lib/reposting/download";

export const runtime = "nodejs";
export const maxDuration = 600;

type DownloadBody = {
  url?: string;
  urls?: string[];
};

function guessNameFromUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] ?? "video";
    const cleaned = last.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
    return cleaned || "video";
  } catch {
    return "video";
  }
}

function dosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { dosTime, dosDate };
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

type ZipEntry = {
  name: string;
  data: Buffer;
};

function buildZip(entries: ZipEntry[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const now = dosDateTime(new Date());

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const size = data.length;
    const checksum = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // local file header signature
    localHeader.writeUInt16LE(20, 4); // version needed to extract
    localHeader.writeUInt16LE(0, 6); // general purpose bit flag
    localHeader.writeUInt16LE(0, 8); // compression method (store)
    localHeader.writeUInt16LE(now.dosTime, 10); // file mod time
    localHeader.writeUInt16LE(now.dosDate, 12); // file mod date
    localHeader.writeUInt32LE(checksum, 14); // crc32
    localHeader.writeUInt32LE(size, 18); // compressed size
    localHeader.writeUInt32LE(size, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBytes.length, 26); // file name length
    localHeader.writeUInt16LE(0, 28); // extra field length

    parts.push(localHeader, nameBytes, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // central file header signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed to extract
    centralHeader.writeUInt16LE(0, 8); // general purpose bit flag
    centralHeader.writeUInt16LE(0, 10); // compression method
    centralHeader.writeUInt16LE(now.dosTime, 12); // file mod time
    centralHeader.writeUInt16LE(now.dosDate, 14); // file mod date
    centralHeader.writeUInt32LE(checksum, 16); // crc32
    centralHeader.writeUInt32LE(size, 20); // compressed size
    centralHeader.writeUInt32LE(size, 24); // uncompressed size
    centralHeader.writeUInt16LE(nameBytes.length, 28); // file name length
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // file comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal file attrs
    centralHeader.writeUInt32LE(0, 38); // external file attrs
    centralHeader.writeUInt32LE(offset, 42); // relative offset local header
    central.push(centralHeader, nameBytes);

    offset += localHeader.length + nameBytes.length + size;
  }

  const centralStart = offset;
  for (const part of central) {
    parts.push(part);
    offset += part.length;
  }
  const centralSize = offset - centralStart;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  eocd.writeUInt16LE(0, 4); // number of this disk
  eocd.writeUInt16LE(0, 6); // disk where central directory starts
  eocd.writeUInt16LE(entries.length, 8); // number of central directory records on this disk
  eocd.writeUInt16LE(entries.length, 10); // total number of central directory records
  eocd.writeUInt32LE(centralSize, 12); // size of central directory
  eocd.writeUInt32LE(centralStart, 16); // offset of start of central directory
  eocd.writeUInt16LE(0, 20); // zip file comment length
  parts.push(eocd);

  return Buffer.concat(parts);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!(await getAccount(id)))
    return Response.json({ error: "not-found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as DownloadBody;
  const urls =
    body.urls
      ?.map((u) => u.trim())
      .filter((u) => u.length > 0) ?? [];
  if (urls.length > 0) {
    const entries: ZipEntry[] = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      let filePath: string | null = null;
      try {
        filePath = await downloadVideo(url);
        const bytes = await readFile(filePath);
        const base = guessNameFromUrl(url);
        const name = `${String(i + 1).padStart(2, "0")}-${base}.mp4`;
        entries.push({ name, data: bytes });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "download failed";
        return Response.json(
          { error: `failed at item ${i + 1}: ${msg}` },
          { status: 500 },
        );
      } finally {
        if (filePath) await rm(filePath, { force: true }).catch(() => {});
      }
    }
    const archive = buildZip(entries);
    return new Response(new Uint8Array(archive), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="videos-${Date.now()}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const rawUrl = body.url?.trim();
  if (!rawUrl) return Response.json({ error: "url required" }, { status: 400 });

  let filePath: string | null = null;
  try {
    filePath = await downloadVideo(rawUrl);
    const bytes = await readFile(filePath);
    const base = guessNameFromUrl(rawUrl);
    return new Response(bytes, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${base}.mp4"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "download failed";
    return Response.json({ error: msg }, { status: 500 });
  } finally {
    if (filePath) await rm(filePath, { force: true }).catch(() => {});
  }
}
