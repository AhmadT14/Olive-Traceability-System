import cors from "cors";

export function parseCorsOrigins(raw) {
  return (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function allowOrigins(origins) {
  return cors({ origin: origins, exposedHeaders: ["X-Request-Id"] });
}
