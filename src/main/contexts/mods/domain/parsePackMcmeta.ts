export interface PackMcmeta {
  description: string;
  packFormat?: number;
}

// Text components: a string, {text, extra: [...]}, or an array of those
function flatten(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(flatten).join("");
  if (node && typeof node === "object") {
    const { text, extra } = node as { text?: unknown; extra?: unknown };
    return (typeof text === "string" ? text : "") + flatten(extra);
  }
  return "";
}

/** Reads a datapack's pack.mcmeta; null when it isn't valid JSON or has no "pack" object */
export function parsePackMcmeta(raw: string): PackMcmeta | null {
  let json: unknown;
  try {
    json = JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
  const pack = (json as { pack?: unknown } | null)?.pack;
  if (!pack || typeof pack !== "object" || Array.isArray(pack)) return null;
  const { description, pack_format: format } = pack as Record<string, unknown>;
  return {
    description: flatten(description).replace(/§./g, "").trim(),
    ...(typeof format === "number" && { packFormat: format }),
  };
}
