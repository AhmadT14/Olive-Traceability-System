// Batch IDs are made by the app: three letters from the farm location, the
// harvest year and a random part, for example NAB-2026-7K3Q.

// No 0, O, 1 or I, so the code is easy to read off a label.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const FALLBACK_PREFIX = "OLV";

export function randomSuffix(length = 4) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

function prefixOf(location) {
  const letters = String(location || "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  return letters.length >= 3 ? letters.slice(0, 3) : FALLBACK_PREFIX;
}

function yearOf(harvestDate) {
  const match = /^(\d{4})-/.exec(harvestDate || "");
  return match ? match[1] : String(new Date().getFullYear());
}

export function makeBatchId({ location, harvestDate, suffix }) {
  return `${prefixOf(location)}-${yearOf(harvestDate)}-${suffix}`;
}
