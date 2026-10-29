/**
 * Server type enumeration
 */
export enum ServerType {
  VANILLA = "vanilla",
  FORGE = "forge",
  NEOFORGE = "neoforge",
  PAPER = "paper",
  FABRIC = "fabric",
  QUILT = "quilt",
  UNKNOWN = "unknown",
}

/**
 * Server entity
 */
export interface Server {
  id: string;
  name: string;
  version: string;
  type: ServerType;
  /** Also stored in the active cloud provider; false means it only exists on this PC */
  cloud?: boolean;
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/;

/**
 * Folder name / cloud key for a server, derived from the name the user types.
 * Accents are dropped so the id is stable across file systems that normalize Unicode differently.
 * A name with nothing usable (only emojis or symbols) gets a random UUID.
 */
export function toServerId(name: string): string {
  const id = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .slice(0, 64)
    .replace(/^-+|-+$/g, "");
  if (!id) return crypto.randomUUID();
  return WINDOWS_RESERVED.test(id) ? `${id}-server` : id;
}
