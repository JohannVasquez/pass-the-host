/**
 * Network Interface entity
 * Represents a network interface available on the system
 */
export interface NetworkInterface {
  name: string; // Interface name (e.g., "eth0", "wlan0")
  ip: string; // IP address
}
