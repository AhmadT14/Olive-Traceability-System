export function blockRanges(fromBlock, toBlock, pageSize) {
  const ranges = [];
  for (let start = fromBlock; start <= toBlock; start += pageSize) {
    ranges.push([start, Math.min(start + pageSize - 1, toBlock)]);
  }
  return ranges;
}

export async function readInPages(readRange, { fromBlock, toBlock, pageSize }) {
  const logs = [];
  for (const [from, to] of blockRanges(fromBlock, toBlock, pageSize)) {
    logs.push(...(await readRange(from, to)));
  }
  return logs;
}
