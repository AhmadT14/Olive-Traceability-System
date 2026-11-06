export const blockTimeToIso = (timestamp) =>
  new Date(timestamp * 1000).toISOString();

export const newestFirst = (blockKey) => (a, b) =>
  b[blockKey] - a[blockKey] || a.batchId.localeCompare(b.batchId);
