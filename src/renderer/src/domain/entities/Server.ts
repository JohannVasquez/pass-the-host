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
 * Server entity
 */
export interface Server {
  id: string;
  name: string;
  version: string;
  type: ServerType;
}
