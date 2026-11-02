// Small counting helpers for the Overview charts. Each returns
// [{ label, value }] in display order.

// One entry per month for the last `months` months, oldest first, including
// empty months. `amountOf` defaults to counting items. `short` is the month
// without the year, for the chart axis.
export function perMonth(
  items,
  dateOf,
  { months = 6, amountOf = () => 1 } = {},
) {
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      }),
      short: d.toLocaleDateString(undefined, { month: "short" }),
      value: 0,
    });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const item of items) {
    const date = new Date(dateOf(item));
    if (Number.isNaN(date.getTime())) continue;
    const bucket = byKey.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (bucket) bucket.value += Number(amountOf(item)) || 0;
  }
  return buckets.map(({ label, short, value }) => ({ label, short, value }));
}

// One entry per key in `keys` (fixed order, zeros kept). `keysOf` returns the
// key or keys an item counts under.
export function perKey(items, keysOf, keys, labelOf = (key) => key) {
  const counts = new Map(keys.map((key) => [key, 0]));
  for (const item of items) {
    for (const key of [].concat(keysOf(item))) {
      if (counts.has(key)) counts.set(key, counts.get(key) + 1);
    }
  }
  return keys.map((key) => ({ label: labelOf(key), value: counts.get(key) }));
}
