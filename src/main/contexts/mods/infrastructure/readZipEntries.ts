import * as fs from "fs";
import { inflateRawSync } from "zlib";

// ponytail: no zip64, jars over 4GB / 65k entries aren't mods
const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

/** Reads the wanted entries of a zip/jar without loading the whole file. Missing names are omitted. */
export function readZipEntries(filePath: string, wanted: string[]): Map<string, Buffer> {
  const fd = fs.openSync(filePath, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const readAt = (position: number, length: number): Buffer => {
      const buf = Buffer.alloc(length);
      let done = 0;
      while (done < length) {
        const n = fs.readSync(fd, buf, done, length - done, position + done);
        if (n === 0) throw new Error("Unexpected end of zip file");
        done += n;
      }
      return buf;
    };

    const tailLength = Math.min(size, 0xffff + 22);
    const tail = readAt(size - tailLength, tailLength);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === EOCD_SIG) {
        eocd = i;
        break;
      }
    }
    if (eocd === -1) throw new Error("Not a zip file");

    const cdSize = tail.readUInt32LE(eocd + 12);
    const cdOffset = tail.readUInt32LE(eocd + 16);
    if (cdOffset + cdSize > size) throw new Error("Corrupt zip central directory");
    const cd = readAt(cdOffset, cdSize);

    const names = new Set(wanted);
    const result = new Map<string, Buffer>();
    let pos = 0;
    while (pos + 46 <= cd.length) {
      if (cd.readUInt32LE(pos) !== CENTRAL_SIG) throw new Error("Corrupt zip central directory");
      const method = cd.readUInt16LE(pos + 10);
      const compressedSize = cd.readUInt32LE(pos + 20);
      const nameLength = cd.readUInt16LE(pos + 28);
      const extraLength = cd.readUInt16LE(pos + 30);
      const commentLength = cd.readUInt16LE(pos + 32);
      const localOffset = cd.readUInt32LE(pos + 42);
      const name = cd.toString("utf8", pos + 46, pos + 46 + nameLength);
      pos += 46 + nameLength + extraLength + commentLength;
      if (!names.has(name)) continue;

      // The local header has its own name/extra lengths
      const local = readAt(localOffset, 30);
      if (local.readUInt32LE(0) !== LOCAL_SIG) throw new Error("Corrupt zip local header");
      const dataStart = localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
      const data = readAt(dataStart, compressedSize);
      if (method === 0) result.set(name, data);
      else if (method === 8) result.set(name, inflateRawSync(data));
      else throw new Error(`Unsupported zip compression method ${method}`);
    }
    return result;
  } finally {
    fs.closeSync(fd);
  }
}
