// Human-readable sequential order numbers (n°1, n°2…).
// The orders table has no sequential column (only a UUID + created_at) and we
// must not add one (no migrations). So the number is derived on the fly from
// chronological creation order — stable as long as historical created_at
// values don't change. Ties broken by id for determinism.

export interface OrderTimeRef {
  id: string;
  created_at: string;
}

// Build a map of order id → sequential number from the full order set.
export function buildOrderNumberMap(allOrders: OrderTimeRef[]): Map<string, number> {
  const sorted = [...allOrders].sort((a, b) => {
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
  const map = new Map<string, number>();
  sorted.forEach((o, i) => map.set(o.id, i + 1));
  return map;
}

// Short hash shown in small text under the readable number.
export function shortOrderHash(id: string): string {
  return id.slice(0, 8);
}
