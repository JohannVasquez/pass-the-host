/**
 * Server type enumeration
 */
export enum ServerType {
  VANILLA = "vanilla",
  FORGE = "forge",
  PAPER = "paper",
  FABRIC = "fabric",
  UNKNOWN = "unknown",
}

/**
 * Server entity - represents a Minecraft server
 */
export interface Server {
  id: string;
  name: string;
  version: string;
  type: ServerType;
}

/**
 * Server creation parameters
 */
export interface CreateServerParams {
  name: string;
  version: string;
  type: "vanilla" | "forge";
}
