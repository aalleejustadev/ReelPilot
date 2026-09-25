import { BlockList, isIP } from "node:net"

/**
 * Addresses a server-side fetch of a user-supplied URL must never reach:
 * private, loopback, link-local (cloud metadata), CGNAT, multicast,
 * documentation and other reserved ranges.
 *
 * Two lists: a BlockList also matches IPv4 addresses against IPv4-mapped
 * IPv6 subnets, so one list holding ::ffff:0:0/96 would block all of IPv4.
 */
const blockedV4 = new BlockList()
const blockedV6 = new BlockList()

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedV4.addSubnet(network, prefix, "ipv4")
}

for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96], // IPv4-mapped in hex form; dotted form is checked as IPv4
  ["64:ff9b::", 96], // NAT64
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23], // Teredo, benchmarking, ORCHID and other IETF ranges
  ["2001:db8::", 32],
  ["2002::", 16], // 6to4 can embed a private IPv4
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  blockedV6.addSubnet(network, prefix, "ipv6")
}

const mappedIpv4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i

/** True when `address` (an IP literal) is on the public internet. */
export function isPublicAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return !blockedV4.check(address, "ipv4")
  if (version === 6) {
    const ipv4 = mappedIpv4.exec(address)?.[1]
    if (ipv4) return isPublicAddress(ipv4)
    return !blockedV6.check(address, "ipv6")
  }
  return false
}
