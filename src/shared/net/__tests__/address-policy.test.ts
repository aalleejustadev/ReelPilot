import { describe, expect, it } from "vitest"

import { isPublicAddress } from "../address-policy"

describe("isPublicAddress", () => {
  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "104.16.132.229",
    "2606:4700:4700::1111",
    "::ffff:8.8.8.8",
  ])("allows the public address %s", (address) => {
    expect(isPublicAddress(address)).toBe(true)
  })

  it.each([
    ["loopback", "127.0.0.1"],
    ["loopback range", "127.10.0.1"],
    ["private 10/8", "10.0.0.5"],
    ["private 172.16/12", "172.20.1.1"],
    ["private 192.168/16", "192.168.1.1"],
    ["cloud metadata", "169.254.169.254"],
    ["CGNAT", "100.64.0.1"],
    ["this network", "0.0.0.0"],
    ["multicast", "224.0.0.1"],
    ["broadcast", "255.255.255.255"],
    ["documentation", "203.0.113.7"],
    ["IPv6 loopback", "::1"],
    ["IPv6 unspecified", "::"],
    ["IPv6 unique local", "fd00::1"],
    ["IPv6 link-local", "fe80::1"],
    ["IPv4-mapped loopback", "::ffff:127.0.0.1"],
    ["IPv4-mapped loopback (hex)", "::ffff:7f00:1"],
    ["NAT64 of a private address", "64:ff9b::a00:1"],
    ["6to4", "2002:c0a8:101::1"],
    ["not an IP", "example.com"],
  ])("blocks %s (%s)", (_label, address) => {
    expect(isPublicAddress(address)).toBe(false)
  })
})
