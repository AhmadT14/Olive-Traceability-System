// Filtering and sorting for the farmer's batch list, all in the browser.

// Missing values go last in both directions.
function by(valueOf, direction) {
  return (a, b) => {
    const x = valueOf(a);
    const y = valueOf(b);
    if (x == null || y == null) {
      if (x == null && y == null) return 0;
      return x == null ? 1 : -1;
    }
    if (x === y) return 0;
    return x < y ? -direction : direction;
  };
}

const quantityOf = (b) => (b.quantity == null ? null : Number(b.quantity));

const SORTS = {
  newest: by((b) => b.createdBlock, -1),
  oldest: by((b) => b.createdBlock, 1),
  harvestNewest: by((b) => b.harvestDate, -1),
  harvestOldest: by((b) => b.harvestDate, 1),
  quantityHighest: by(quantityOf, -1),
  quantityLowest: by(quantityOf, 1),
};

export function hasQuantity(batches) {
  return batches.some((b) => b.quantity != null);
}

export function oliveTypes(batches) {
  const types = batches.map((b) => b.olive_type).filter(Boolean);
  return [...new Set(types)].sort((a, b) => a.localeCompare(b));
}

// status and oliveType are "" for all. Equal values keep newest first.
export function viewBatches(batches, { status, oliveType, sort }) {
  return batches
    .filter(
      (b) =>
        (!status || b.status === status) &&
        (!oliveType || b.olive_type === oliveType),
    )
    .sort((a, b) => SORTS[sort](a, b) || SORTS.newest(a, b));
}
