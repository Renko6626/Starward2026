/** Carry only a slot identifier through login; reservation happens on submission. */
export function scheduleSelectionSearch(search: Record<string, unknown>): { segment?: string } {
  return { segment: typeof search.segment === "string" && search.segment.length <= 64 ? search.segment : undefined };
}
