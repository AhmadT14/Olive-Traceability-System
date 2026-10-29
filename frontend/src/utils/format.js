const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function isZeroAddress(address) {
  return !address || address.toLowerCase() === ZERO_ADDRESS;
}

// Date only, in the reader's own locale, for example "Oct 5, 2026".
export function formatDay(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}
