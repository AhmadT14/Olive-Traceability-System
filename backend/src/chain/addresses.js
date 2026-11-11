import { ZeroAddress } from "ethers";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function sameAddress(left, right) {
  return (
    typeof left === "string" &&
    typeof right === "string" &&
    left.toLowerCase() === right.toLowerCase()
  );
}

export function collectAddresses(events) {
  const found = new Set();
  for (const event of events) {
    for (const value of Object.values(event.args ?? {})) {
      if (typeof value !== "string" || !ADDRESS.test(value)) continue;
      const address = value.toLowerCase();
      if (address !== ZeroAddress) found.add(address);
    }
  }
  return [...found].sort();
}
