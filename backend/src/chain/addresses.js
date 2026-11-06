import { ZeroAddress } from "ethers";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function sameAddress(left, right) {
  return (
    typeof left === "string" &&
    typeof right === "string" &&
    left.toLowerCase() === right.toLowerCase()
  );
}

// Every wallet that appears in the arguments of a batch's events (farmer,
// custodian, transporter, target, ...), lower-cased, without duplicates and
// without the zero address. These are the participants a viewer of the batch
// journey may want a name for.
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
